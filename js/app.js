document.addEventListener('DOMContentLoaded', () => {
    // ── Application State ──
    let map;
    let bloodBankMarkers = new Map();
    let hospitalMarkers = new Map();
    let vehicleMarkers = new Map();
    let currentRouteLayer = null;
    let activeAnimationTimer = null;
    let activeDispatchState = null;
    let ambulanceAnimationFrameId = null;
    let currentHeading = 0;

    // Configs & Data (Fetched dynamically from Server API)
    let config = null;
    let hospitals = [];
    let bloodBanks = [];

    // Fast Route Optimizer Instance
    const routeOptimizer = new RouteOptimizer({
        avgSpeedCityKph: 35,
        avgSpeedHighwayKph: 65,
        enableCaching: true
    });

    // DOM Elements
    const elements = {
        agentLogFeed: document.getElementById('agent-log-feed'),
        kpiActiveEmergencies: document.getElementById('kpi-active-emergencies'),
        kpiAvgEta: document.getElementById('kpi-avg-eta'),
        kpiSupplyHealth: document.getElementById('kpi-supply-health'),
        kpiSupplyBar: document.getElementById('kpi-supply-bar'),
        requestForm: document.getElementById('emergency-form'),
        hospitalSelect: document.getElementById('req-hospital'),
        bloodTypeSelect: document.getElementById('req-blood-type'),
        unitsInput: document.getElementById('req-units'),
        conditionSelect: document.getElementById('req-condition'),
        dispatchBtn: document.getElementById('btn-auto-dispatch'),
        rerouteBtn: document.getElementById('btn-demo-reroute'),
        routeInfoBody: document.getElementById('route-info-body'),
        routeResultBadge: document.getElementById('route-result'),
        timelineTitle: document.getElementById('timeline-title'),
        timelineEta: document.getElementById('timeline-eta')
    };

    // ── Initialization ──
    async function init() {
        initMap();

        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            config = data.system || {};
            bloodBanks = data.bloodBanks || [];
            hospitals = data.hospitals || [];
            console.log(`[RaktaSetu API] Loaded ${bloodBanks.length} blood banks and ${hospitals.length} hospitals dynamically.`);
        } catch (err) {
            console.warn("Backend API unavailable. Fetching directly...", err);
        }

        populateForm();
        plotMarkers();
        connectSSE();
        initDatabaseModal();

        // Single Unified Form Listener
        if (elements.requestForm) {
            elements.requestForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleAutoCalculateAndDispatch();
            });
        }

        // Mid-Transit Re-route Button Listener
        if (elements.rerouteBtn) {
            elements.rerouteBtn.addEventListener('click', async () => {
                await handleMidTransitReroute();
            });
        }

        // Sidebar Toggle Listener
        const sidebarToggleBtn = document.getElementById('sidebar-toggle');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', (e) => {
                const sidebar = e.currentTarget.closest('.eoc-sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('collapsed');
                }
            });
        }
    }

    // ── DATABASE MODAL VIEWER ──
    function initDatabaseModal() {
        const openBtn = document.getElementById('open-db-modal');
        const closeBtn = document.getElementById('close-db-modal');
        const overlay = document.getElementById('db-modal-overlay');
        const tabBB = document.getElementById('tab-btn-bb');
        const tabHosp = document.getElementById('tab-btn-hosp');

        if (!openBtn || !overlay) return;

        let activeTab = 'bb';

        openBtn.addEventListener('click', () => {
            overlay.style.display = 'flex';
            renderDatabaseTable(activeTab);
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        if (tabBB && tabHosp) {
            tabBB.addEventListener('click', () => {
                tabBB.classList.add('active');
                tabHosp.classList.remove('active');
                activeTab = 'bb';
                renderDatabaseTable('bb');
            });
            tabHosp.addEventListener('click', () => {
                tabHosp.classList.add('active');
                tabBB.classList.remove('active');
                activeTab = 'hosp';
                renderDatabaseTable('hosp');
            });
        }
    }

    function renderDatabaseTable(tab) {
        const container = document.getElementById('db-modal-content');
        if (!container) return;

        if (tab === 'bb') {
            let html = `
                <table style="width:100%; border-collapse:collapse; font-size:0.8rem; color:#cbd5e1; font-family:'Inter',sans-serif;">
                    <thead>
                        <tr style="background:rgba(15,23,42,0.8); border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:#94a3b8; font-size:0.7rem; text-transform:uppercase; letter-spacing:1px;">
                            <th style="padding:10px;">ID</th>
                            <th style="padding:10px;">Blood Bank Name</th>
                            <th style="padding:10px;">City / State</th>
                            <th style="padding:10px;">Type</th>
                            <th style="padding:10px;">Capacity</th>
                            <th style="padding:10px;">O+ Stock</th>
                            <th style="padding:10px;">A+ Stock</th>
                            <th style="padding:10px;">B+ Stock</th>
                            <th style="padding:10px;">O- Stock</th>
                            <th style="padding:10px;">Coordinates</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            bloodBanks.forEach((bb, idx) => {
                const inv = bb.inventory || {};
                const bg = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                html += `
                    <tr style="background:${bg}; border-bottom:1px solid rgba(255,255,255,0.04);">
                        <td style="padding:10px; font-family:monospace; color:#38bdf8;">${bb.id}</td>
                        <td style="padding:10px; font-weight:600; color:#f8fafc;">${bb.name}</td>
                        <td style="padding:10px;">${bb.city}, ${bb.state || ''}</td>
                        <td style="padding:10px;"><span style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${bb.type || 'Government'}</span></td>
                        <td style="padding:10px;">${bb.capacity || 400} units</td>
                        <td style="padding:10px; color:#34d399; font-weight:bold;">${inv['O+'] !== undefined ? inv['O+'] : 15}</td>
                        <td style="padding:10px; color:#34d399;">${inv['A+'] !== undefined ? inv['A+'] : 12}</td>
                        <td style="padding:10px; color:#34d399;">${inv['B+'] !== undefined ? inv['B+'] : 18}</td>
                        <td style="padding:10px; color:#f87171; font-weight:bold;">${inv['O-'] !== undefined ? inv['O-'] : 5}</td>
                        <td style="padding:10px; font-family:monospace; font-size:0.75rem; color:#94a3b8;">${bb.lat.toFixed(4)}, ${bb.lng.toFixed(4)}</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            container.innerHTML = html;
        } else {
            let html = `
                <table style="width:100%; border-collapse:collapse; font-size:0.8rem; color:#cbd5e1; font-family:'Inter',sans-serif;">
                    <thead>
                        <tr style="background:rgba(15,23,42,0.8); border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:#94a3b8; font-size:0.7rem; text-transform:uppercase; letter-spacing:1px;">
                            <th style="padding:10px;">ID</th>
                            <th style="padding:10px;">Hospital Name</th>
                            <th style="padding:10px;">City / State</th>
                            <th style="padding:10px;">Type</th>
                            <th style="padding:10px;">Beds</th>
                            <th style="padding:10px;">Avg Daily Demand</th>
                            <th style="padding:10px;">GPS Coordinates</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            hospitals.forEach((h, idx) => {
                const bg = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                html += `
                    <tr style="background:${bg}; border-bottom:1px solid rgba(255,255,255,0.04);">
                        <td style="padding:10px; font-family:monospace; color:#38bdf8;">${h.id}</td>
                        <td style="padding:10px; font-weight:600; color:#f8fafc;">${h.name}</td>
                        <td style="padding:10px;">${h.city}, ${h.state || ''}</td>
                        <td style="padding:10px;"><span style="background:rgba(16,185,129,0.15); color:#34d399; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${h.type || 'Medical Center'}</span></td>
                        <td style="padding:10px;">${h.bedCount || 300} beds</td>
                        <td style="padding:10px; font-weight:bold; color:#fbbf24;">${h.avgDailyDemand || 40} units/day</td>
                        <td style="padding:10px; font-family:monospace; font-size:0.75rem; color:#94a3b8;">${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            container.innerHTML = html;
        }
    }

    // ── Leaflet Map Setup ──
    function initMap() {
        map = L.map('map', { zoomControl: false }).setView([22.5, 79.5], 5);

        // Base tile layers (Watermark-free, no API key required)
        const esriDark = L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; Esri, DeLorme, NAVTEQ',
                maxZoom: 19,
                maxNativeZoom: 16
            }),
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
                attribution: '',
                maxZoom: 19,
                maxNativeZoom: 16
            })
        ]).addTo(map);

        const osmDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            className: 'osm-dark-tiles',
            maxZoom: 19
        });

        const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        });

        const baseMaps = {
            "Dark Canvas (Clean)": esriDark,
            "Dark OpenStreetMap": osmDark,
            "Standard OSM": osmStandard
        };

        L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
    }

    function plotMarkers() {
        const createIcon = (color, svgPath, extraClass = '') => L.divIcon({
            className: 'custom-map-marker ' + extraClass,
            html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${color}aa; border: 2px solid white;">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
                   </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const bankIcon = createIcon('#ef4444', '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>', 'pumping-heart');
        const hospitalIcon = createIcon('#3b82f6', '<g fill="white" stroke="none"><rect x="7.5" y="3" width="9" height="18" rx="1"/><rect x="3" y="8" width="5.5" height="13" rx="1"/><rect x="15.5" y="8" width="5.5" height="13" rx="1"/><rect x="2" y="21" width="20" height="1.5" rx="0.5"/><path d="M 11 4.5 h 2 v 1.5 h 1.5 v 2 h -1.5 v 1.5 h -2 v -1.5 h -1.5 v -2 h 1.5 z" fill="#3b82f6"/><rect x="8.25" y="11" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="11" y="11" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="13.75" y="11" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="8.25" y="14" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="11" y="14" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="13.75" y="14" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="4.75" y="11" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="4.75" y="14" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="4.75" y="17" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="17.25" y="11" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="17.25" y="14" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="17.25" y="17" width="2" height="2" fill="#3b82f6" rx="0.3"/><rect x="9.8" y="17" width="2" height="4" fill="#3b82f6" rx="0.3"/><rect x="12.2" y="17" width="2" height="4" fill="#3b82f6" rx="0.3"/></g>');

        const allMarkers = [];

        bloodBanks.forEach(bb => {
            const marker = L.marker([bb.lat, bb.lng], { icon: bankIcon })
                .bindTooltip(`<b>${bb.name}</b><br>Blood Bank (${bb.city || 'India'})`)
                .addTo(map);
            bloodBankMarkers.set(bb.id, marker);
            allMarkers.push(marker);
        });

        hospitals.forEach(h => {
            const marker = L.marker([h.lat, h.lng], { icon: hospitalIcon })
                .bindTooltip(`<b>${h.name}</b><br>Hospital (${h.city || 'India'})`)
                .addTo(map);
            hospitalMarkers.set(h.id, marker);
            allMarkers.push(marker);
        });

        // Removed fitBounds so the map stays centered on India by default
    }

    function populateForm() {
        if (!elements.hospitalSelect) return;
        elements.hospitalSelect.innerHTML = '';

        hospitals.forEach(h => {
            const option = document.createElement('option');
            option.value = h.id;
            option.textContent = `${h.name} (${h.city})`;
            elements.hospitalSelect.appendChild(option);
        });

        // Focus map when hospital selection changes
        elements.hospitalSelect.addEventListener('change', () => {
            const h = hospitals.find(item => item.id === elements.hospitalSelect.value);
            if (h) {
                map.flyTo([h.lat, h.lng], 13, { animate: true, duration: 1.2 });
            }
        });
    }

    // ── ACCEPTANCE SIMULATION & ROUTING STATE ──
    let acceptanceTimers = [];        // all scheduled confirmation/stock timeouts
    let candidateSourceMarkers = [];  // highlight markers for candidate/selected blood banks
    let acceptedHospitalMarkers = []; // markers for accepted hospitals
    let rejectedHospitalMarkers = []; // markers for rejected hospitals
    let destHospitalMarker = null;    // highlight marker for destination hospital
    let currentSourceBank = null;
    let currentDestHospital = null;
    let simulationActive = false;

    // ── Helper: Render Active Route Card ──
    function renderRouteInfoCard(destHospital, sourceBank, units, bloodType, distKm, durationMin, algo, isRerouted = false) {
        elements.routeInfoBody.innerHTML = `
            <div style="font-size:0.8rem; line-height:1.6; color:#e2e8f0;">
                <div><b>Hospital:</b> <span style="color:#38bdf8; font-weight:600;">${destHospital.name}</span> <span style="color:#94a3b8; font-size:0.75rem;">(Destination)</span></div>
                <div><b>Source Bank:</b> <span style="color:${isRerouted ? '#fbbf24' : '#34d399'}; font-weight:600;">${sourceBank.name}</span> ${isRerouted ? '<span style="color:#fbbf24; font-weight:bold;">(REROUTED)</span>' : ''}</div>
                <div><b>Allocation:</b> ${units} Units ${bloodType}</div>
                <div><b>Distance:</b> ${distKm} km | <b>ETA:</b> ${durationMin} min</div>
                <div><b>Engine:</b> ${algo}</div>
            </div>
        `;
    }

    // ── MAIN UNIFIED SINGLE BUTTON HANDLER ──
    async function handleAutoCalculateAndDispatch() {
        const dispatchBtn = elements.dispatchBtn;
        const bloodType = elements.bloodTypeSelect.value;
        const units = parseInt(elements.unitsInput.value, 10) || 1;
        const condition = elements.conditionSelect.value;

        // STEP 1: DESTINATION HOSPITAL IS THE HOSPITAL SELECTED IN THE FORM (e.g. KEM Hospital)
        const selectedHospitalId = elements.hospitalSelect.value;
        const destHospital = hospitals.find(h => h.id === selectedHospitalId) || hospitals[0];
        currentDestHospital = destHospital;

        // Auto collapse sidebar so map is clearly visible
        const sidebar = document.querySelector('.eoc-sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
        }

        // Clean up any previous simulation
        cleanupAcceptanceSimulation();

        // Visual loading state on button
        dispatchBtn.disabled = true;
        dispatchBtn.classList.add('loading');
        dispatchBtn.innerHTML = `CALCULATING OPTIMAL ROUTE...`;

        updateTimeline('received');
        addAgentLog({
            agent: 'RequestAgent',
            message: `Validated emergency requisition for ${units} Units of ${bloodType} at ${destHospital.name} (${destHospital.city}). Severity: ${condition.toUpperCase()}`
        });

        // STEP 2: DISCOVERY AGENT IDENTIFIES CANDIDATE BLOOD BANK SOURCES NEAR DESTINATION HOSPITAL
        // External supply sources requiring road transit to the hospital
        let candidateBanks = bloodBanks
            .map(b => {
                const dist = routeOptimizer.haversineDistance(destHospital.lat, destHospital.lng, b.lat, b.lng);
                const hasStock = b.inventory && b.inventory[bloodType] >= units;
                return {
                    ...b,
                    distToDest: dist,
                    hasStock
                };
            })
            .filter(b => b.distToDest < 60 && b.distToDest > 0.05)
            .sort((a, b) => a.distToDest - b.distToDest);

        if (candidateBanks.length === 0) {
            candidateBanks = bloodBanks
                .map(b => ({
                    ...b,
                    distToDest: routeOptimizer.haversineDistance(destHospital.lat, destHospital.lng, b.lat, b.lng),
                    hasStock: true
                }))
                .filter(b => b.distToDest > 0.05)
                .sort((a, b) => a.distToDest - b.distToDest)
                .slice(0, 5);
        }

        if (candidateBanks.length === 0) {
            candidateBanks = [bloodBanks[0]];
        }

        updateTimeline('discovered');
        addAgentLog({
            agent: 'DiscoveryAgent',
            message: `Discovered ${candidateBanks.length} candidate blood banks for destination ${destHospital.name}. Querying inventory locks...`
        });

        // Highlight Destination Hospital on map
        if (destHospitalMarker) map.removeLayer(destHospitalMarker);
        destHospitalMarker = L.circleMarker([destHospital.lat, destHospital.lng], {
            radius: 14, color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.35, weight: 3
        }).bindTooltip(`<b>Destination: ${destHospital.name}</b>`, { permanent: true, direction: 'top', className: 'dest-tooltip' }).addTo(map);

        updateTimeline('optimized');
        simulationActive = true;

        // STEP 3: INITIAL SOURCE BLOOD BANK SELECTION (Optimal closest available source bank)
        const initialBank = candidateBanks[0];
        currentSourceBank = initialBank;

        // STEP 4: COMPUTE ROUTE FROM SOURCE BLOOD BANK TO DESTINATION HOSPITAL
        let routeResult = await computeRoute(
            { lat: currentSourceBank.lat, lng: currentSourceBank.lng },
            { lat: destHospital.lat, lng: destHospital.lng }
        );

        if (!routeResult.valid) {
            addAgentLog({ agent: 'LogisticsAgent', message: 'Route computation failed. Aborting.' });
            dispatchBtn.disabled = false;
            dispatchBtn.classList.remove('loading');
            dispatchBtn.innerHTML = `AUTO-CALCULATE & DISPATCH OPTIMAL ROUTE`;
            return;
        }

        // Draw initial route on map
        if (currentRouteLayer) map.removeLayer(currentRouteLayer);
        currentRouteLayer = L.polyline(routeResult.latlngs, {
            color: '#f9ad16ff', // High-visibility emergency orange
            weight: 5,
            opacity: 0.95,
            dashArray: '12, 8',
            className: 'animated-route',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
        map.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60], animate: true, duration: 1.0 });

        // Highlight initial source blood bank
        const initBankMarker = L.circleMarker([currentSourceBank.lat, currentSourceBank.lng], {
            radius: 12, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3, weight: 2
        }).addTo(map);
        candidateSourceMarkers.push(initBankMarker);

        // Render initial route info: Hospital is Destination (e.g. KEM Hospital), Source is initialBank
        renderRouteInfoCard(destHospital, currentSourceBank, units, bloodType, routeResult.distKm, routeResult.durationMin, routeResult.algo, false);

        elements.routeResultBadge.style.display = 'block';
        elements.routeResultBadge.classList.add('visible');
        elements.routeResultBadge.innerHTML = `<b>Route Confirmed:</b> <b>${routeResult.distKm} km</b> | ETA: <b>${routeResult.durationMin} mins</b>`;
        elements.timelineTitle.textContent = `Mission: ${destHospital.name}`;
        elements.timelineEta.textContent = `ETA: ${routeResult.durationMin} mins`;

        // Save active dispatch state
        activeDispatchState = {
            destHospital: destHospital,
            sourceBank: currentSourceBank,
            candidateBanks: candidateBanks,
            bloodType,
            units,
            waypoints: routeResult.latlngs,
            currentPosition: { lat: currentSourceBank.lat, lng: currentSourceBank.lng },
            distKm: routeResult.distKm,
            durationMin: routeResult.durationMin,
            isRerouted: false
        };

        // Make reroute button available during active transit
        if (elements.rerouteBtn) {
            elements.rerouteBtn.style.display = 'block';
        }

        // Start ambulance dispatch animation along computed road route
        updateTimeline('dispatched');
        animateAmbulanceDispatch(routeResult.latlngs, units, false);

        // STEP 5: BROADCAST BLOOD REQUISITION TO CANDIDATE HOSPITALS IN REGION
        const candidateHospitals = hospitals
            .filter(h => h.id !== destHospital.id)
            .map(h => ({
                ...h,
                distFromSource: routeOptimizer.haversineDistance(currentSourceBank.lat, currentSourceBank.lng, h.lat, h.lng)
            }))
            .filter(h => h.distFromSource < 50)
            .sort((a, b) => a.distFromSource - b.distFromSource);

        addAgentLog({
            agent: 'CoordinationAgent',
            message: `Broadcasting blood request to ${candidateHospitals.length} hospitals in network. Awaiting acceptance confirmations...`
        });

        // Simulate responses from candidate hospitals (nearby hospitals respond in 4-12 seconds)
        const hospitalResponses = candidateHospitals.slice(0, 10).map((h, idx) => {
            const responseDelay = 3.5 + idx * 2.2 + Math.random() * 1.5;
            const willAccept = idx === 0 ? true : (Math.random() < 0.45);
            return {
                hospital: h,
                responseDelay,
                willAccept,
                responded: false
            };
        });
        hospitalResponses.sort((a, b) => a.responseDelay - b.responseDelay);

        hospitalResponses.forEach(resp => {
            const timer = setTimeout(async () => {
                if (!simulationActive || !activeDispatchState) return;
                resp.responded = true;

                if (resp.willAccept) {
                    addAgentLog({
                        agent: 'RequestAgent',
                        message: `${resp.hospital.name} ACCEPTED emergency blood requisition!`
                    });

                    // Evaluate from the ambulance's current real-time position
                    const curPos = activeDispatchState.currentPosition || { lat: currentSourceBank.lat, lng: currentSourceBank.lng };

                    // Compute route from current ambulance position to this accepted hospital
                    const candidateRoute = await computeRoute(curPos, { lat: resp.hospital.lat, lng: resp.hospital.lng });
                    if (!candidateRoute.valid) return;

                    // Remaining distance to current destination from current ambulance position
                    const currentDestRoute = await computeRoute(curPos, { lat: activeDispatchState.destHospital.lat, lng: activeDispatchState.destHospital.lng });
                    const currentDistKm = currentDestRoute.valid ? parseFloat(currentDestRoute.distKm) : parseFloat(activeDispatchState.distKm);
                    const candidateDistKm = parseFloat(candidateRoute.distKm);

                    // Check if this newly accepted hospital has a SHORTER distance than current destination
                    if (candidateDistKm < currentDistKm) {
                        await performHospitalReroute(resp.hospital, candidateRoute, currentDistKm);
                    } else {
                        addAgentLog({
                            agent: 'IntelligenceAgent',
                            message: `${resp.hospital.name} accepted, but current destination (${activeDispatchState.destHospital.name}) is closer (${currentDistKm.toFixed(2)} km vs ${candidateDistKm.toFixed(2)} km). No reroute.`
                        });

                        const acceptMarker = L.circleMarker([resp.hospital.lat, resp.hospital.lng], {
                            radius: 10, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.25, weight: 1.5
                        }).addTo(map);
                        acceptedHospitalMarkers.push(acceptMarker);
                    }
                } else {
                    addAgentLog({
                        agent: 'RequestAgent',
                        message: `${resp.hospital.name} declined request.`
                    });

                    const rejectMarker = L.circleMarker([resp.hospital.lat, resp.hospital.lng], {
                        radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1, weight: 1, dashArray: '4, 4'
                    }).addTo(map);
                    rejectedHospitalMarkers.push(rejectMarker);
                }
            }, resp.responseDelay * 1000);
            acceptanceTimers.push(timer);
        });

        // Finalize button after short delay
        setTimeout(() => {
            dispatchBtn.disabled = false;
            dispatchBtn.classList.remove('loading');
            dispatchBtn.innerHTML = `AUTO-CALCULATE & DISPATCH OPTIMAL ROUTE`;
        }, 1200);

        // Post to backend API
        try {
            await fetch('/api/emergency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId: destHospital.id, bloodType, units, condition, deadline: 2 })
            });
        } catch (err) {
            console.warn("Backend emergency POST failed:", err);
        }
    }

    // ── REROUTE TO SHORTEST DISTANCE ACCEPTED HOSPITAL ──
    async function performHospitalReroute(newHospital, route, prevDistKm = null) {
        if (!simulationActive || !activeDispatchState) return;

        const prevHospName = activeDispatchState.destHospital ? activeDispatchState.destHospital.name : 'Hospital';
        activeDispatchState.destHospital = newHospital;
        currentDestHospital = newHospital;
        activeDispatchState.isRerouted = true;

        const prevDistStr = prevDistKm ? ` (${prevDistKm.toFixed(2)} km)` : '';
        addAgentLog({
            agent: 'CoordinationAgent',
            message: `Rerouting to ${newHospital.name} (Shortest distance: ${route.distKm} km, ETA: ${route.durationMin} min) — closer than ${prevHospName}${prevDistStr}!`
        });

        // Highlight newly accepted destination hospital on map
        if (destHospitalMarker) map.removeLayer(destHospitalMarker);
        destHospitalMarker = L.circleMarker([newHospital.lat, newHospital.lng], {
            radius: 14, color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.35, weight: 3
        }).bindTooltip(`<b>Destination: ${newHospital.name}</b>`, { permanent: true, direction: 'top', className: 'dest-tooltip' }).addTo(map);

        // Update route on map in high-visibility emergency orange directly from current vehicle position
        if (currentRouteLayer) map.removeLayer(currentRouteLayer);
        currentRouteLayer = L.polyline(route.latlngs, {
            color: '#f9ad16ff',
            weight: 5,
            opacity: 0.95,
            dashArray: '10, 6',
            className: 'animated-route',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
        map.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60], animate: true, duration: 1.0 });

        // Update active dispatch state
        activeDispatchState.waypoints = route.latlngs;
        activeDispatchState.distKm = route.distKm;
        activeDispatchState.durationMin = route.durationMin;

        // Update UI card: Hospital shows the rerouted shortest-distance accepted hospital
        elements.routeInfoBody.innerHTML = `
            <div style="font-size:0.8rem; line-height:1.6; color:#e2e8f0;">
                <div><b>Hospital:</b> <span style="color:#34d399; font-weight:600;">${newHospital.name}</span> <span style="color:#fbbf24; font-weight:bold;">(REROUTED)</span></div>
                <div><b>Source Bank:</b> <span style="color:#38bdf8; font-weight:600;">${currentSourceBank.name}</span></div>
                <div><b>Allocation:</b> ${activeDispatchState.units} Units ${activeDispatchState.bloodType}</div>
                <div><b>Distance:</b> ${route.distKm} km | <b>ETA:</b> ${route.durationMin} min</div>
                <div><b>Engine:</b> ${route.algo}</div>
            </div>
        `;

        elements.routeResultBadge.style.display = 'block';
        elements.routeResultBadge.classList.add('visible');
        elements.routeResultBadge.innerHTML = `<b>Rerouted:</b> <b>${route.distKm} km</b> | ETA: <b>${route.durationMin} mins</b>`;
        elements.timelineTitle.textContent = `Mission: ${newHospital.name}`;
        elements.timelineEta.textContent = `ETA: ${route.durationMin} mins`;

        // Smoothly animate ambulance along the new orange route to the accepted hospital
        animateAmbulanceDispatch(route.latlngs, activeDispatchState.units, false);
    }

    // ── Mid-Transit Re-route Trigger Handler (from UI Button) ──
    async function handleMidTransitReroute() {
        if (!simulationActive || !activeDispatchState) {
            addAgentLog({ agent: 'LogisticsAgent', message: 'No active dispatch in transit to reroute.' });
            return;
        }

        const curPos = activeDispatchState.currentPosition || { lat: currentSourceBank.lat, lng: currentSourceBank.lng };
        const candidateHospitals = hospitals
            .filter(h => h.id !== activeDispatchState.destHospital.id)
            .map(h => ({
                ...h,
                distFromAmbulance: routeOptimizer.haversineDistance(curPos.lat, curPos.lng, h.lat, h.lng)
            }))
            .sort((a, b) => a.distFromAmbulance - b.distFromAmbulance);

        const shortestHospital = candidateHospitals[0];
        if (!shortestHospital) return;

        const candidateRoute = await computeRoute(curPos, { lat: shortestHospital.lat, lng: shortestHospital.lng });
        if (!candidateRoute.valid) return;

        await performHospitalReroute(shortestHospital, candidateRoute);
    }

    // ── Helper: Compute route from source to destination ──
    async function computeRoute(sourcePos, destPos) {
        let routeResult = await routeOptimizer.getOSRMRoute(sourcePos, destPos);
        let algo = 'OSRM Real Road';

        if (!routeResult || !routeResult.waypoints || routeResult.waypoints.length === 0) {
            routeResult = routeOptimizer.fallbackToGraphAlgorithm(sourcePos, destPos, 'astar');
            algo = 'A* Graph';
        }

        if (!routeResult || !routeResult.waypoints || routeResult.waypoints.length === 0) {
            return { valid: false };
        }

        const latlngs = routeResult.waypoints.map(wp => [wp.lat, wp.lng]);
        const distKm = routeResult.distance.toFixed(2);
        const durationMin = Math.max(1, Math.round(routeResult.duration * 60));

        return { valid: true, latlngs, distKm, durationMin, algo };
    }

    // ── Helper: Find best blood bank for a region center ──
    function findOptimalBloodBankForRegion(regionCenter, bloodType, units) {
        if (!bloodBanks || bloodBanks.length === 0) {
            return { name: 'Central Blood Depot', lat: regionCenter.lat + 0.02, lng: regionCenter.lng + 0.02, city: 'Unknown' };
        }

        let bestBank = bloodBanks[0];
        let bestScore = Infinity;

        bloodBanks.forEach(bank => {
            const dist = routeOptimizer.haversineDistance(regionCenter.lat, regionCenter.lng, bank.lat, bank.lng);
            const inventoryScore = (bank.inventory && bank.inventory[bloodType] >= units) ? 0 : 80;
            const totalScore = dist + inventoryScore;

            if (totalScore < bestScore) {
                bestScore = totalScore;
                bestBank = bank;
            }
        });

        return bestBank;
    }

    // ── Cleanup previous simulation ──
    function cleanupAcceptanceSimulation() {
        simulationActive = false;
        currentSourceBank = null;
        currentDestHospital = null;

        // Clear all pending timers
        acceptanceTimers.forEach(t => clearTimeout(t));
        acceptanceTimers = [];

        // Remove source and destination markers
        candidateSourceMarkers.forEach(m => map.removeLayer(m));
        candidateSourceMarkers = [];
        acceptedHospitalMarkers.forEach(m => map.removeLayer(m));
        acceptedHospitalMarkers = [];
        rejectedHospitalMarkers.forEach(m => map.removeLayer(m));
        rejectedHospitalMarkers = [];
        if (destHospitalMarker) {
            map.removeLayer(destHospitalMarker);
            destHospitalMarker = null;
        }

        // Hide reroute button
        if (elements.rerouteBtn) {
            elements.rerouteBtn.style.display = 'none';
        }

        // Remove existing route layer
        if (currentRouteLayer) {
            map.removeLayer(currentRouteLayer);
            currentRouteLayer = null;
        }

        // Clear animation (both old interval and new rAF)
        if (activeAnimationTimer) {
            clearInterval(activeAnimationTimer);
            activeAnimationTimer = null;
        }
        if (ambulanceAnimationFrameId) {
            cancelAnimationFrame(ambulanceAnimationFrameId);
            ambulanceAnimationFrameId = null;
        }

        // Remove vehicle markers
        vehicleMarkers.forEach(m => map.removeLayer(m));
        vehicleMarkers.clear();

        activeDispatchState = null;
    }

    // ── Helper: Find Optimal Blood Bank ──
    function findOptimalBloodBank(hospital, bloodType, units) {
        if (!bloodBanks || bloodBanks.length === 0) return { name: 'Central Blood Depot', lat: hospital.lat + 0.05, lng: hospital.lng + 0.05 };

        let bestBank = bloodBanks[0];
        let bestScore = Infinity;

        bloodBanks.forEach(bank => {
            const dist = routeOptimizer.haversineDistance(hospital.lat, hospital.lng, bank.lat, bank.lng);
            const inventoryScore = (bank.inventory && bank.inventory[bloodType]) ? 0 : 50;
            const totalScore = dist + inventoryScore;

            if (totalScore < bestScore) {
                bestScore = totalScore;
                bestBank = bank;
            }
        });

        return bestBank;
    }

    // ── Helper: Compute bearing between two lat/lng points (in degrees 0-360) ──
    function computeBearing(lat1, lng1, lat2, lng2) {
        const toRad = d => d * Math.PI / 180;
        const toDeg = r => r * 180 / Math.PI;
        const dLng = toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    // ── Helper: Shortest angle difference for smooth rotation ──
    function angleLerp(current, target, factor) {
        let diff = target - current;
        // Normalize to [-180, 180] so we always rotate the short way
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return current + diff * factor;
    }

    // ── Helper: Linear interpolation ──
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ── 3D Ambulance Animation System ──

    function animateAmbulanceDispatch(waypoints, units, isReroute = false) {
        // Cancel any running animation
        if (ambulanceAnimationFrameId) {
            cancelAnimationFrame(ambulanceAnimationFrameId);
            ambulanceAnimationFrameId = null;
        }
        if (activeAnimationTimer) {
            clearInterval(activeAnimationTimer);
            activeAnimationTimer = null;
        }

        // Remove existing vehicle markers if fresh dispatch
        if (!isReroute) {
            vehicleMarkers.forEach(m => map.removeLayer(m));
            vehicleMarkers.clear();
        }

        let vehicleMarker = vehicleMarkers.get('main_vehicle');

        // Create the 3D ambulance icon with CSS rotation support (pure SVG, no background)
        function createAmbulanceIcon(heading) {
            return L.divIcon({
                className: 'ambulance-3d-marker',
                html: `<div class="ambulance-3d-container" style="transform: rotate(${heading}deg);">
                         <div class="ambulance-3d-shadow"></div>
                         <svg class="ambulance-3d-img" viewBox="0 0 64 96" xmlns="http://www.w3.org/2000/svg">
                           <!-- Body -->
                           <rect x="12" y="10" width="40" height="76" rx="8" ry="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
                           <!-- Cabin (front) -->
                           <rect x="16" y="10" width="32" height="22" rx="6" ry="6" fill="#e2e8f0"/>
                           <rect x="18" y="12" width="28" height="16" rx="4" ry="4" fill="#475569" opacity="0.7"/>
                           <!-- Red stripe left -->
                           <rect x="12" y="34" width="4" height="50" fill="#ef4444" rx="1"/>
                           <!-- Red stripe right -->
                           <rect x="48" y="34" width="4" height="50" fill="#ef4444" rx="1"/>
                           <!-- Red cross -->
                           <rect x="28" y="42" width="8" height="28" rx="2" fill="#dc2626"/>
                           <rect x="20" y="52" width="24" height="8" rx="2" fill="#dc2626"/>
                           <!-- Emergency lights -->
                           <rect x="16" y="8" width="12" height="6" rx="3" fill="#ef4444" class="light-red"/>
                           <rect x="36" y="8" width="12" height="6" rx="3" fill="#3b82f6" class="light-blue"/>
                           <!-- Rear bumper -->
                           <rect x="14" y="82" width="36" height="4" rx="2" fill="#cbd5e1"/>
                           <!-- Wheels -->
                           <ellipse cx="14" cy="28" rx="4" ry="6" fill="#1e293b"/>
                           <ellipse cx="50" cy="28" rx="4" ry="6" fill="#1e293b"/>
                           <ellipse cx="14" cy="74" rx="4" ry="6" fill="#1e293b"/>
                           <ellipse cx="50" cy="74" rx="4" ry="6" fill="#1e293b"/>
                         </svg>
                         <div class="ambulance-3d-lights"></div>
                       </div>`,
                iconSize: [56, 56],
                iconAnchor: [28, 28]
            });
        }

        // Compute initial heading from first two waypoints
        if (waypoints.length >= 2) {
            currentHeading = computeBearing(
                waypoints[0][0], waypoints[0][1],
                waypoints[1][0], waypoints[1][1]
            );
        }

        if (!vehicleMarker) {
            vehicleMarker = L.marker(waypoints[0], {
                icon: createAmbulanceIcon(currentHeading),
                zIndexOffset: 1000
            })
                .bindTooltip(`Express Ambulance (Units: ${units})`, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -30],
                    className: 'ambulance-tooltip'
                })
                .addTo(map);
            vehicleMarkers.set('main_vehicle', vehicleMarker);
        } else {
            vehicleMarker.setLatLng(waypoints[0]);
            vehicleMarker.setIcon(createAmbulanceIcon(currentHeading));
        }

        // ── Smooth frame-rate-independent animation using requestAnimationFrame ──
        const ANIMATION_DURATION_MS = 25000; // 25s for smooth, realistic movement
        let animationWaypoints = waypoints;

        const totalSegments = animationWaypoints.length - 1;
        if (totalSegments <= 0) return;

        // Pre-compute the initial heading so the first frame doesn't snap from 0
        if (animationWaypoints.length >= 2) {
            currentHeading = computeBearing(
                animationWaypoints[0][0], animationWaypoints[0][1],
                animationWaypoints[1][0], animationWaypoints[1][1]
            );
        }

        const startTime = performance.now();
        let prevTimestamp = startTime;

        function animationLoop(timestamp) {
            const dt = Math.min((timestamp - prevTimestamp) / 1000, 0.1); // delta seconds, capped
            prevTimestamp = timestamp;

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1.0);

            // Smooth ease-in-out for natural movement
            const easedProgress = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // Calculate current position along the route
            const floatIndex = easedProgress * totalSegments;
            const segIndex = Math.min(Math.floor(floatIndex), totalSegments - 1);
            const segT = floatIndex - segIndex;

            const lat = lerp(animationWaypoints[segIndex][0], animationWaypoints[segIndex + 1][0], segT);
            const lng = lerp(animationWaypoints[segIndex][1], animationWaypoints[segIndex + 1][1], segT);

            // Compute target bearing from current segment
            const targetHeading = computeBearing(
                animationWaypoints[segIndex][0], animationWaypoints[segIndex][1],
                animationWaypoints[segIndex + 1][0], animationWaypoints[segIndex + 1][1]
            );

            // Delta-time-based heading smoothing (faster at start, always frame-rate independent)
            const smoothFactor = 1 - Math.pow(0.001, dt); // ~0.93 at 60fps — very responsive
            currentHeading = angleLerp(currentHeading, targetHeading, smoothFactor);

            // Update marker position
            vehicleMarker.setLatLng([lat, lng]);

            // Update the ambulance rotation via the DOM element
            const container = vehicleMarker.getElement();
            if (container) {
                const innerDiv = container.querySelector('.ambulance-3d-container');
                if (innerDiv) {
                    innerDiv.style.transform = `rotate(${currentHeading}deg)`;
                }
            }

            // Update live position in state
            if (activeDispatchState) {
                activeDispatchState.currentPosition = { lat, lng };
            }

            if (progress < 1.0) {
                ambulanceAnimationFrameId = requestAnimationFrame(animationLoop);
            } else {
                // Animation complete
                ambulanceAnimationFrameId = null;
                updateTimeline('arrived');
                const destName = (activeDispatchState && activeDispatchState.destHospital) ? activeDispatchState.destHospital.name : 'Hospital';
                vehicleMarker.setTooltipContent(`Delivered ${units} Units Blood to ${destName}`);
                if (elements.rerouteBtn) {
                    elements.rerouteBtn.style.display = 'none';
                }
                addAgentLog({
                    agent: 'LogisticsAgent',
                    message: `Delivery complete! ${units} units safely handed over to ${destName}. Mission accomplished.`
                });
                simulationActive = false;
            }
        }

        ambulanceAnimationFrameId = requestAnimationFrame(animationLoop);
    }

    // ── Helper: Timeline Step Updates ──
    function updateTimeline(activeStepId) {
        const steps = ['received', 'discovered', 'optimized', 'dispatched', 'arrived'];
        let reached = true;

        steps.forEach(id => {
            const el = document.getElementById(`step-${id}`);
            if (!el) return;

            el.classList.remove('completed', 'active', 'pending');
            if (reached) {
                if (id === activeStepId) {
                    el.classList.add('active', 'pulse-blue');
                    reached = false;
                } else {
                    el.classList.add('completed');
                }
            } else {
                el.classList.add('pending');
            }
        });
    }

    // ── Server-Sent Events (SSE Stream) ──
    function connectSSE() {
        try {
            const evtSource = new EventSource('/api/stream');

            evtSource.addEventListener('agent_log', (e) => {
                const data = JSON.parse(e.data);
                addAgentLog(data);
            });

            evtSource.addEventListener('metrics_update', (e) => {
                const metrics = JSON.parse(e.data);
                if (elements.kpiActiveEmergencies) elements.kpiActiveEmergencies.textContent = metrics.activeEmergencies;
                if (elements.kpiSupplyHealth) elements.kpiSupplyHealth.textContent = `${metrics.supplyHealth || 85}% Optimal`;
            });
        } catch (e) {
            console.warn("SSE Stream connection error:", e);
        }
    }

    function addAgentLog(logData) {
        if (!elements.agentLogFeed) return;

        const colors = {
            RequestAgent: '#8b5cf6',
            DiscoveryAgent: '#14b8a6',
            IntelligenceAgent: '#f59e0b',
            CoordinationAgent: '#ec4899',
            LogisticsAgent: '#3b82f6',
            MonitoringAgent: '#10b981'
        };

        const color = colors[logData.agent] || '#60a5fa';

        const el = document.createElement('div');
        el.className = 'feed-item';
        el.innerHTML = `
            <span class="time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span class="agent" style="color: ${color}; font-weight: bold;">[${logData.agent}]</span>
            <span class="msg">${formatLogMessage(logData)}</span>
        `;

        elements.agentLogFeed.prepend(el);
        if (elements.agentLogFeed.children.length > 30) {
            elements.agentLogFeed.removeChild(elements.agentLogFeed.lastChild);
        }
    }

    function formatLogMessage(data) {
        if (data.message) return data.message;
        if (data.agent === 'RequestAgent') return `Validated request for ${data.units} units of ${data.bloodType}. Urgency: ${data.urgencyLevel || 'HIGH'}`;
        if (data.agent === 'DiscoveryAgent') return `Discovered ${data.candidates ? data.candidates.length : 3} compatible blood banks in network.`;
        if (data.agent === 'CoordinationAgent') return `Optimized multi-source allocation using NSGA-II.`;
        if (data.agent === 'LogisticsAgent') return `Generated optimal road route via OSRM & fast graph search.`;
        if (data.agent === 'IntelligenceAgent') return `Predictive ETA & inventory risk models executed.`;
        return JSON.stringify(data);
    }

    // Run Initialization
    init();
});