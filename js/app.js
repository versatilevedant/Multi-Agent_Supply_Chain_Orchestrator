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
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
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

    // ── ACCEPTANCE SIMULATION STATE ──
    let acceptanceTimers = [];        // all scheduled acceptance/rejection timeouts
    let acceptedHospitalMarkers = []; // green highlight markers for accepted hospitals
    let rejectedHospitalMarkers = []; // dimmed markers for rejected hospitals
    let currentAcceptedHospital = null;
    let simulationActive = false;

    // ── MAIN UNIFIED SINGLE BUTTON HANDLER ──
    async function handleAutoCalculateAndDispatch() {
        const dispatchBtn = elements.dispatchBtn;
        const bloodType = elements.bloodTypeSelect.value;
        const units = parseInt(elements.unitsInput.value, 10) || 1;
        const condition = elements.conditionSelect.value;

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

        // Step 1: Find nearest blood bank to the Mumbai region center
        const mumbaiCenter = { lat: 19.0760, lng: 72.8777 };
        const optimalBank = findOptimalBloodBankForRegion(mumbaiCenter, bloodType, units);

        updateTimeline('discovered');
        addAgentLog({ agent: 'DiscoveryAgent', message: `Source blood bank selected: ${optimalBank.name} (${optimalBank.city})` });

        // Step 2: Identify all candidate hospitals within 50km radius of source bank
        const candidateHospitals = hospitals
            .map(h => ({
                ...h,
                distFromBank: routeOptimizer.haversineDistance(optimalBank.lat, optimalBank.lng, h.lat, h.lng)
            }))
            .filter(h => h.distFromBank < 50)
            .sort((a, b) => a.distFromBank - b.distFromBank);

        if (candidateHospitals.length === 0) {
            addAgentLog({ agent: 'RequestAgent', message: 'No hospitals found within range. Aborting.' });
            dispatchBtn.disabled = false;
            dispatchBtn.classList.remove('loading');
            dispatchBtn.innerHTML = `AUTO-CALCULATE & DISPATCH OPTIMAL ROUTE`;
            return;
        }

        addAgentLog({ agent: 'CoordinationAgent', message: `Broadcasting blood request to ${candidateHospitals.length} hospitals in range. Awaiting acceptance responses (0-60s window)...` });

        updateTimeline('optimized');
        simulationActive = true;

        // Step 3: Assign random accept/reject times (0-60s) to each candidate hospital
        const hospitalResponses = candidateHospitals.map(h => {
            const responseDelay = Math.random() * 60;  // 0 to 60 seconds
            const willAccept = Math.random() < 0.35;    // ~35% acceptance rate
            return {
                hospital: h,
                responseDelay: responseDelay,
                willAccept: willAccept,
                responded: false
            };
        });

        // Sort by response time so we process in chronological order
        hospitalResponses.sort((a, b) => a.responseDelay - b.responseDelay);

        // Ensure at least one hospital accepts (pick the fastest responder to force accept)
        const hasAcceptor = hospitalResponses.some(r => r.willAccept);
        if (!hasAcceptor) {
            hospitalResponses[0].willAccept = true;
        }

        // Step 4: Compute initial route to the first accepting hospital
        const firstAcceptor = hospitalResponses.find(r => r.willAccept);
        const sourcePos = { lat: optimalBank.lat, lng: optimalBank.lng };
        let currentDestHospital = firstAcceptor.hospital;

        let routeResult = await computeRoute(sourcePos, { lat: currentDestHospital.lat, lng: currentDestHospital.lng });
        let algoUsed = routeResult.algo;

        if (!routeResult.valid) {
            addAgentLog({ agent: 'LogisticsAgent', message: 'Route computation failed. Aborting.' });
            dispatchBtn.disabled = false;
            dispatchBtn.classList.remove('loading');
            dispatchBtn.innerHTML = `AUTO-CALCULATE & DISPATCH OPTIMAL ROUTE`;
            return;
        }

        // Draw initial route (pending - gray dashed) while waiting for acceptances
        if (currentRouteLayer) map.removeLayer(currentRouteLayer);
        currentRouteLayer = L.polyline(routeResult.latlngs, {
            color: '#64748b',
            weight: 4,
            opacity: 0.6,
            dashArray: '8, 8',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
        map.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60], animate: true, duration: 1.0 });

        // Show waiting state in info panel
        elements.routeInfoBody.innerHTML = `
            <div style="font-size:0.8rem; line-height:1.6; color:#94a3b8;">
                <div><b>Status:</b> <span style="color:#fbbf24;">Awaiting hospital responses...</span></div>
                <div><b>Source Bank:</b> ${optimalBank.name}</div>
                <div><b>Candidates:</b> ${candidateHospitals.length} hospitals contacted</div>
                <div><b>Blood Type:</b> ${units} Units ${bloodType}</div>
            </div>
        `;

        // Save initial dispatch state
        activeDispatchState = {
            sourceBank: optimalBank,
            currentHospital: null,
            bloodType,
            units,
            waypoints: routeResult.latlngs,
            currentPosition: null,
            distKm: routeResult.distKm,
            durationMin: routeResult.durationMin
        };

        // Step 5: Schedule acceptance/rejection timers
        // Use accelerated time: real seconds = simulation seconds / 4  (so 60s window plays in ~15s)
        const TIME_SCALE = 4;
        let dispatchStarted = false;

        hospitalResponses.forEach((resp, idx) => {
            const realDelay = (resp.responseDelay / TIME_SCALE) * 1000; // convert to accelerated ms

            const timer = setTimeout(async () => {
                if (!simulationActive) return;
                resp.responded = true;

                const simTime = resp.responseDelay.toFixed(1);

                if (resp.willAccept) {
                    // ── HOSPITAL ACCEPTED ──
                    addAgentLog({ agent: 'RequestAgent', message: `[${simTime}s] ${resp.hospital.name} ACCEPTED blood request!` });

                    // Highlight accepted hospital on map with green glow
                    const acceptMarker = L.circleMarker([resp.hospital.lat, resp.hospital.lng], {
                        radius: 12, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3, weight: 2
                    }).addTo(map);
                    acceptedHospitalMarkers.push(acceptMarker);

                    // Check if this hospital has a shorter ETA than current route
                    const newRoute = await computeRoute(sourcePos, { lat: resp.hospital.lat, lng: resp.hospital.lng });

                    if (!newRoute.valid) return;

                    const shouldReroute = !currentAcceptedHospital ||
                        newRoute.durationMin < activeDispatchState.durationMin;

                    if (shouldReroute) {
                        const prevHospName = currentAcceptedHospital ? currentAcceptedHospital.name : '(none)';
                        currentAcceptedHospital = resp.hospital;

                        addAgentLog({ agent: 'CoordinationAgent', message: `[${simTime}s] Rerouting to ${resp.hospital.name} (ETA: ${newRoute.durationMin}min, ${newRoute.distKm}km) — closer than ${prevHospName}` });

                        // Update route on map
                        if (currentRouteLayer) map.removeLayer(currentRouteLayer);
                        currentRouteLayer = L.polyline(newRoute.latlngs, {
                            color: dispatchStarted ? '#f59e0b' : '#8b5cf6',
                            weight: 5,
                            opacity: 0.95,
                            dashArray: dispatchStarted ? '10, 6' : '12, 8',
                            className: 'animated-route',
                            lineCap: 'round',
                            lineJoin: 'round'
                        }).addTo(map);
                        map.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60], animate: true, duration: 1.0 });

                        // Update dispatch state
                        activeDispatchState.currentHospital = resp.hospital;
                        activeDispatchState.waypoints = newRoute.latlngs;
                        activeDispatchState.distKm = newRoute.distKm;
                        activeDispatchState.durationMin = newRoute.durationMin;

                        // Update UI panels
                        elements.routeInfoBody.innerHTML = `
                            <div style="font-size:0.8rem; line-height:1.6; color:#e2e8f0;">
                                <div><b>Hospital:</b> <span style="color:#34d399;">${resp.hospital.name}</span> ${dispatchStarted ? '<span style="color:#fbbf24;">(REROUTED)</span>' : ''}</div>
                                <div><b>Source Bank:</b> ${optimalBank.name}</div>
                                <div><b>Allocation:</b> ${units} Units ${bloodType}</div>
                                <div><b>Distance:</b> ${newRoute.distKm} km | <b>ETA:</b> ${newRoute.durationMin} min</div>
                                <div><b>Engine:</b> ${newRoute.algo}</div>
                            </div>
                        `;
                        elements.routeResultBadge.style.display = 'block';
                        elements.routeResultBadge.classList.add('visible');
                        elements.routeResultBadge.innerHTML = `
                            <b>${dispatchStarted ? 'Rerouted' : 'Route Confirmed'}:</b> <b>${newRoute.distKm} km</b> | ETA: <b>${newRoute.durationMin} mins</b>
                        `;
                        elements.timelineTitle.textContent = `Mission: ${resp.hospital.name}`;
                        elements.timelineEta.textContent = `ETA: ${newRoute.durationMin} mins`;

                        // Start or re-animate ambulance dispatch
                        if (!dispatchStarted) {
                            dispatchStarted = true;
                            updateTimeline('dispatched');
                            animateAmbulanceDispatch(newRoute.latlngs, units, false);
                        } else {
                            // Mid-transit reroute
                            animateAmbulanceDispatch(newRoute.latlngs, units, true);
                        }
                    } else {
                        addAgentLog({ agent: 'IntelligenceAgent', message: `[${simTime}s] ${resp.hospital.name} accepted but current route (${activeDispatchState.durationMin}min) is faster. No reroute needed.` });
                    }

                } else {
                    // ── HOSPITAL REJECTED ──
                    addAgentLog({ agent: 'RequestAgent', message: `[${simTime}s] ${resp.hospital.name} declined the request.` });

                    // Dim rejected hospital on map with red ring
                    const rejectMarker = L.circleMarker([resp.hospital.lat, resp.hospital.lng], {
                        radius: 10, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1, dashArray: '4, 4'
                    }).addTo(map);
                    rejectedHospitalMarkers.push(rejectMarker);
                }
            }, realDelay);

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
                body: JSON.stringify({ hospitalId: firstAcceptor.hospital.id, bloodType, units, condition, deadline: 2 })
            });
        } catch (err) {
            console.warn("Backend emergency POST failed:", err);
        }
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
        currentAcceptedHospital = null;

        // Clear all pending timers
        acceptanceTimers.forEach(t => clearTimeout(t));
        acceptanceTimers = [];

        // Remove acceptance/rejection map markers
        acceptedHospitalMarkers.forEach(m => map.removeLayer(m));
        acceptedHospitalMarkers = [];
        rejectedHospitalMarkers.forEach(m => map.removeLayer(m));
        rejectedHospitalMarkers = [];

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
            vehicleMarker.setIcon(createAmbulanceIcon(currentHeading));
        }

        // ── Smooth frame-rate-independent animation using requestAnimationFrame ──
        const ANIMATION_DURATION_MS = 30000; // Total animation time in ms (30s for visible movement)
        let animationWaypoints = waypoints;
        let startSegmentOffset = 0; // fraction of route already covered (for reroute)

        // If rerouting mid-transit, start from the ambulance's current position
        if (isReroute && activeDispatchState && activeDispatchState.currentPosition) {
            const curPos = activeDispatchState.currentPosition;
            // Find the nearest waypoint on the new route to the current position
            let nearestIdx = 0;
            let nearestDist = Infinity;
            for (let i = 0; i < waypoints.length; i++) {
                const d = Math.pow(waypoints[i][0] - curPos.lat, 2) + Math.pow(waypoints[i][1] - curPos.lng, 2);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            }
            // Slice waypoints from nearest point onward so ambulance continues from current position
            if (nearestIdx > 0) {
                animationWaypoints = [[curPos.lat, curPos.lng], ...waypoints.slice(nearestIdx)];
            } else {
                animationWaypoints = [[curPos.lat, curPos.lng], ...waypoints.slice(1)];
            }
        }

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
                vehicleMarker.setTooltipContent(`Delivered ${units} Units Blood`);
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
            <span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
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