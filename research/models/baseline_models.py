"""
Conventional and Deep Learning Baselines
MULTI-AGENT SUPPLY CHAIN ORCHESTRATOR
Scientifically justified baselines:
- Seasonal Naive (Mandatory baseline)
- SARIMAX (statsmodels)
- LSTM (PyTorch)
- LightGBM / XGBoost Regressor
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from typing import Dict, Any, List, Optional
from statsmodels.tsa.statespace.sarimax import SARIMAX
import lightgbm as lgb
import xgboost as xgb

class SeasonalNaiveForecaster:
    """Seasonal Naive baseline replicating past weekly cycles."""
    def __init__(self, season_length: int = 7):
        self.season_length = season_length
        self.history = None

    def fit(self, y: np.ndarray):
        self.history = np.array(y)
        return self

    def predict(self, horizon: int) -> np.ndarray:
        if len(self.history) < self.season_length:
            return np.full(horizon, self.history[-1])
        reps = int(np.ceil(horizon / self.season_length))
        cycle = self.history[-self.season_length:]
        forecast = np.tile(cycle, reps)[:horizon]
        return forecast


class SARIMAXForecaster:
    """SARIMAX statistical baseline with weekly seasonality."""
    def __init__(self, order=(1, 1, 1), seasonal_order=(1, 0, 1, 7)):
        self.order = order
        self.seasonal_order = seasonal_order
        self.fitted_model = None

    def fit(self, y: np.ndarray, exog: Optional[np.ndarray] = None):
        try:
            model = SARIMAX(
                y,
                exog=exog,
                order=self.order,
                seasonal_order=self.seasonal_order,
                enforce_stationarity=False,
                enforce_invertibility=False
            )
            self.fitted_model = model.fit(disp=False)
        except Exception:
            # Fallback if convergence fails on small folds
            model = SARIMAX(y, order=(1, 1, 0), enforce_stationarity=False)
            self.fitted_model = model.fit(disp=False)
        return self

    def predict(self, horizon: int, exog: Optional[np.ndarray] = None) -> np.ndarray:
        if self.fitted_model is None:
            raise ValueError("Model not fitted.")
        pred = self.fitted_model.forecast(steps=horizon, exog=exog)
        return np.maximum(0, np.array(pred))


class PyTorchLSTM(nn.Module):
    """LSTM sequence network for clinical demand prediction."""
    def __init__(self, input_dim: int = 1, hidden_dim: int = 32, num_layers: int = 2, output_dim: int = 1):
        super(PyTorchLSTM, self).__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers=num_layers, batch_first=True, dropout=0.1)
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])
        return out


class LSTMForecaster:
    """Trainer and interface for PyTorch LSTM sequence model."""
    def __init__(self, seq_len: int = 14, hidden_dim: int = 32, epochs: int = 25, lr: float = 0.005):
        self.seq_len = seq_len
        self.hidden_dim = hidden_dim
        self.epochs = epochs
        self.lr = lr
        self.model = None
        self.scale_mean = 0.0
        self.scale_std = 1.0

    def _create_sequences(self, data: np.ndarray):
        X, y = [], []
        for i in range(len(data) - self.seq_len):
            X.append(data[i:i + self.seq_len])
            y.append(data[i + self.seq_len])
        return np.array(X), np.array(y)

    def fit(self, y: np.ndarray):
        self.scale_mean = np.mean(y)
        self.scale_std = np.std(y) + 1e-6
        norm_y = (y - self.scale_mean) / self.scale_std

        X, target = self._create_sequences(norm_y)
        if len(X) == 0:
            return self

        X_t = torch.tensor(X, dtype=torch.float32).unsqueeze(-1)
        y_t = torch.tensor(target, dtype=torch.float32).unsqueeze(-1)

        self.model = PyTorchLSTM(input_dim=1, hidden_dim=self.hidden_dim, num_layers=1)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)

        self.model.train()
        for epoch in range(self.epochs):
            optimizer.zero_grad()
            outputs = self.model(X_t)
            loss = criterion(outputs, y_t)
            loss.backward()
            optimizer.step()

        self.last_seq = norm_y[-self.seq_len:]
        return self

    def predict(self, horizon: int) -> np.ndarray:
        if self.model is None or self.last_seq is None:
            return np.full(horizon, self.scale_mean)

        self.model.eval()
        preds = []
        curr_seq = list(self.last_seq)

        with torch.no_grad():
            for _ in range(horizon):
                inp = torch.tensor(curr_seq[-self.seq_len:], dtype=torch.float32).view(1, self.seq_len, 1)
                out = self.model(inp).item()
                preds.append(out)
                curr_seq.append(out)

        scaled_preds = np.array(preds) * self.scale_std + self.scale_mean
        return np.maximum(0, scaled_preds)


class LightGBMForecaster:
    """Tabular multi-lag gradient boosting regressor."""
    def __init__(self, lags: List[int] = [1, 2, 3, 7, 14]):
        self.lags = lags
        self.model = lgb.LGBMRegressor(n_estimators=60, learning_rate=0.08, verbose=-1, random_state=42)
        self.last_history = None

    def _extract_features(self, y: np.ndarray):
        df = pd.DataFrame({'y': y})
        for l in self.lags:
            df[f'lag_{l}'] = df['y'].shift(l)
        df['rolling_mean_7'] = df['y'].shift(1).rolling(7).mean()
        df = df.dropna()
        X = df.drop(columns=['y'])
        target = df['y']
        return X, target

    def fit(self, y: np.ndarray):
        self.last_history = list(y)
        X, target = self._extract_features(y)
        if len(X) > 0:
            self.model.fit(X, target)
        return self

    def predict(self, horizon: int) -> np.ndarray:
        preds = []
        hist = list(self.last_history)
        for _ in range(horizon):
            row = {}
            for l in self.lags:
                row[f'lag_{l}'] = hist[-l] if len(hist) >= l else hist[-1]
            row['rolling_mean_7'] = np.mean(hist[-7:]) if len(hist) >= 7 else np.mean(hist)
            feat = pd.DataFrame([row])
            p = float(self.model.predict(feat)[0])
            p = max(0.0, p)
            preds.append(p)
            hist.append(p)
        return np.array(preds)
