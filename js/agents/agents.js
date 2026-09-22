// ================================================================
// RaktaSetu — Agent System
// Central Orchestrator + 5 Specialized Agents
// Uses Orchestrator-Worker pattern with event-driven communication
// ================================================================

// ── Base Agent Class ────────────────────────────────
class BaseAgent {
  constructor(id, name, role, icon, color) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.icon = icon;
    this.color = color;
    this.status = 'idle'; // idle, active, processing, alert
    this.currentTask = null;
    this.taskQueue = [];
    this.log = [];
    this.metrics = { tasksCompleted: 0, avgResponseTime: 0, lastActive: null };
  }

  addLog(message, type = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      type, // info, success, warning, error
      agentId: this.id,
      agentName: this.name
    };
    this.log.unshift(entry);
    if (this.log.length > 50) this.log.pop();
    return entry;
  }

  setStatus(status, task = null) {
    this.status = status;
    this.currentTask = task;
    if (status === 'active' || status === 'processing') {
      this.metrics.lastActive = new Date().toISOString();
    }
  }

  completeTask() {
    this.metrics.tasksCompleted++;
    this.setStatus('active');
    this.currentTask = null;
  }
}

// ── Inventory Agent ─────────────────────────────────
class InventoryAgent extends BaseAgent {
  constructor() {
    super('inv-agent', 'Inventory Agent', 'Stock Monitoring & Alerts', Helpers.icon('inventory'), '#00897b');
    this.alertThresholds = { critical: 0.2, low: 0.4, expiry: 3 }; // days
    this.alerts = [];
  }

