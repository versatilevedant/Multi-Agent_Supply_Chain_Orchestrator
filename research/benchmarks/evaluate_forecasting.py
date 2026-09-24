"""
Forecasting Benchmark Runner - Section A
MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR
Walk-forward evaluation across Horizons H in {1, 3, 7, 14} days.
Evaluates:
- Conventional baselines: Seasonal Naive, SARIMAX, LSTM, LightGBM
- Foundation models: Chronos-Bolt, Chronos-2, TimesFM 2.5, Moirai-2.0, MOMENT
Metrics: MAE, RMSE, sMAPE, WQL (q=0.9), PICP (90%)
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List

from research.data.dataset_loaders import DatasetLoader, TemporalSplitter
from research.models.baseline_models import SeasonalNaiveForecaster, SARIMAXForecaster, LSTMForecaster, LightGBMForecaster
from research.models.foundation_forecasters import (
    ChronosBoltForecaster, Chronos2Forecaster, TimesFM25Forecaster, Moirai2Forecaster, MOMENTForecaster
)

RESULTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'results')
os.makedirs(RESULTS_DIR, exist_ok=True)

def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray, quantiles: Dict[float, np.ndarray] = None) -> Dict[str, float]:
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)

    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    
    denom = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    denom = np.where(denom == 0, 1e-6, denom)
    smape = float(np.mean(np.abs(y_pred - y_true) / denom) * 100.0)

    # Weighted Quantile Loss at q=0.9
    wql_90 = None
    picp_90 = None
    if quantiles is not None and 0.9 in quantiles and 0.1 in quantiles:
        q90 = np.array(quantiles[0.9])
        e = y_true - q90
        loss = np.maximum(0.9 * e, (0.9 - 1.0) * e)
        wql_90 = float(2.0 * np.sum(loss) / (np.sum(np.abs(y_true)) + 1e-6))
        
        q10 = np.array(quantiles[0.1])
        covered = (y_true >= q10) & (y_true <= q90)
        picp_90 = float(np.mean(covered) * 100.0)

    return {
        'MAE': round(mae, 3),
        'RMSE': round(rmse, 3),
        'sMAPE': round(smape, 2),
        'WQL_90': round(wql_90, 4) if wql_90 is not None else None,
        'PICP_90': round(picp_90, 1) if picp_90 is not None else None
    }


def run_forecasting_benchmark():
    print("=" * 80)
    print("MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR - FORECASTING BENCHMARK (SECTION A)")
    print("Walk-forward rolling-origin evaluation on empirical blood demand series")
    print("=" * 80)

    df = DatasetLoader.load_ghana_tema_dataset()
    target_series = df['demand_units'].values

    splitter = TemporalSplitter(forecast_horizons=[1, 3, 7, 14], purge_window=7)
    splits = splitter.generate_splits(df, target_col='demand_units', n_splits=4)
    print(f"Generated {len(splits)} rolling-origin folds with 7-day purging window.")

    candidate_models = [
        ("Seasonal Naive", "Baseline", lambda: SeasonalNaiveForecaster(season_length=7)),
        ("SARIMAX", "Statistical", lambda: SARIMAXForecaster(order=(1,1,1), seasonal_order=(1,0,1,7))),
        ("LSTM", "Deep Learning", lambda: LSTMForecaster(seq_len=14, epochs=15)),
        ("LightGBM", "Gradient Boosted", lambda: LightGBMForecaster()),
        ("Chronos-Bolt (Zero-Shot)", "Foundation Model", lambda: ChronosBoltForecaster(is_fine_tuned=False)),
        ("Chronos-Bolt (Fine-Tuned)", "Foundation Model", lambda: ChronosBoltForecaster(is_fine_tuned=True)),
        ("Chronos-2 (Zero-Shot)", "Foundation Model", lambda: Chronos2Forecaster(is_fine_tuned=False)),
        ("Chronos-2 (LoRA)", "Foundation Model", lambda: Chronos2Forecaster(is_fine_tuned=True)),
        ("TimesFM-2.5 (Zero-Shot)", "Foundation Model", lambda: TimesFM25Forecaster(is_fine_tuned=False)),
        ("TimesFM-2.5 (Fine-Tuned)", "Foundation Model", lambda: TimesFM25Forecaster(is_fine_tuned=True)),
        ("Moirai-2.0 (Zero-Shot)", "Foundation Model", lambda: Moirai2Forecaster(is_fine_tuned=False)),
        ("Moirai-2.0 (LoRA)", "Foundation Model", lambda: Moirai2Forecaster(is_fine_tuned=True)),
        ("MOMENT (Zero-Shot)", "Foundation Model", lambda: MOMENTForecaster(is_fine_tuned=False)),
        ("MOMENT (Linear Probe)", "Foundation Model", lambda: MOMENTForecaster(is_fine_tuned=True, adaptation_type="linear_probe"))
    ]

    benchmark_records = []

    for name, paradigm, constructor in candidate_models:
        print(f"Evaluating: {name} [{paradigm}]...")
        horizon_metrics = {1: [], 3: [], 7: [], 14: []}

        for fold_data in splits:
            train_y = fold_data['train']['demand_units'].values
            model = constructor()
            model.fit(train_y)

            for h in [1, 3, 7, 14]:
                if h in fold_data['tests']:
                    test_y = fold_data['tests'][h]['demand_units'].values
                    pred_res = model.predict(h)
                    
                    if isinstance(pred_res, dict):
                        point = pred_res['point']
                        quantiles = pred_res.get('quantiles')
                    else:
                        point = pred_res
                        quantiles = None

                    m = calculate_metrics(test_y, point, quantiles)
                    horizon_metrics[h].append(m)

        def clean_val(v):
            if v is None or np.isnan(v):
                return None
            return round(float(v), 3)

        record = {
            'Model': name,
            'Paradigm': paradigm,
            'Provenance': '[Meas]',
            'MAE_H1': clean_val(np.nanmean([f['MAE'] for f in horizon_metrics[1] if f['MAE'] is not None])),
            'RMSE_H1': clean_val(np.nanmean([f['RMSE'] for f in horizon_metrics[1] if f['RMSE'] is not None])),
            'sMAPE_H1': clean_val(np.nanmean([f['sMAPE'] for f in horizon_metrics[1] if f['sMAPE'] is not None])),
            'WQL_90_H1': clean_val(np.nanmean([f['WQL_90'] for f in horizon_metrics[1] if f['WQL_90'] is not None])),
            'PICP_90_H1': clean_val(np.nanmean([f['PICP_90'] for f in horizon_metrics[1] if f['PICP_90'] is not None]))
        }
        benchmark_records.append(record)

    output_file = os.path.join(RESULTS_DIR, 'section_a_forecasting.json')
    with open(output_file, 'w') as f:
        json.dump(benchmark_records, f, indent=2)

    print(f"\nBenchmark completed successfully! Results written to: {output_file}\n")
    return benchmark_records

if __name__ == '__main__':
    run_forecasting_benchmark()
