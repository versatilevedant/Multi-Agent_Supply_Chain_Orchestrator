"""
Benchmark Report Generator
MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR
Renders publication-grade tables for Sections A, B, C, and D directly from verified experimental outputs.
"""

import os
import json

RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')

def load_json(name):
    p = os.path.join(RESULTS_DIR, name)
    if os.path.exists(p):
        with open(p, 'r') as f:
            return json.load(f)
    return []

def format_report():
    a = load_json('section_a_forecasting.json')
    b = load_json('section_b_supply_chain.json')
    c = load_json('section_c_agent_dynamics.json')
    d = load_json('section_d_end_to_end.json')
    telemetry = load_json('node_live_benchmark.json')

    print("\n" + "=" * 95)
    print("      MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR: EMPIRICAL BENCHMARK REPORT")
    print("=" * 95)

    print("\n### SECTION A: DEMAND FORECASTING PERFORMANCE (Horizon H = 1 Day)")
    print("| Model | Paradigm | Provenance | MAE (H=1) | RMSE (H=1) | sMAPE (%) | WQL (q=0.9) | PICP (90%) |")
    print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for r in a:
        wql = f"{r['WQL_90_H1']:.4f}" if r.get('WQL_90_H1') is not None else "--"
        picp = f"{r['PICP_90_H1']:.1f}%" if r.get('PICP_90_H1') is not None else "--"
        print(f"| {r['Model']} | {r['Paradigm']} | {r['Provenance']} | {r['MAE_H1']} | {r['RMSE_H1']} | {r['sMAPE_H1']}% | {wql} | {picp} |")

    print("\n### SECTION B: SUPPLY-CHAIN OPERATIONAL PERFORMANCE")
    print("| Method | Provenance | Service Level (%) | Shortage Rate (%) | Wastage (%) | Unmet Demand (Units) | Logistics Cost (INR) |")
    print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for r in b:
        print(f"| {r['Method']} | {r['Provenance']} | {r['Service_Level_Pct']}% | {r['Shortage_Rate_Pct']}% | {r['Wastage_Pct']}% | {r['Unmet_Demand']} | Rs. {r['Logistics_Cost_INR']} |")

    print("\n### SECTION C: AGENT DYNAMICS & DISRUPTION RESILIENCE (N=30 Iterations per Tier)")
    print("| Method | Disruption Tier | Provenance | Mean Dec Time (s) | Median Dec Time (s) | Std Dev (s) | Recovery Time (s) | Success Rate (%) |")
    print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for r in c:
        print(f"| {r['Method']} | {r['Disruption_Tier']} | {r['Provenance']} | {r['Mean_Decision_Time_Sec']} | {r['Median_Decision_Time_Sec']} | {r['Std_Dev_Sec']} | {r['Mean_Recovery_Time_Sec']} | {r['Success_Rate_Pct']}% |")

    print("\n### SECTION D: END-TO-END COMPARATIVE IMPROVEMENT")
    print("| Baseline Comparison | Decision Latency Reduction | Dispatch Speedup | Unmet Demand Reduction | Recovery Speedup | Wilcoxon p-value |")
    print("| :--- | :--- | :--- | :--- | :--- | :--- |")
    for r in d:
        print(f"| {r['Comparison']} | {r['Decision_Time_Reduction_Pct']}% | {r['Dispatch_Speedup_Pct']}% | {r['Unmet_Demand_Reduction_Pct']}% | {r['Recovery_Speedup_Pct']}% | {r['P_Value']} |")

    if telemetry:
        print("\n### LIVE NODE.JS OPERATIONAL TELEMETRY (25 Iterations per Tier)")
        print("| Operational Tier | Iterations | Success Rate | Mean Decision Time | Median Decision Time | Std Dev | Fulfillment Rate |")
        print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
        for tier, data in telemetry.items():
            print(f"| {tier.capitalize()} | {data['iterations']} | {data['successRatePct']}% | {data['meanDecisionTimeMs']} ms | {data['medianDecisionTimeMs']} ms | {data['stdDevMs']} ms | {data['fulfillmentRatePct']}% |")
    print("\n" + "=" * 95 + "\n")

if __name__ == '__main__':
    format_report()
