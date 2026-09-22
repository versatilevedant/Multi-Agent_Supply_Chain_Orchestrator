// ================================================================
// RaktaSetu — Urgency Classification Model
// Scores emergency requests using a weighted feature model
// (simulates a trained decision tree / gradient boosted classifier)
// ================================================================

class UrgencyClassifier {
  constructor() {
    // Feature weights (trained on simulated data)
    this.weights = {
      bloodTypeRarity: 0.25,
      unitsNeeded: 0.15,
      patientCondition: 0.25,
      timeWindow: 0.20,
      stockAvailability: 0.15
    };

    // Blood type rarity scores
    this.rarityScores = {
      'AB-': 95, 'O-': 85, 'B-': 80, 'A-': 75,
      'AB+': 45, 'A+': 30, 'B+': 25, 'O+': 20
    };

    // Patient condition severity mapping
    this.conditionScores = {
      'cardiac_arrest': 98,
      'massive_hemorrhage': 95,
      'trauma_critical': 92,
      'surgical_emergency': 85,
      'postpartum_hemorrhage': 88,
      'organ_transplant': 82,
      'cancer_treatment': 60,
      'scheduled_surgery': 40,
      'chronic_anemia': 35,
      'thalassemia': 50,
      'dengue_platelet': 70,
      'routine_transfusion': 25
    };
  }

  // Classify urgency of an emergency request
  classify(request) {
    const features = this.extractFeatures(request);
    const score = this.calculateScore(features);
    const classification = this.getClassification(score);

    return {
      score: Math.round(score),
      classification,
      features,
      reasoning: this.generateReasoning(features, classification),
      recommendedResponseTime: this.getResponseTime(score),
      timestamp: new Date().toISOString()
    };
  }

  extractFeatures(request) {
    // Blood type rarity
    const bloodTypeRarity = this.rarityScores[request.bloodType] || 50;

    // Units needed (normalized to 0-100)
    const unitsNeeded = Math.min(100, (request.units / 10) * 100);

    // Patient condition
    const patientCondition = this.conditionScores[request.condition] || 50;

    // Time window urgency (shorter window = more urgent)
    const timeWindowHours = request.timeWindowHours || 4;
    const timeWindow = Math.max(0, 100 - (timeWindowHours / 24) * 100);

    // Stock availability (lower stock = more urgent)
    const stockAvailability = request.stockLevel !== undefined
      ? Math.max(0, 100 - request.stockLevel)
      : 50;

    return { bloodTypeRarity, unitsNeeded, patientCondition, timeWindow, stockAvailability };
  }

  calculateScore(features) {
    return (
      features.bloodTypeRarity * this.weights.bloodTypeRarity +
      features.unitsNeeded * this.weights.unitsNeeded +
      features.patientCondition * this.weights.patientCondition +
      features.timeWindow * this.weights.timeWindow +
      features.stockAvailability * this.weights.stockAvailability
    );
  }

  getClassification(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  getResponseTime(score) {
    if (score >= 80) return '< 30 minutes';
    if (score >= 60) return '< 1 hour';
    if (score >= 40) return '< 2 hours';
    return '< 4 hours';
  }

  generateReasoning(features, classification) {
    const reasons = [];
    
    if (features.bloodTypeRarity > 70) {
      reasons.push('Rare blood type requiring specialized sourcing');
    }
    if (features.patientCondition > 80) {
      reasons.push('Life-threatening patient condition');
    }
    if (features.timeWindow > 75) {
      reasons.push('Extremely tight time window for delivery');
    }
    if (features.unitsNeeded > 60) {
      reasons.push('Large quantity required');
    }
    if (features.stockAvailability > 60) {
      reasons.push('Low stock levels at nearby blood banks');
    }
    
    if (reasons.length === 0) {
      reasons.push('Standard request within normal parameters');
    }

    return reasons;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UrgencyClassifier;
}
