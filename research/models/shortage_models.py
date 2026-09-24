"""
Shortage Prediction Formulations
MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR
Comparative Formulations:
1. Rule-Based Deterministic Projection
2. Supervised Classifiers (LightGBM, XGBoost, Random Forest, MLP)
3. Probabilistic Tail-Risk Formulation (from Foundation Model quantiles)
4. Hybrid Two-Tier Pipeline
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import roc_auc_score, f1_score, brier_score_loss
import lightgbm as lgb
import xgboost as xgb

class RuleBasedShortageModel:
    """Deterministic projected stock formula: I_proj(t+h) < SafetyStock"""
    def __init__(self, safety_stock_ratio: float = 0.35):
        self.safety_stock_ratio = safety_stock_ratio

    def evaluate(self, current_inventory: float, capacity: float, forecast_demand: float, incoming_supply: float = 0.0) -> Dict[str, Any]:
        safety_stock = capacity * self.safety_stock_ratio
        proj_stock = current_inventory + incoming_supply - forecast_demand
        is_shortage = 1 if proj_stock < safety_stock else 0
        shortage_gap = max(0.0, safety_stock - proj_stock)
        return {
            'shortage_predicted': is_shortage,
            'projected_stock': proj_stock,
            'shortage_gap': shortage_gap,
            'confidence': 1.0
        }


class ProbabilisticShortageModel:
    """Calculates tail-risk integral Pr(Demand > Available Stock) from Foundation Model quantiles."""
    def __init__(self, threshold: float = 0.20):
        self.threshold = threshold

    def evaluate(self, current_inventory: float, quantiles: Dict[float, float], incoming_supply: float = 0.0) -> Dict[str, Any]:
        available = current_inventory + incoming_supply
        q10 = quantiles.get(0.1, available * 0.5)
        q50 = quantiles.get(0.5, available * 0.8)
        q90 = quantiles.get(0.9, available * 1.2)

        # Estimate Gaussian tail approximation from quantiles
        sigma = (q90 - q10) / 2.56 if (q90 > q10) else 1.0
        mu = q50

        # Z-score for exceeding available stock
        z = (available - mu) / sigma
        from scipy.stats import norm
        shortage_prob = float(1.0 - norm.cdf(z))

        return {
            'shortage_probability': shortage_prob,
            'shortage_predicted': 1 if shortage_prob > self.threshold else 0,
            'tail_sigma': float(sigma),
            'risk_tier': 'CRITICAL' if shortage_prob > 0.6 else ('WARNING' if shortage_prob > self.threshold else 'STABLE')
        }


class SupervisedShortageSuite:
    """Evaluates multiple supervised classifiers without assuming any model is superior beforehand."""
    def __init__(self):
        self.models = {
            'LightGBM': lgb.LGBMClassifier(n_estimators=50, max_depth=4, random_state=42, verbose=-1),
            'XGBoost': xgb.XGBClassifier(n_estimators=50, max_depth=4, eval_metric='logloss', random_state=42),
            'RandomForest': RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42),
            'MLP': MLPClassifier(hidden_layer_sizes=(32, 16), max_iter=200, random_state=42)
        }
        self.fitted = False

    def train_and_benchmark(self, X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> Dict[str, Dict[str, float]]:
        results = {}
        for name, model in self.models.items():
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            probs = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else preds

            auc = roc_auc_score(y_test, probs) if len(np.unique(y_test)) > 1 else 0.5
            f1 = f1_score(y_test, preds, zero_division=0)
            brier = brier_score_loss(y_test, probs)

            results[name] = {
                'ROC_AUC': float(auc),
                'F1_Score': float(f1),
                'Brier_Score': float(brier)
            }
        self.fitted = True
        return results
