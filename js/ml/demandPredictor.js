// ================================================================
// RaktaSetu — Demand Prediction ML Model
// Time-series forecasting using weighted moving average with
// seasonal decomposition. Based on published Indian blood demand
// research (peaks in March/October, dips in monsoon/festivals).
// ================================================================

class DemandPredictor {
  constructor() {
    // Seasonal factors by month (1 = baseline, >1 = higher demand)
    // Based on: Bioinformation research on Indian blood bank seasonality
    this.monthlySeasonality = {
      0: 0.95,  // January - post-holiday recovery
      1: 1.02,  // February - normal
      2: 1.15,  // March - PEAK (surgical season, academic hospitals active)
      3: 1.08,  // April - continued high
      4: 1.00,  // May - summer, moderate
      5: 0.92,  // June - monsoon onset, donation dips
      6: 0.88,  // July - heavy monsoon, logistics issues
      7: 0.90,  // August - monsoon continues, dengue begins
      8: 1.05,  // September - post-monsoon, dengue peak (platelet demand)
      9: 1.12,  // October - PEAK (post-monsoon, festivals increase trauma)
      10: 0.95, // November - Diwali period, donation dips
      11: 0.90  // December - holidays, reduced elective surgeries
    };

    // Day of week factors (Mon=0)
    this.dailySeasonality = {
      0: 1.12, // Monday - high (scheduled surgeries)
      1: 1.10, // Tuesday
      2: 1.08, // Wednesday
      3: 1.05, // Thursday
      4: 1.02, // Friday
      5: 0.85, // Saturday - reduced
      6: 0.78  // Sunday - lowest
    };

    // Blood group demand proportions (based on Indian population distribution)
    this.groupDemand = {
      'O+': 0.35, 'O-': 0.04, 'B+': 0.25, 'B-': 0.02,
      'A+': 0.22, 'A-': 0.02, 'AB+': 0.08, 'AB-': 0.02
    };

    // Historical data (simulated but realistic)
    this.historicalData = this.generateHistoricalData();
  }

  // Generate 90 days of historical demand data
  generateHistoricalData() {
    const data = [];
    const today = new Date();
    const baseDemand = 150; // average daily demand across network

    for (let i = 90; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const month = date.getMonth();
      const day = date.getDay();
      
      const seasonalFactor = this.monthlySeasonality[month];
      const dailyFactor = this.dailySeasonality[day];
      
      // Add some noise
      const noise = 0.85 + Math.random() * 0.3;
      
      // Special events (simulated dengue surge, festivals)
      let eventFactor = 1.0;
      if (month === 8 && Math.random() > 0.6) eventFactor = 1.2; // Dengue
      if (month === 10 && date.getDate() > 20 && date.getDate() < 28) eventFactor = 0.8; // Diwali
      
      const demand = Math.round(baseDemand * seasonalFactor * dailyFactor * noise * eventFactor);
      
      const byGroup = {};
      BLOOD_GROUPS.forEach(group => {
        byGroup[group] = Math.round(demand * this.groupDemand[group] * (0.8 + Math.random() * 0.4));
      });

      data.push({
        date: date.toISOString().split('T')[0],
        totalDemand: demand,
        byGroup,
        month,
        dayOfWeek: day,
        seasonalFactor,
        dailyFactor
      });
    }
    return data;
  }

  // Predict demand for next N days
  predict(daysAhead = 7) {
    const predictions = [];
    const today = new Date();
    const recentData = this.historicalData.slice(-14);
    
    // Weighted moving average of recent demand
    const weights = recentData.map((_, i) => (i + 1) / recentData.length);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const weightedAvg = recentData.reduce((sum, d, i) => sum + d.totalDemand * weights[i], 0) / totalWeight;

    for (let i = 1; i <= daysAhead; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + i);
      
      const month = futureDate.getMonth();
      const day = futureDate.getDay();
      
      const seasonalFactor = this.monthlySeasonality[month];
      const dailyFactor = this.dailySeasonality[day];
      
      // Trend component (slight upward trend in healthcare demand)
      const trendFactor = 1 + (i * 0.001);
      
      const predicted = Math.round(weightedAvg * seasonalFactor * dailyFactor * trendFactor);
      
      // Confidence interval (widens with forecast horizon)
      const uncertainty = 0.05 + (i * 0.02);
      const lower = Math.round(predicted * (1 - uncertainty));
      const upper = Math.round(predicted * (1 + uncertainty));

      const byGroup = {};
      BLOOD_GROUPS.forEach(group => {
        const gPred = Math.round(predicted * this.groupDemand[group]);
        byGroup[group] = {
          predicted: gPred,
          lower: Math.round(gPred * (1 - uncertainty)),
          upper: Math.round(gPred * (1 + uncertainty))
        };
      });

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        dateLabel: `${futureDate.getDate()} ${Helpers.monthName(month)}`,
        predicted,
        lower,
        upper,
        byGroup,
        confidence: Math.max(0.6, 1 - uncertainty),
        seasonalFactor,
        dailyFactor
      });
    }

    return predictions;
  }

  // Get model performance metrics (simulated)
  getModelMetrics() {
    return {
      mae: 12.4,    // Mean Absolute Error
      rmse: 16.8,   // Root Mean Square Error
      mape: 8.2,    // Mean Absolute Percentage Error
      r2: 0.87,     // R-squared
      lastTrained: new Date(Date.now() - 3600000).toISOString(),
      trainingDataPoints: 365,
      algorithm: 'Seasonal Weighted MA + Trend Decomposition'
    };
  }

  // Get seasonal analysis
  getSeasonalAnalysis() {
    return Object.entries(this.monthlySeasonality).map(([month, factor]) => ({
      month: Helpers.monthName(parseInt(month)),
      factor,
      label: factor > 1.05 ? 'Peak' : factor < 0.92 ? 'Low' : 'Normal',
      description: this.getMonthDescription(parseInt(month))
    }));
  }

  getMonthDescription(month) {
    const descriptions = {
      0: 'Post-holiday recovery, normal operations resume',
      1: 'Stable demand, voluntary drives active',
      2: 'Peak season — surgical schedules, academic hospitals',
      3: 'Continued high — summer trauma increases',
      4: 'Summer heat — donation slightly reduced',
      5: 'Monsoon onset — logistics challenges begin',
      6: 'Heavy monsoon — transport disrupted, donation drops',
      7: 'Monsoon continues — dengue cases rise',
      8: 'Post-monsoon — dengue peak, platelet demand surges',
      9: 'Second peak — festival season, increased accidents',
      10: 'Diwali period — donation drives slow',
      11: 'Year-end holidays — reduced elective surgeries'
    };
    return descriptions[month];
  }

  // Get regional demand breakdown
  getRegionalDemand() {
    return [
      { region: 'North', demand: 420, trend: '+5%', cities: ['Delhi', 'Chandigarh', 'Jaipur', 'Lucknow'] },
      { region: 'South', demand: 380, trend: '+3%', cities: ['Chennai', 'Bangalore', 'Hyderabad', 'Thiruvananthapuram'] },
      { region: 'West', demand: 350, trend: '+2%', cities: ['Mumbai', 'Pune', 'Ahmedabad'] },
      { region: 'East', demand: 280, trend: '+4%', cities: ['Kolkata', 'Patna'] },
      { region: 'Central', demand: 180, trend: '+6%', cities: ['Bhopal', 'Nagpur'] },
      { region: 'Northeast', demand: 120, trend: '+8%', cities: ['Guwahati'] }
    ];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DemandPredictor;
}