  monitor(bloodBanks) {
    this.setStatus('processing', 'Scanning inventory levels');
    const alerts = [];

    bloodBanks.forEach(bb => {
      let totalStock = 0;
      let totalCapacity = 0;

      BLOOD_GROUPS.forEach(group => {
        const inv = bb.inventory[group];
        totalStock += inv.units;
        totalCapacity += inv.capacity;

        // Check critical levels
        const ratio = inv.units / inv.capacity;
        if (ratio < this.alertThresholds.critical) {
          alerts.push({
            type: 'CRITICAL_STOCK',
            severity: 'critical',
            bloodBank: bb.name,
            bloodBankId: bb.id,
            city: bb.city,
            bloodGroup: group,
            currentStock: inv.units,
            capacity: inv.capacity,
            message: `CRITICAL: ${group} at ${bb.name} — only ${inv.units} units (${Math.round(ratio * 100)}% capacity)`,
            timestamp: new Date().toISOString()
          });
        } else if (ratio < this.alertThresholds.low) {
          alerts.push({
            type: 'LOW_STOCK',
            severity: 'warning',
            bloodBank: bb.name,
            bloodBankId: bb.id,
            city: bb.city,
            bloodGroup: group,
            currentStock: inv.units,
            capacity: inv.capacity,
            message: `LOW: ${group} at ${bb.name} — ${inv.units} units (${Math.round(ratio * 100)}% capacity)`,
            timestamp: new Date().toISOString()
          });
        }

        // Check expiry
        if (inv.expiringIn3Days > 2) {
          alerts.push({
            type: 'EXPIRY_WARNING',
            severity: 'warning',
            bloodBank: bb.name,
            bloodBankId: bb.id,
            bloodGroup: group,
            expiringUnits: inv.expiringIn3Days,
            message: `EXPIRY: ${inv.expiringIn3Days} units of ${group} at ${bb.name} expiring within 3 days`,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Overall utilization
      bb.utilizationRate = totalStock / totalCapacity;
    });

    this.alerts = alerts;
    this.addLog(`Scanned ${bloodBanks.length} blood banks — found ${alerts.filter(a => a.severity === 'critical').length} critical, ${alerts.filter(a => a.severity === 'warning').length} warnings`, alerts.length > 0 ? 'warning' : 'success');
    this.completeTask();
    return alerts;
  }

  suggestTransfers(bloodBanks) {
    this.setStatus('processing', 'Calculating transfer recommendations');
    const transfers = [];

    // Find surplus and deficit banks per blood group
    BLOOD_GROUPS.forEach(group => {
      const surplus = bloodBanks
        .filter(bb => {
          const inv = bb.inventory[group];
          return (inv.units / inv.capacity) > 0.7;
        })
        .sort((a, b) => b.inventory[group].units - a.inventory[group].units);

      const deficit = bloodBanks
        .filter(bb => {
          const inv = bb.inventory[group];
          return (inv.units / inv.capacity) < 0.3;
        })
        .sort((a, b) => a.inventory[group].units - b.inventory[group].units);

      if (surplus.length > 0 && deficit.length > 0) {
        const from = surplus[0];
        const to = deficit[0];
        const distance = Helpers.haversineDistance(from.lat, from.lng, to.lat, to.lng);
        
        if (distance < 500) { // Only suggest within 500km
          const transferUnits = Math.min(
            Math.floor(from.inventory[group].units * 0.3),
            to.inventory[group].capacity - to.inventory[group].units
          );

          if (transferUnits > 2) {
            transfers.push({
              bloodGroup: group,
              from: { id: from.id, name: from.name, city: from.city, stock: from.inventory[group].units },
              to: { id: to.id, name: to.name, city: to.city, stock: to.inventory[group].units },
              units: transferUnits,
              distance: Math.round(distance),
              eta: Helpers.formatDuration(Helpers.estimateTravelTime(distance))
            });
          }
        }
      }
    });

    this.addLog(`Generated ${transfers.length} transfer recommendations`, 'info');
    this.completeTask();
    return transfers;
  }
}

// ── Demand Forecasting Agent ────────────────────────
class DemandForecastAgent extends BaseAgent {
  constructor() {
    super('demand-agent', 'Demand Agent', 'ML-Powered Forecasting', Helpers.icon('activity'), '#3f51b5');
    this.predictor = new DemandPredictor();
    this.latestForecast = null;
  }

  generateForecast(daysAhead = 7) {
    this.setStatus('processing', `Generating ${daysAhead}-day forecast`);
    this.latestForecast = this.predictor.predict(daysAhead);
    this.addLog(`Generated ${daysAhead}-day demand forecast — avg predicted: ${Math.round(this.latestForecast.reduce((s, p) => s + p.predicted, 0) / this.latestForecast.length)} units/day`, 'success');
    this.completeTask();
    return this.latestForecast;
  }

  getHistoricalData() {
    return this.predictor.historicalData;
  }

  getSeasonalAnalysis() {
    return this.predictor.getSeasonalAnalysis();
  }

  getModelMetrics() {
    return this.predictor.getModelMetrics();
  }

  getRegionalDemand() {
    return this.predictor.getRegionalDemand();
  }
}

// ── Routing Agent ───────────────────────────────────
class RoutingAgent extends BaseAgent {
  constructor() {
    super('route-agent', 'Routing Agent', 'Route Optimization', Helpers.icon('truck'), '#e65100');
    this.optimizer = new RouteOptimizer();
    this.activeRoutes = [];
  }

  findRoute(request, bloodBanks) {
    this.setStatus('processing', `Finding optimal route to ${request.hospitalName}`);
    const result = this.optimizer.findOptimalSource(request, bloodBanks);
    
    if (result.type === 'single_source') {
      this.addLog(`Optimal source: ${result.primary.bloodBank.name} (${result.primary.distance}km, ETA: ${result.primary.travelTimeFormatted})`, 'success');
      this.activeRoutes.push({
        id: Helpers.generateId(),
        ...result,
        request,
        status: 'dispatched',
        startTime: new Date().toISOString()
      });
    } else if (result.type === 'multi_source') {
      this.addLog(`Multi-source solution: ${result.sources.length} banks will contribute`, 'warning');
    } else {
      this.addLog(`Partial fulfillment only — shortfall of ${result.shortfall} units`, 'error');
    }

    this.completeTask();
    return result;
  }
}

// ── Emergency Response Agent ────────────────────────
class EmergencyAgent extends BaseAgent {
  constructor() {
    super('emg-agent', 'Emergency Agent', 'Emergency Response & Dispatch', Helpers.icon('alert'), '#c62828');
    this.classifier = new UrgencyClassifier();
    this.activeEmergencies = [];
    this.completedEmergencies = [];
  }

  processRequest(request) {
    this.setStatus('alert', `Processing emergency from ${request.hospitalName}`);

    // Step 1: Classify urgency
    const classification = this.classifier.classify({
      bloodType: request.bloodType,
      units: request.units,
      condition: request.condition,
      timeWindowHours: request.timeWindowHours || 2,
      stockLevel: request.nearbyStockLevel || 50
    });

    const emergency = {
      id: Helpers.generateId(),
      ...request,
      classification,
      status: 'processing',
      pipeline: [
        { step: 'Received', status: 'completed', time: new Date().toISOString() },
        { step: 'Classified', status: 'completed', time: new Date().toISOString() },
        { step: 'Source Found', status: 'pending', time: null },
        { step: 'Dispatched', status: 'pending', time: null },
        { step: 'In Transit', status: 'pending', time: null },
        { step: 'Delivered', status: 'pending', time: null }
      ],
      createdAt: new Date().toISOString()
    };

    this.activeEmergencies.unshift(emergency);
    this.addLog(`Emergency ${classification.classification}: ${request.units} units ${request.bloodType} for ${request.hospitalName} — Score: ${classification.score}`, 
      classification.classification === 'CRITICAL' ? 'error' : 'warning');
    
    return emergency;
  }

  updateEmergencyStatus(emergencyId, stepIndex, status) {
    const emg = this.activeEmergencies.find(e => e.id === emergencyId);
    if (emg) {
      emg.pipeline[stepIndex].status = status;
      emg.pipeline[stepIndex].time = new Date().toISOString();
      
      if (stepIndex === 3) emg.status = 'dispatched';
      if (stepIndex === 4) emg.status = 'in_transit';
      if (stepIndex === 5) {
        emg.status = 'delivered';
        this.completedEmergencies.unshift(emg);
        this.activeEmergencies = this.activeEmergencies.filter(e => e.id !== emergencyId);
        this.addLog(`Delivery completed: ${emg.bloodType} to ${emg.hospitalName}`, 'success');
      }
    }
    this.completeTask();
    return emg;
  }
}

// ── Quality & Compliance Agent ──────────────────────
class QualityAgent extends BaseAgent {
  constructor() {
    super('quality-agent', 'Quality Agent', 'Quality & Cold Chain Compliance', Helpers.icon('shield'), '#1565c0');
    this.auditLog = [];
    this.complianceScore = 94;
  }

  runAudit(bloodBanks) {
    this.setStatus('processing', 'Running quality audit');
    const issues = [];
    let totalChecks = 0;
    let passedChecks = 0;

    bloodBanks.forEach(bb => {
      totalChecks += 4;

      // Check 1: License status
      if (bb.license) passedChecks++;
      else issues.push({ bank: bb.name, issue: 'Missing license', severity: 'critical' });

      // Check 2: Operating status
      if (bb.status === 'operational') passedChecks++;
      else issues.push({ bank: bb.name, issue: 'Limited operations', severity: 'warning' });

      // Check 3: Expiry management
      let totalExpiring = 0;
      BLOOD_GROUPS.forEach(g => { totalExpiring += bb.inventory[g].expiringIn3Days; });
      if (totalExpiring < 10) passedChecks++;
      else issues.push({ bank: bb.name, issue: `${totalExpiring} units near expiry`, severity: 'warning' });

      // Check 4: Capacity utilization
      if (bb.utilizationRate > 0.25) passedChecks++;
      else issues.push({ bank: bb.name, issue: 'Critically low utilization', severity: 'critical' });
    });

    this.complianceScore = Math.round((passedChecks / totalChecks) * 100);
    
    const audit = {
      timestamp: new Date().toISOString(),
      totalChecks,
      passedChecks,
      failedChecks: totalChecks - passedChecks,
      complianceScore: this.complianceScore,
      issues
    };

    this.auditLog.unshift(audit);
    this.addLog(`Audit complete — ${this.complianceScore}% compliance, ${issues.length} issues found`, 
      this.complianceScore >= 90 ? 'success' : 'warning');
    this.completeTask();
    return audit;
  }

  validateColdChain(route) {
    this.setStatus('processing', 'Validating cold chain integrity');
    const travelHours = route.travelTime || 1;
    const isValid = travelHours <= 4; // 4-hour max for whole blood
    const temperatureRange = { min: 2, max: 6, unit: '°C' };
    
    this.addLog(`Cold chain ${isValid ? 'VALID' : 'AT RISK'} — ${Helpers.formatDuration(travelHours)} transit (max 4h)`, 
      isValid ? 'success' : 'error');
    this.completeTask();
    
    return { isValid, travelHours, temperatureRange, maxAllowedHours: 4 };
  }
}

// ── Central Orchestrator ────────────────────────────
class Orchestrator {
  constructor() {
    this.agents = {
      inventory: new InventoryAgent(),
      demand: new DemandForecastAgent(),
      routing: new RoutingAgent(),
      emergency: new EmergencyAgent(),
      quality: new QualityAgent()
    };

    this.eventLog = [];
    this.messageQueue = [];
    this.isRunning = false;
    this.simulationInterval = null;
    this.bloodBanks = initializeBloodBanks();
    this.onUpdate = null; // callback for UI updates
  }

  // Start the orchestration loop
  start(updateCallback) {
    this.onUpdate = updateCallback;
    this.isRunning = true;

    // Initial runs
    this.agents.inventory.monitor(this.bloodBanks);
    this.agents.demand.generateForecast(7);
    this.agents.quality.runAudit(this.bloodBanks);

    this.log('Orchestrator started — all agents initialized');

    // Simulation loop: agents run periodically
    this.simulationInterval = setInterval(() => {
      this.tick();
    }, 8000);

    // More frequent inventory simulation
    this.inventoryInterval = setInterval(() => {
      this.simulateInventoryChanges();
    }, 15000);

    if (this.onUpdate) this.onUpdate();
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.simulationInterval);
    clearInterval(this.inventoryInterval);
    this.log('Orchestrator stopped');
  }

  // Main tick — agents perform their periodic tasks
  tick() {
    if (!this.isRunning) return;

    // Rotate through agent activities
    const actions = [
      () => {
        this.agents.inventory.monitor(this.bloodBanks);
        this.log('Inventory scan completed');
      },
      () => {
        const transfers = this.agents.inventory.suggestTransfers(this.bloodBanks);
        if (transfers.length > 0) {
          this.log(`${transfers.length} transfer recommendations generated`);
        }
      },
      () => {
        this.agents.demand.generateForecast(7);
        this.log('Demand forecast updated');
      },
      () => {
        this.agents.quality.runAudit(this.bloodBanks);
        this.log('Quality audit completed');
      },
      () => {
        // Simulate random emergency
        if (Math.random() > 0.6) {
          this.simulateEmergency();
        }
      }
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    action();

    if (this.onUpdate) this.onUpdate();
  }

  // Simulate inventory fluctuations
  simulateInventoryChanges() {
    this.bloodBanks.forEach(bb => {
      BLOOD_GROUPS.forEach(group => {
        const inv = bb.inventory[group];
        // Random consumption (1-3 units)
        const consumed = Helpers.randomInt(0, 3);
        inv.units = Math.max(1, inv.units - consumed);
        
        // Random donations (0-2 units)
        if (Math.random() > 0.4) {
          const donated = Helpers.randomInt(0, 2);
          inv.units = Math.min(inv.capacity, inv.units + donated);
        }

        // Update expiry counts
        if (Math.random() > 0.8) {
          inv.expiringIn3Days = Math.max(0, inv.expiringIn3Days + Helpers.randomInt(-1, 1));
        }

        inv.lastUpdated = new Date().toISOString();
      });
    });
  }

  // Simulate emergency request
  simulateEmergency() {
    const hospital = Helpers.randomChoice(HOSPITALS);
    const conditions = ['trauma_critical', 'surgical_emergency', 'postpartum_hemorrhage', 'dengue_platelet', 'cancer_treatment', 'chronic_anemia'];
    
    const request = {
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      city: hospital.city,
      destinationLat: hospital.lat,
      destinationLng: hospital.lng,
      bloodType: Helpers.randomChoice(BLOOD_GROUPS),
      units: Helpers.randomInt(2, 8),
      condition: Helpers.randomChoice(conditions),
      timeWindowHours: Helpers.randomChoice([0.5, 1, 2, 4]),
      department: Helpers.randomChoice(hospital.departments)
    };

    return this.handleEmergency(request);
  }

  // Full emergency pipeline
  handleEmergency(request) {
    this.log(`Emergency request: ${request.units} units ${request.bloodType} for ${request.hospitalName}`);

    // Step 1: Emergency agent classifies
    const emergency = this.agents.emergency.processRequest(request);

    // Step 2: Routing agent finds optimal source
    const route = this.agents.routing.findRoute(request, this.bloodBanks);
    emergency.route = route;

    // Step 3: Update pipeline status
    setTimeout(() => {
      this.agents.emergency.updateEmergencyStatus(emergency.id, 2, 'completed');
      this.log(`Source found for ${request.hospitalName}`);
      if (this.onUpdate) this.onUpdate();
    }, 2000);

    setTimeout(() => {
      this.agents.emergency.updateEmergencyStatus(emergency.id, 3, 'completed');
      this.log(`Blood dispatched to ${request.hospitalName}`);
      
      // Quality validates cold chain
      if (route.type === 'single_source' && route.primary) {
        this.agents.quality.validateColdChain(route.primary);
      }
      if (this.onUpdate) this.onUpdate();
    }, 5000);

    setTimeout(() => {
      this.agents.emergency.updateEmergencyStatus(emergency.id, 4, 'completed');
      if (this.onUpdate) this.onUpdate();
    }, 10000);

    setTimeout(() => {
      this.agents.emergency.updateEmergencyStatus(emergency.id, 5, 'completed');
      this.log(`Delivery completed: ${request.bloodType} to ${request.hospitalName}`);
      if (this.onUpdate) this.onUpdate();
    }, 18000);

    if (this.onUpdate) this.onUpdate();
    return emergency;
  }

  log(message) {
    this.eventLog.unshift({
      timestamp: new Date().toISOString(),
      message,
      id: Helpers.generateId()
    });
    if (this.eventLog.length > 100) this.eventLog.pop();
  }

  // Get all agent statuses for UI
  getAgentStatuses() {
    return Object.values(this.agents).map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      icon: agent.icon,
      color: agent.color,
      status: agent.status,
      currentTask: agent.currentTask,
      tasksCompleted: agent.metrics.tasksCompleted,
      lastActive: agent.metrics.lastActive,
      logCount: agent.log.length,
      recentLogs: agent.log.slice(0, 5)
    }));
  }

  // Get aggregate metrics
  getMetrics() {
    let totalUnits = 0;
    let totalCapacity = 0;
    let criticalBanks = 0;

    this.bloodBanks.forEach(bb => {
      BLOOD_GROUPS.forEach(group => {
        totalUnits += bb.inventory[group].units;
        totalCapacity += bb.inventory[group].capacity;
      });
      if (bb.utilizationRate < 0.3) criticalBanks++;
    });

    return {
      totalUnits,
      totalCapacity,
      supplyHealth: Math.round((totalUnits / totalCapacity) * 100),
      activeBanks: this.bloodBanks.filter(bb => bb.status === 'operational').length,
      totalBanks: this.bloodBanks.length,
      criticalBanks,
      activeEmergencies: this.agents.emergency.activeEmergencies.length,
      completedToday: this.agents.emergency.completedEmergencies.length,
      pendingAlerts: this.agents.inventory.alerts.filter(a => a.severity === 'critical').length,
      complianceScore: this.agents.quality.complianceScore,
      agentTasks: Object.values(this.agents).reduce((sum, a) => sum + a.metrics.tasksCompleted, 0)
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Orchestrator;
}
