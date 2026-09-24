/**
 * Live Multi-Agent System Benchmark Test Harness
 * MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR
 * Executes controlled disruption tiers (Normal, Moderate, Severe) across 30 runs
 * directly on the project's active AgentOrchestrator and EventBus.
 */

const { AgentOrchestrator } = require('./js/agents/agentSystem.js');
const fs = require('fs');
const path = require('path');

// Load configurations
const configPath = path.join(__dirname, 'config');
const systemConfig = JSON.parse(fs.readFileSync(path.join(configPath, 'system.json'), 'utf8'));
const bloodBanksData = JSON.parse(fs.readFileSync(path.join(configPath, 'bloodBanks.json'), 'utf8'));
const hospitalsData = JSON.parse(fs.readFileSync(path.join(configPath, 'hospitals.json'), 'utf8'));

async function runLiveBenchmark(iterations = 20) {
    console.log("================================================================================");
    console.log("   MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR - LIVE ORCHESTRATION BENCHMARK");
    console.log(`   Running ${iterations} iterations per Disruption Tier on active Agent System`);
    console.log("================================================================================\n");

    const tiers = ['normal', 'moderate', 'severe'];
    const summary = {};

    for (const tier of tiers) {
        process.stdout.write(`Executing Tier [${tier.toUpperCase()}]: `);
        const tierTimes = [];
        let successCount = 0;
        let totalAllocated = 0;
        let totalRequested = 0;

        for (let i = 0; i < iterations; i++) {
            process.stdout.write('.');
            const orchestrator = new AgentOrchestrator(systemConfig);
            orchestrator.initializeInventory(bloodBanksData, systemConfig.bloodGroups, systemConfig.bloodGroupDistribution);
            orchestrator.hospitals = hospitalsData;

            // Apply Controlled Disruption
            if (tier === 'moderate') {
                // 50% capacity drop at primary central facility
                orchestrator.bloodBanks[0].capacity = Math.floor(orchestrator.bloodBanks[0].capacity * 0.5);
                for (const g of Object.keys(orchestrator.bloodBanks[0].inventory)) {
                    orchestrator.bloodBanks[0].inventory[g] = Math.floor(orchestrator.bloodBanks[0].inventory[g] * 0.5);
                }
            } else if (tier === 'severe') {
                // Total failure of two central facilities
                orchestrator.bloodBanks[0].inventory = {};
                orchestrator.bloodBanks[1].inventory = {};
            }

            const reqUnits = tier === 'severe' ? 6 : (tier === 'moderate' ? 4 : 2);
            totalRequested += reqUnits;

            const testReq = {
                hospitalId: hospitalsData[i % hospitalsData.length].id,
                bloodType: 'O-',
                units: reqUnits,
                condition: tier === 'severe' ? 'trauma_critical' : 'surgical_emergency'
            };

            const t0 = process.hrtime.bigint();
            try {
                const emergency = await orchestrator.handleEmergency(testReq);
                const t1 = process.hrtime.bigint();
                const elapsedMs = Number(t1 - t0) / 1e6;
                tierTimes.push(elapsedMs);

                const allocUnits = emergency.allocation.reduce((sum, a) => sum + a.allocatedUnits, 0);
                totalAllocated += allocUnits;
                if (allocUnits >= reqUnits) {
                    successCount++;
                }
            } catch (err) {
                // Track failure
            }
        }
        process.stdout.write(' DONE\n');

        const meanTime = tierTimes.reduce((a, b) => a + b, 0) / tierTimes.length;
        tierTimes.sort((a, b) => a - b);
        const medianTime = tierTimes[Math.floor(tierTimes.length / 2)];
        const stdDev = Math.sqrt(tierTimes.map(x => Math.pow(x - meanTime, 2)).reduce((a, b) => a + b, 0) / tierTimes.length);

        summary[tier] = {
            iterations,
            successRatePct: Number(((successCount / iterations) * 100).toFixed(1)),
            meanDecisionTimeMs: Number(meanTime.toFixed(2)),
            medianDecisionTimeMs: Number(medianTime.toFixed(2)),
            stdDevMs: Number(stdDev.toFixed(2)),
            minTimeMs: Number(tierTimes[0].toFixed(2)),
            maxTimeMs: Number(tierTimes[tierTimes.length - 1].toFixed(2)),
            fulfillmentRatePct: Number(((totalAllocated / totalRequested) * 100).toFixed(1))
        };
    }

    console.log("\n========================= EMPIRICAL BENCHMARK SUMMARY ==========================\n");
    console.table(summary);
    
    // Save live benchmark output
    const resPath = path.join(__dirname, 'research', 'results', 'node_live_benchmark.json');
    fs.writeFileSync(resPath, JSON.stringify(summary, null, 2));
    console.log(`Saved live benchmark telemetry to: ${resPath}\n`);
}

if (require.main === module) {
    runLiveBenchmark(25);
}

module.exports = { runLiveBenchmark };
