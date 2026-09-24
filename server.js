const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load configurations
const configPath = path.join(__dirname, 'config');
const systemConfig = JSON.parse(fs.readFileSync(path.join(configPath, 'system.json'), 'utf8'));
const bloodBanksData = JSON.parse(fs.readFileSync(path.join(configPath, 'bloodBanks.json'), 'utf8'));
const hospitalsData = JSON.parse(fs.readFileSync(path.join(configPath, 'hospitals.json'), 'utf8'));

// Import our new AI Engine layers
const { OptimizationEngine } = require('./js/optimization/optimizationEngine.js');
const { AgentOrchestrator } = require('./js/agents/agentSystem.js');
const { PredictionService } = require('./js/ml/predictionService.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// ── Initialize the AI Multi-Agent System ──
const orchestrator = new AgentOrchestrator(systemConfig);

// Inject ML Prediction service into Intelligence agent
orchestrator.agents.intelligence.demandModel = new PredictionService().demandModel;
orchestrator.agents.intelligence.shortageModel = new PredictionService().shortageModel;
orchestrator.agents.intelligence.etaModel = new PredictionService().etaModel;
orchestrator.agents.intelligence.reliabilityModel = new PredictionService().reliabilityModel;

// Inject Optimization Engine into Coordination agent
const optimizationEngine = new OptimizationEngine({
  ahp: systemConfig.optimization.ahp,
  nsga2: systemConfig.optimization.nsga2,
  routing: systemConfig.routing
});
orchestrator.agents.coordination.engine = optimizationEngine;

// Initialize data
orchestrator.initializeInventory(bloodBanksData, systemConfig.bloodGroups, systemConfig.bloodGroupDistribution);
orchestrator.hospitals = hospitalsData;

// Start the autonomous simulation loop
orchestrator.start();


// ── SSE Streams ──
let sseClients = [];

// Broadcast an event to all connected dashboard clients
function broadcastEvent(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
        try {
            client.res.write(payload);
        } catch (e) {
            // client disconnected
        }
    });
}

// Wire the Agent EventBus to the SSE Stream
orchestrator.eventBus.on('request:validated', data => broadcastEvent('agent_log', { agent: 'RequestAgent', ...data }));
orchestrator.eventBus.on('discovery:complete', data => broadcastEvent('agent_log', { agent: 'DiscoveryAgent', ...data }));
orchestrator.eventBus.on('intelligence:analyzed', data => broadcastEvent('agent_log', { agent: 'IntelligenceAgent', ...data }));
orchestrator.eventBus.on('coordination:optimized', data => broadcastEvent('agent_log', { agent: 'CoordinationAgent', ...data }));
orchestrator.eventBus.on('logistics:dispatched', data => broadcastEvent('agent_log', { agent: 'LogisticsAgent', ...data }));
orchestrator.eventBus.on('monitoring:tracking', data => broadcastEvent('agent_log', { agent: 'MonitoringAgent', ...data }));
orchestrator.eventBus.on('logistics:arrived', data => broadcastEvent('agent_log', { agent: 'LogisticsAgent', ...data }));

// Broadcast metrics periodically
setInterval(() => {
    broadcastEvent('metrics_update', orchestrator.getMetrics());
    broadcastEvent('agent_status', orchestrator.getAgentStatuses());
    
    const activeDeliveries = Array.from(orchestrator.agents.logistics.activeDeliveries.values());
    if (activeDeliveries.length > 0) {
        broadcastEvent('vehicle_positions', activeDeliveries);
    }
}, 8000);


// ── Routes & Endpoints ──

app.get(['/', '/dashboard'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push({ id: Date.now(), res });
    
    // Send initial state
    res.write(`event: connected\ndata: {"status":"connected"}\n\n`);
    res.write(`event: agent_status\ndata: ${JSON.stringify(orchestrator.getAgentStatuses())}\n\n`);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c.res !== res);
    });
});

app.get('/api/config', (req, res) => {
    res.json({ system: systemConfig, bloodBanks: orchestrator.bloodBanks, hospitals: orchestrator.hospitals });
});

app.get('/api/dashboard', (req, res) => {
    res.json(orchestrator.getMetrics());
});

app.get('/api/research/benchmark', (req, res) => {
    const resultsDir = path.join(__dirname, 'research', 'results');
    const readJsonSafe = (file) => {
        try {
            return JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
        } catch (e) {
            return null;
        }
    };
    res.json({
        title: "MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR",
        status: "empirical_evaluation_complete",
        sections: {
            section_a_forecasting: readJsonSafe('section_a_forecasting.json'),
            section_b_supply_chain: readJsonSafe('section_b_supply_chain.json'),
            section_c_agent_dynamics: readJsonSafe('section_c_agent_dynamics.json'),
            section_d_end_to_end: readJsonSafe('section_d_end_to_end.json'),
            live_node_telemetry: readJsonSafe('node_live_benchmark.json')
        }
    });
});

app.post('/api/emergency', async (req, res) => {
    try {
        const result = await orchestrator.handleEmergency(req.body);
        res.json({ success: true, emergencyId: result.id, message: 'Emergency processed by Multi-Agent System' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`[Multi-Agent System] RaktaSetu EOC running on http://localhost:${PORT}`);
    console.log(`[Agents] 6 specialized agents active. Autonomy loop started.`);
});
