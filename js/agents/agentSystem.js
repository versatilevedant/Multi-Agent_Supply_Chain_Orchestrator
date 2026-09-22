;(function(root) {
  'use strict';

  // ==========================================
  // EventBus
  // ==========================================
  class EventBus {
    constructor() {
      this.listeners = new Map();
    }
    
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
    
    emit(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (e) {
            console.error(`Error in event listener for ${event}:`, e);
          }
        });
      }
    }
  }

  // ==========================================
  // BaseAgent
  // ==========================================
  class BaseAgent {
    constructor(id, name, role, config = {}) {
      this.id = id;
      this.name = name;
      this.role = role;
      this.status = 'idle'; // idle | active | processing | alert | error
      this.currentTask = null;
      this.logs = [];  // { timestamp, message, type }
      this.metrics = { tasksCompleted: 0, avgResponseTimeMs: 0, lastActive: null, errors: 0 };
      this.eventBus = null;
      this.config = config;
    }
    
    log(message, type = 'info') {
      this.logs.unshift({ timestamp: new Date().toISOString(), message, type });
      if (this.logs.length > 100) {
        this.logs.pop();
      }
      if (type === 'error') {
        this.metrics.errors++;
      }
    }
    
    setStatus(status, task = null) {
      this.status = status;
      if (task !== null) {
        this.currentTask = task;
      }
      if (status !== 'idle') {
        this.metrics.lastActive = new Date().toISOString();
      }
      if (this.eventBus) {
        this.eventBus.emit('agent:status_change', { agentId: this.id, status: this.status, task: this.currentTask });
      }
    }
    
    complete(startTimeMs) {
      this.metrics.tasksCompleted++;
      const duration = Date.now() - startTimeMs;
      // Moving average
      this.metrics.avgResponseTimeMs = (this.metrics.avgResponseTimeMs * (this.metrics.tasksCompleted - 1) + duration) / this.metrics.tasksCompleted;
      this.setStatus('idle', null);
    }
    
    toJSON() {
      return {
        id: this.id,
        name: this.name,
        role: this.role,
        status: this.status,
        currentTask: this.currentTask,
        metrics: this.metrics
      };
    }
  }

  // ==========================================
  // 1. RequestAgent
  // ==========================================
  class RequestAgent extends BaseAgent {
    constructor() {
      super('request-agent', 'Request Agent', 'Request Validation & Intake');
      
      this.rarityScores = {
        'AB-': 95, 'O-': 85, 'B-': 80, 'A-': 75,
        'AB+': 45, 'A+': 30, 'B+': 25, 'O+': 20
      };
      
      this.conditionScores = {
        'cardiac_arrest': 98, 'massive_hemorrhage': 95, 'trauma_critical': 92,
        'surgical_emergency': 85, 'postpartum_hemorrhage': 88, 'organ_transplant': 82,
        'dengue_platelet': 70, 'cancer_treatment': 60, 'scheduled_surgery': 40,
        'chronic_anemia': 35, 'routine_transfusion': 25
      };
    }
    
    processRequest(rawRequest, hospitals, bloodGroups) {
      const startTime = Date.now();
      this.setStatus('processing', `Validating request for ${rawRequest.bloodType}`);
      this.log(`Received request from hospital ID: ${rawRequest.hospitalId}`);
      
      try {
        if (!bloodGroups.includes(rawRequest.bloodType)) {
          throw new Error(`Invalid blood type: ${rawRequest.bloodType}`);
        }
        if (!rawRequest.units || rawRequest.units <= 0 || rawRequest.units > 50) {
          throw new Error(`Invalid units requested: ${rawRequest.units}`);
        }
        const hospital = hospitals.find(h => h.id === rawRequest.hospitalId);
        if (!hospital) {
          throw new Error(`Hospital not found: ${rawRequest.hospitalId}`);
        }
        
        const urgencyData = this.classifyUrgency(rawRequest);
        
        const validatedRequest = {
          id: 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          timestamp: new Date().toISOString(),
          hospitalId: rawRequest.hospitalId,
          hospital: hospital,
          bloodType: rawRequest.bloodType,
          units: rawRequest.units,
          condition: rawRequest.condition || 'routine_transfusion',
          deadline: rawRequest.deadline || Date.now() + 24 * 60 * 60 * 1000,
          ...urgencyData
        };
        
        this.log(`Request validated successfully: ${validatedRequest.id} (${urgencyData.emergencyMode})`);
        this.complete(startTime);
        return validatedRequest;
      } catch (error) {
        this.log(`Validation failed: ${error.message}`, 'error');
        this.setStatus('error', 'Validation failed');
        throw error;
      }
    }
    
    classifyUrgency(request) {
      const rarityScore = this.rarityScores[request.bloodType] || 50;
      const conditionScore = this.conditionScores[request.condition] || 25;
      
      // Time pressure score (0-100)
      const hoursToDeadline = (request.deadline - Date.now()) / (1000 * 60 * 60);
      let timeScore = 0;
      if (hoursToDeadline <= 1) timeScore = 100;
      else if (hoursToDeadline <= 4) timeScore = 80;
      else if (hoursToDeadline <= 12) timeScore = 50;
      else if (hoursToDeadline <= 24) timeScore = 20;
      
      // Units score (0-100)
      const unitsScore = Math.min(request.units * 5, 100);
      
      // Weighted total score
      const totalScore = (rarityScore * 0.2) + (conditionScore * 0.4) + (timeScore * 0.3) + (unitsScore * 0.1);
      
      let urgencyLevel, emergencyMode;
      if (totalScore >= 80) {
        urgencyLevel = 'CRITICAL';
        emergencyMode = 'emergency';
      } else if (totalScore >= 60) {
        urgencyLevel = 'HIGH';
        emergencyMode = 'urgent';
      } else if (totalScore >= 40) {
        urgencyLevel = 'MEDIUM';
        emergencyMode = 'routine';
      } else {
        urgencyLevel = 'LOW';
        emergencyMode = 'routine';
      }
      
      return { score: totalScore, urgencyLevel, emergencyMode };
    }
  }

  // ==========================================
  // 2. DiscoveryAgent
  // ==========================================
  class DiscoveryAgent extends BaseAgent {
    constructor() {
      super('discovery-agent', 'Discovery Agent', 'Resource Discovery');
      
      this.compatibilityMatrix = {
        'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        'O+': ['O+', 'A+', 'B+', 'AB+'],
        'A-': ['A-', 'A+', 'AB-', 'AB+'],
        'A+': ['A+', 'AB+'],
        'B-': ['B-', 'B+', 'AB-', 'AB+'],
        'B+': ['B+', 'AB+'],
        'AB-': ['AB-', 'AB+'],
        'AB+': ['AB+']
      };
    }
    
    discoverCandidates(request, bloodBanks, config) {
      const startTime = Date.now();
      this.setStatus('processing', `Discovering candidates for ${request.id}`);
      
      const maxColdChainHours = config.maxColdChainHours || 6;
      const avgSpeedKmh = config.avgSpeedKmh || 40;
      
      let candidates = [];
      
      for (const bank of bloodBanks) {
        let availableCompatibleUnits = 0;
        let compatibleTypes = [];
        
        // Find which blood types the bank has that can be donated to the requested type
        for (const [stockType, amount] of Object.entries(bank.inventory || {})) {
          if (this.checkCompatibility(request.bloodType, stockType)) {
            availableCompatibleUnits += amount;
            if (amount > 0) compatibleTypes.push(stockType);
          }
        }
        
        if (availableCompatibleUnits > 0) {
          const distance = this.haversineDistance(
            request.hospital.lat, request.hospital.lng,
            bank.lat, bank.lng
          );
          
          const estimatedETA = distance / avgSpeedKmh; // in hours
          const coldChainViable = estimatedETA < maxColdChainHours;
          
          if (coldChainViable) {
            candidates.push({
              bloodBank: bank,
              distance: distance,
              estimatedETA: estimatedETA,
              availableUnits: availableCompatibleUnits,
              compatibleTypes: compatibleTypes,
              canFulfillFully: availableCompatibleUnits >= request.units,
              reliabilityScore: bank.reliabilityScore || 0.8,
              coldChainViable: coldChainViable
            });
          }
        }
      }
      
      candidates.sort((a, b) => a.distance - b.distance);
      
      this.log(`Found ${candidates.length} viable candidates`);
      this.complete(startTime);
      return candidates;
    }
    
    checkCompatibility(requestedType, availableType) {
      // availableType is the donor, requestedType is the recipient
      // Check if donor can give to recipient
      return this.compatibilityMatrix[availableType] && 
             this.compatibilityMatrix[availableType].includes(requestedType);
    }
    
    haversineDistance(lat1, lng1, lat2, lng2) {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
  }

  // ==========================================
  // ML Models (Simulated)
  // ==========================================
  class DemandForecastModel {
    predict(daysAhead, region) {
      const predictions = [];
      const base = 50 + Math.random() * 20;
      for (let i = 0; i < daysAhead; i++) {
        const noise = (Math.random() - 0.5) * 10;
        const val = base + noise;
        predictions.push({
          date: new Date(Date.now() + i * 24 * 3600000).toISOString(),
          predicted: Math.round(val),
          lower: Math.round(val * 0.8),
          upper: Math.round(val * 1.2),
          confidence: 0.85
        });
      }
      return predictions;
    }
  }

  class ShortagePredictionModel {
    predict(bloodBank) {
      const totalUnits = Object.values(bloodBank.inventory || {}).reduce((a, b) => a + b, 0);
      const capacity = bloodBank.capacity || 1000;
      const ratio = totalUnits / capacity;
      
      const risk = Math.max(0, 1 - (ratio * 2)); // High risk if below 50% capacity
      const groupRisks = {};
      
      const allTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
      for (const type of allTypes) {
        const amt = (bloodBank.inventory || {})[type] || 0;
        groupRisks[type] = amt < 10 ? 0.9 : (amt < 30 ? 0.5 : 0.1);
      }
      
      return { risk, bloodGroups: groupRisks };
    }
  }

  class ETAForecastModel {
    predict(distance, trafficFactor, timeOfDay) {
      // Base time in hours
      let baseHours = distance / 40.0;
      
      // Apply factors
      let multiplier = 1.0;
      if (trafficFactor === 'heavy') multiplier *= 1.8;
      else if (trafficFactor === 'moderate') multiplier *= 1.3;
      
      if (timeOfDay >= 8 && timeOfDay <= 10) multiplier *= 1.4; // Morning rush
      if (timeOfDay >= 17 && timeOfDay <= 19) multiplier *= 1.5; // Evening rush
      
      return {
        eta: baseHours * multiplier,
        confidence: 0.7 + (Math.random() * 0.2)
      };
    }
  }

  class ReliabilityModel {
    predict(bloodBankId, historicalData) {
      // In a real system, this would use ML on historical fulfillment data
      const base = 0.8;
      const noise = (Math.random() * 0.2) - 0.05;
      return {
        score: Math.min(1, Math.max(0, base + noise)),
        confidence: 0.9
      };
    }
  }

  // ==========================================
  // 3. IntelligenceAgent
  // ==========================================
  class IntelligenceAgent extends BaseAgent {
    constructor() {
      super('intelligence-agent', 'Intelligence Agent', 'Predictive Analytics');
      this.demandModel = new DemandForecastModel();
      this.shortageModel = new ShortagePredictionModel();
      this.etaModel = new ETAForecastModel();
      this.reliabilityModel = new ReliabilityModel();
    }
    
    forecastDemand(daysAhead, region) {
      this.log(`Forecasting demand for ${region} over ${daysAhead} days`);
      return this.demandModel.predict(daysAhead, region);
    }
    
    predictShortages(bloodBanks) {
      this.log(`Predicting shortages for ${bloodBanks.length} blood banks`);
      const shortages = {};
      for (const bank of bloodBanks) {
        shortages[bank.id] = this.shortageModel.predict(bank);
      }
      return shortages;
    }
    
    predictETA(distance, trafficFactor, timeOfDay) {
      return this.etaModel.predict(distance, trafficFactor, timeOfDay);
    }
    
    predictReliability(bloodBankId, historicalData) {
      return this.reliabilityModel.predict(bloodBankId, historicalData);
    }
  }

  // ==========================================
  // 4. CoordinationAgent
  // ==========================================
  class CoordinationAgent extends BaseAgent {
    constructor(optimizationEngine) {
      super('coordination-agent', 'Coordination Agent', 'Resource Optimization');
      this.engine = optimizationEngine; 
    }
    
    optimize(request, candidates, intelligence, emergencyMode) {
      const startTime = Date.now();
      this.setStatus('processing', `Optimizing allocation for ${request.id}`);
      
      if (!candidates || candidates.length === 0) {
        this.log('No candidates available for optimization', 'error');
        this.complete(startTime);
        return [];
      }

      // 1. Build AHP alternatives
      const alternatives = candidates.map(c => {
        const trafficFactor = 'clear'; // Should come from MonitoringAgent in a real system
        const timeOfDay = new Date().getHours();
        
        const etaPrediction = intelligence.etaModel.predict(c.distance, trafficFactor, timeOfDay);
        const relPrediction = intelligence.reliabilityModel.predict(c.bloodBank.id, null);
        const shortPrediction = intelligence.shortageModel.predict(c.bloodBank);
        
        return {
          id: c.bloodBank.id,
          bank: c.bloodBank,
          candidate: c,
          scores: {
            emergencyReady: c.canFulfillFully ? 1.0 : (c.availableUnits / request.units),
            inventoryScore: 1 - shortPrediction.risk,
            travelTimeScore: Math.max(0, 1 - (etaPrediction.eta / 5)), // normalize to 5 hours max
            reliability: relPrediction.score,
            distanceScore: Math.max(0, 1 - (c.distance / 100)) // normalize to 100km max
          }
        };
      });

      // 2. Rank candidates using simple weighted sum (Simulation of AHP)
      let weights = { emergencyReady: 0.2, inventoryScore: 0.2, travelTimeScore: 0.2, reliability: 0.2, distanceScore: 0.2 };
      
      if (emergencyMode === 'emergency') {
        weights = { emergencyReady: 0.3, inventoryScore: 0.1, travelTimeScore: 0.4, reliability: 0.1, distanceScore: 0.1 };
      }
      
      for (const alt of alternatives) {
        alt.finalScore = 
          (alt.scores.emergencyReady * weights.emergencyReady) +
          (alt.scores.inventoryScore * weights.inventoryScore) +
          (alt.scores.travelTimeScore * weights.travelTimeScore) +
          (alt.scores.reliability * weights.reliability) +
          (alt.scores.distanceScore * weights.distanceScore);
      }
      
      alternatives.sort((a, b) => b.finalScore - a.finalScore);
      
      let allocation = [];
      let remainingUnits = request.units;
      
      // 3. Allocate top down
      for (const alt of alternatives) {
        if (remainingUnits <= 0) break;
        
        // 5. Exhaustion guard applied here
        const maxAllowed = Math.floor(alt.candidate.availableUnits * 0.6); // Never take more than 60%
        if (maxAllowed <= 0) continue;
        
        const take = Math.min(remainingUnits, maxAllowed);
        
        allocation.push({
          bloodBank: alt.bank,
          allocatedUnits: take,
          distance: alt.candidate.distance,
          eta: alt.scores.travelTimeScore > 0 ? (5 * (1 - alt.scores.travelTimeScore)) : alt.candidate.estimatedETA
        });
        
        remainingUnits -= take;
      }
      
      if (remainingUnits > 0) {
        this.log(`Could not fully satisfy request. Shortfall: ${remainingUnits} units`, 'alert');
      }
      
      this.complete(startTime);
      return allocation;
    }
    
    optimizeBatch(requests, allCandidates, emergencyMode) {
      // In a real system, NSGA-II would be run here to globally optimize multiple requests.
      // This is a simplified fallback calling single optimize repeatedly.
      const batchAllocation = [];
      for (const req of requests) {
        batchAllocation.push({
          request: req,
          allocation: this.optimize(req, allCandidates, {
            etaModel: new ETAForecastModel(),
            reliabilityModel: new ReliabilityModel(),
            shortageModel: new ShortagePredictionModel()
          }, emergencyMode)
        });
      }
      return batchAllocation;
    }
    
    applyExhaustionGuard(allocation, bloodBanks) {
      // Checks all allocations and ensures no bank is drained below 40% capacity
      // This logic is mostly handled inline in optimize(), but here is the formal method.
      const adjusted = [];
      for (const alloc of allocation) {
        const bank = bloodBanks.find(b => b.id === alloc.bloodBank.id);
        if (!bank) continue;
        
        const totalStock = Object.values(bank.inventory || {}).reduce((a, b) => a + b, 0);
        const capacity = bank.capacity || 1000;
        const stockAfter = totalStock - alloc.allocatedUnits;
        
        if (stockAfter / capacity < 0.4) {
          // Adjust downward
          const maxAllowed = totalStock - (capacity * 0.4);
          if (maxAllowed > 0) {
            adjusted.push({ ...alloc, allocatedUnits: Math.floor(maxAllowed) });
          }
        } else {
          adjusted.push(alloc);
        }
      }
      return adjusted;
    }
  }

  // ==========================================
  // 5. LogisticsAgent
  // ==========================================
  class LogisticsAgent extends BaseAgent {
    constructor(routingConfig) {
      super('logistics-agent', 'Logistics Agent', 'Route Optimization & Tracking');
      this.activeDeliveries = new Map();
      this.routingConfig = routingConfig || { osrmBaseUrl: 'https://router.project-osrm.org/route/v1/driving' };
    }
    
    async fetchOSRMRoute(source, destination) {
      try {
        const url = `${this.routingConfig.osrmBaseUrl}/${source.lng},${source.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
        
        // We'll attempt fetch if in an environment that supports it.
        // If not, we'll gracefully fallback.
        if (typeof fetch !== 'undefined') {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const waypoints = route.geometry.coordinates.map(coord => ({ lng: coord[0], lat: coord[1] }));
              return {
                waypoints: waypoints,
                distance: route.distance / 1000, // m to km
                duration: route.duration / 3600, // s to h
                realRoute: true
              };
            }
          }
        }
      } catch (e) {
        this.log(`OSRM fetch failed: ${e.message}, falling back to generated route`, 'alert');
      }
      
      // Fallback: Generate a smooth curved route
      return this._generateFallbackRoute(source, destination);
    }
    
    _generateFallbackRoute(src, dst) {
      const waypoints = [];
      const numPoints = 20;
      // Add slight curve
      const midLat = (src.lat + dst.lat) / 2 + (Math.random() - 0.5) * 0.05;
      const midLng = (src.lng + dst.lng) / 2 + (Math.random() - 0.5) * 0.05;
      
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Bezier curve interpolation
        const lat = (1-t)*(1-t)*src.lat + 2*(1-t)*t*midLat + t*t*dst.lat;
        const lng = (1-t)*(1-t)*src.lng + 2*(1-t)*t*midLng + t*t*dst.lng;
        waypoints.push({ lat, lng });
      }
      
      // Approx distance
      const distance = Math.sqrt(Math.pow(dst.lat - src.lat, 2) + Math.pow(dst.lng - src.lng, 2)) * 111; // ~km
      return {
        waypoints,
        distance,
        duration: distance / 40.0,
        realRoute: false
      };
    }
    
    async generateDeliveryPlan(allocation, hospital) {
      const startTime = Date.now();
      this.setStatus('processing', 'Generating delivery plans');
      
      const deliveries = [];
      for (const alloc of allocation) {
        const routeData = await this.fetchOSRMRoute(
          { lat: alloc.bloodBank.lat, lng: alloc.bloodBank.lng },
          { lat: hospital.lat, lng: hospital.lng }
        );
        
        const deliveryId = 'DEL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const delivery = {
          id: deliveryId,
          bloodBankId: alloc.bloodBank.id,
          hospitalId: hospital.id,
          units: alloc.allocatedUnits,
          route: routeData,
          status: 'pending',
          progress: 0, // 0 to 1
          currentLocation: routeData.waypoints[0],
          startTime: null,
          etaHours: routeData.duration
        };
        deliveries.push(delivery);
      }
      
      this.complete(startTime);
      return deliveries;
    }
    
    startTracking(deliveryId, deliveryData) {
      deliveryData.status = 'in_transit';
      deliveryData.startTime = Date.now();
      this.activeDeliveries.set(deliveryId, deliveryData);
      this.log(`Started tracking delivery ${deliveryId}`);
      if (this.eventBus) this.eventBus.emit('logistics:dispatched', deliveryData);
    }
    
    updateVehiclePosition(deliveryId) {
      const delivery = this.activeDeliveries.get(deliveryId);
      if (!delivery || delivery.status !== 'in_transit') return;
      
      // Advance progress (simulate speed)
      delivery.progress += 0.05; // 5% per tick for simulation
      
      if (delivery.progress >= 1.0) {
        delivery.progress = 1.0;
        delivery.status = 'delivered';
        delivery.currentLocation = delivery.route.waypoints[delivery.route.waypoints.length - 1];
        this.log(`Delivery ${deliveryId} completed`);
        if (this.eventBus) this.eventBus.emit('logistics:delivered', delivery);
        this.activeDeliveries.delete(deliveryId);
      } else {
        // Interpolate position along waypoints
        const totalPoints = delivery.route.waypoints.length;
        const currentFloatIdx = delivery.progress * (totalPoints - 1);
        const idx1 = Math.floor(currentFloatIdx);
        const idx2 = Math.ceil(currentFloatIdx);
        
        if (idx1 === idx2) {
          delivery.currentLocation = delivery.route.waypoints[idx1];
        } else {
          const p1 = delivery.route.waypoints[idx1];
          const p2 = delivery.route.waypoints[idx2];
          const factor = currentFloatIdx - idx1;
          
          delivery.currentLocation = {
            lat: p1.lat + (p2.lat - p1.lat) * factor,
            lng: p1.lng + (p2.lng - p1.lng) * factor
          };
        }
      }
    }
    
    checkReroute(deliveryId, trafficConditions) {
      // In a full simulation, we'd map current location to traffic segments.
      // Here, we randomly trigger replanning based on simulated global traffic state.
      const delivery = this.activeDeliveries.get(deliveryId);
      if (!delivery) return false;
      
      // Simulated: 5% chance of needing reroute due to heavy traffic
      if (Math.random() < 0.05) {
        this.log(`Rerouting needed for delivery ${deliveryId} due to traffic conditions`, 'alert');
        // We would call fetchOSRMRoute again from currentLocation to destination.
        return true;
      }
      return false;
    }
  }

  // ==========================================
  // 6. MonitoringAgent
  // ==========================================
  class MonitoringAgent extends BaseAgent {
    constructor() {
      super('monitoring-agent', 'Monitoring Agent', 'System Monitoring & Replanning');
      this.trafficConditions = new Map();
      this.alerts = [];
    }
    
    monitorSystem(bloodBanks, activeDeliveries, config) {
      this.setStatus('active', 'Monitoring system');
      this.updateTraffic();
      this.monitorInventory(bloodBanks, ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']);
      this.checkReplanning(activeDeliveries, this.trafficConditions);
    }
    
    updateTraffic() {
      // Simulate random traffic on hypothetical segments
      for (let i = 0; i < 5; i++) {
        const segId = `SEG-${i}`;
        const states = ['clear', 'moderate', 'heavy', 'blocked'];
        const state = states[Math.floor(Math.random() * states.length)];
        
        let speed = 1.0;
        let delay = 0;
        if (state === 'moderate') { speed = 0.7; delay = 5; }
        if (state === 'heavy') { speed = 0.4; delay = 15; }
        if (state === 'blocked') { speed = 0.1; delay = 30; }
        
        this.trafficConditions.set(segId, {
          speed,
          congestion: state,
          delay,
          risk: state === 'blocked' ? 1.0 : (state === 'heavy' ? 0.6 : 0.1)
        });
      }
    }
    
    checkReplanning(activeDeliveries, trafficConditions) {
      let needsReplanningCount = 0;
      for (const [id, del] of activeDeliveries.entries()) {
        // If traffic is heavy or blocked, trigger replan event
        const randSeg = Array.from(trafficConditions.values())[Math.floor(Math.random() * trafficConditions.size)];
        if (randSeg && (randSeg.congestion === 'heavy' || randSeg.congestion === 'blocked') && Math.random() < 0.1) {
          this.log(`Delivery ${id} affected by severe traffic. Replanning suggested.`, 'alert');
          if (this.eventBus) this.eventBus.emit('monitoring:replan_requested', { deliveryId: id });
          needsReplanningCount++;
        }
      }
      return needsReplanningCount > 0;
    }
    
    monitorInventory(bloodBanks, bloodGroups) {
      for (const bank of bloodBanks) {
        const capacity = bank.capacity || 1000;
        let total = 0;
        
        for (const grp of bloodGroups) {
          const amt = (bank.inventory || {})[grp] || 0;
          total += amt;
          if (amt < 10) {
            this.log(`Critical shortage of ${grp} at ${bank.name}`, 'error');
            this.alerts.push({ type: 'inventory', severity: 'critical', bankId: bank.id, group: grp });
          }
        }
        
        if (total / capacity < 0.2) {
          this.log(`Overall capacity critical at ${bank.name} (<20%)`, 'error');
          if (this.eventBus) this.eventBus.emit('monitoring:inventory_alert', { bankId: bank.id, level: total/capacity });
        }
      }
    }
  }

  // ==========================================
  // 7. AgentOrchestrator
  // ==========================================
  class AgentOrchestrator {
    constructor(config) {
      this.config = config || {};
      this.eventBus = new EventBus();
      this.bloodBanks = [];
      this.hospitals = [];
      this.activeEmergencies = [];
      this.completedEmergencies = [];
      this.simulationRunning = false;
      this.simInterval = null;
      
      this.agents = {
        request: new RequestAgent(),
        discovery: new DiscoveryAgent(),
        intelligence: new IntelligenceAgent(),
        coordination: new CoordinationAgent(null), 
        logistics: new LogisticsAgent(this.config.routing),
        monitoring: new MonitoringAgent()
      };
      
      Object.values(this.agents).forEach(a => {
        a.eventBus = this.eventBus;
      });
      
      this.setupEventHandlers();
    }
    
    setupEventHandlers() {
      this.eventBus.on('logistics:delivered', (delivery) => {
        // Find emergency and update state
        const emIdx = this.activeEmergencies.findIndex(e => e.deliveries && e.deliveries.some(d => d.id === delivery.id));
        if (emIdx > -1) {
          const em = this.activeEmergencies[emIdx];
          const allDone = em.deliveries.every(d => d.status === 'delivered' || d.id === delivery.id);
          if (allDone) {
            em.status = 'completed';
            this.completedEmergencies.push(em);
            this.activeEmergencies.splice(emIdx, 1);
            this.eventBus.emit('orchestrator:emergency_completed', em);
          }
        }
      });
    }
    
    initializeInventory(bloodBanks, bloodGroups, distribution) {
      this.bloodBanks = bloodBanks.map(b => {
        const inventory = {};
        let total = 0;
        bloodGroups.forEach(grp => {
          // Base amount + random variation
          const base = (distribution[grp] || 0.125) * b.capacity;
          const amt = Math.floor(base * (0.5 + Math.random()));
          inventory[grp] = amt;
          total += amt;
        });
        return { ...b, inventory, totalStock: total };
      });
    }
    
    async handleEmergency(rawRequest) {
      try {
        // 1. Request Validation
        const validatedReq = this.agents.request.processRequest(rawRequest, this.hospitals, Object.keys(this.agents.discovery.compatibilityMatrix));
        this.eventBus.emit('request:validated', validatedReq);
        
        // 2. Discovery
        const candidates = this.agents.discovery.discoverCandidates(validatedReq, this.bloodBanks, this.config);
        this.eventBus.emit('discovery:complete', { requestId: validatedReq.id, candidates });
        
        // 3. Intelligence
        this.agents.intelligence.setStatus('active', 'Analyzing candidates');
        this.eventBus.emit('intelligence:analyzed', { requestId: validatedReq.id });
        this.agents.intelligence.setStatus('idle');
        
        // 4. Coordination Optimization
        const allocation = this.agents.coordination.optimize(validatedReq, candidates, this.agents.intelligence, validatedReq.emergencyMode);
        this.eventBus.emit('coordination:optimized', { requestId: validatedReq.id, allocation });
        
        // Apply deductions to inventory locally
        for (const alloc of allocation) {
          const bank = this.bloodBanks.find(b => b.id === alloc.bloodBank.id);
          if (bank) {
            // Simplistic deduction from compatible types starting with exact match
            let needed = alloc.allocatedUnits;
            if (bank.inventory[validatedReq.bloodType] >= needed) {
              bank.inventory[validatedReq.bloodType] -= needed;
            } else {
              // Deduct whatever we can from exact match
              let avail = bank.inventory[validatedReq.bloodType] || 0;
              needed -= avail;
              bank.inventory[validatedReq.bloodType] = 0;
              // Then deduct from compatible universal (e.g. O-)
              if (needed > 0 && bank.inventory['O-'] >= needed) {
                bank.inventory['O-'] -= needed;
              }
            }
          }
        }

        // 5. Logistics Routing & Tracking
        const deliveries = await this.agents.logistics.generateDeliveryPlan(allocation, validatedReq.hospital);
        
        for (const d of deliveries) {
          this.agents.logistics.startTracking(d.id, d);
        }
        
        const emergencyRecord = { request: validatedReq, allocation, deliveries, status: 'active' };
        this.activeEmergencies.push(emergencyRecord);
        
        // 6. Monitoring starts implicitly as tick runs
        this.eventBus.emit('monitoring:tracking', { requestId: validatedReq.id });
        
        return emergencyRecord;
      } catch (err) {
        console.error('Emergency handling failed:', err);
        this.eventBus.emit('orchestrator:emergency_failed', { request: rawRequest, error: err.message });
        throw err;
      }
    }
    
    start() {
      if (this.simulationRunning) return;
      this.simulationRunning = true;
      this.simInterval = setInterval(() => this.simulateTick(), this.config.tickRateMs || 2000);
      console.log('Agent Orchestrator Simulation Started');
    }
    
    stop() {
      this.simulationRunning = false;
      if (this.simInterval) clearInterval(this.simInterval);
      console.log('Agent Orchestrator Simulation Stopped');
    }
    
    simulateTick() {
      if (!this.simulationRunning) return;
      
      this.agents.monitoring.monitorSystem(this.bloodBanks, this.agents.logistics.activeDeliveries, this.config);
      
      // Update vehicle positions
      for (const id of this.agents.logistics.activeDeliveries.keys()) {
        this.agents.logistics.updateVehiclePosition(id);
      }
    }
    
    simulateInventoryFlux() {
      const types = Object.keys(this.agents.discovery.compatibilityMatrix);
      for (const bank of this.bloodBanks) {
        // Random consumption (1-3)
        if (Math.random() < 0.3) {
          const type = types[Math.floor(Math.random() * types.length)];
          const amount = Math.floor(Math.random() * 3) + 1;
          if (bank.inventory[type] >= amount) {
            bank.inventory[type] -= amount;
          }
        }
        // Random donations (0-2)
        if (Math.random() < 0.2) {
          const type = types[Math.floor(Math.random() * types.length)];
          const amount = Math.floor(Math.random() * 3);
          if (bank.inventory[type] !== undefined) {
            bank.inventory[type] += amount;
          }
        }
      }
    }
    
    getMetrics() {
      return {
        activeEmergencies: this.activeEmergencies.length,
        completedEmergencies: this.completedEmergencies.length,
        activeDeliveries: this.agents.logistics.activeDeliveries.size
      };
    }
    
    getAgentStatuses() {
      const statuses = {};
      for (const [key, agent] of Object.entries(this.agents)) {
        statuses[key] = agent.toJSON();
      }
      return statuses;
    }
  }

  // Export module based on environment (UMD pattern)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      EventBus,
      BaseAgent,
      RequestAgent,
      DiscoveryAgent,
      IntelligenceAgent,
      CoordinationAgent,
      LogisticsAgent,
      MonitoringAgent,
      AgentOrchestrator,
      DemandForecastModel,
      ShortagePredictionModel,
      ETAForecastModel,
      ReliabilityModel
    };
  } else {
    root.EventBus = EventBus;
    root.BaseAgent = BaseAgent;
    root.RequestAgent = RequestAgent;
    root.DiscoveryAgent = DiscoveryAgent;
    root.IntelligenceAgent = IntelligenceAgent;
    root.CoordinationAgent = CoordinationAgent;
    root.LogisticsAgent = LogisticsAgent;
    root.MonitoringAgent = MonitoringAgent;
    root.AgentOrchestrator = AgentOrchestrator;
  }

})(typeof self !== 'undefined' ? self : this);
