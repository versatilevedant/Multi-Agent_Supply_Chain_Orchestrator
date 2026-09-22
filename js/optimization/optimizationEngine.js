;(function(root) {
  "use strict";

  // ============================================================================
  // CLASS 1: AHP (Analytic Hierarchy Process)
  // ============================================================================
  class AHP {
    constructor(criteria, weights) {
      this.criteria = criteria;
      this.defaultWeights = weights;
      this.currentWeights = { ...weights };
      this.n = criteria.length;
      
      // Random Index (RI) table for AHP
      this.RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45 };
      
      this.matrix = [];
      this.priorityVector = [];
      this.consistencyRatio = 0;
      
      this.updateMatrixAndPriorities();
    }
    
    updateMatrixAndPriorities() {
      this.buildComparisonMatrix();
      this.calculatePriorityVector();
      this.calculateConsistencyRatio();
    }

    buildComparisonMatrix() {
      this.matrix = Array(this.n).fill(0).map(() => Array(this.n).fill(1));
      for (let i = 0; i < this.n; i++) {
        for (let j = 0; j < this.n; j++) {
          if (i !== j) {
            let ratio = this.currentWeights[this.criteria[i]] / this.currentWeights[this.criteria[j]];
            this.matrix[i][j] = ratio;
          }
        }
      }
    }

    calculatePriorityVector() {
      // Power iteration method for principal eigenvector
      let vector = Array(this.n).fill(1 / this.n);
      let nextVector = Array(this.n).fill(0);
      let maxIterations = 100;
      let tolerance = 1e-6;

      for (let iter = 0; iter < maxIterations; iter++) {
        let sum = 0;
        for (let i = 0; i < this.n; i++) {
          nextVector[i] = 0;
          for (let j = 0; j < this.n; j++) {
            nextVector[i] += this.matrix[i][j] * vector[j];
          }
          sum += nextVector[i];
        }

        let diff = 0;
        for (let i = 0; i < this.n; i++) {
          nextVector[i] /= sum;
          diff += Math.abs(nextVector[i] - vector[i]);
        }

        vector = [...nextVector];
        if (diff < tolerance) break;
      }
      this.priorityVector = vector;
    }

    calculateConsistencyRatio() {
      if (this.n < 3) {
        this.consistencyRatio = 0;
        return;
      }
      
      let aw = Array(this.n).fill(0);
      let lambdaMax = 0;
      for (let i = 0; i < this.n; i++) {
        for (let j = 0; j < this.n; j++) {
          aw[i] += this.matrix[i][j] * this.priorityVector[j];
        }
        lambdaMax += aw[i] / this.priorityVector[i];
      }
      lambdaMax /= this.n;

      let ci = (lambdaMax - this.n) / (this.n - 1);
      let ri = this.RI[this.n] || 1.49;
      this.consistencyRatio = ci / ri;
    }

    evaluate(alternatives) {
      let results = alternatives.map(alt => {
        let compositeScore = 0;
        let details = {};
        
        for (let i = 0; i < this.n; i++) {
          let crit = this.criteria[i];
          let score = alt.scores[crit] || 0;
          let weight = this.priorityVector[i];
          let weightedScore = score * weight;
          compositeScore += weightedScore;
          details[crit] = { score, weight, weightedScore };
        }
        
        return {
          ...alt,
          compositeScore,
          ahpDetails: details
        };
      });

      return results.sort((a, b) => b.compositeScore - a.compositeScore);
    }

    adjustForMode(mode) {
      this.currentWeights = { ...this.defaultWeights };
      
      if (mode === 'urgent') {
        if (this.currentWeights.emergency) this.currentWeights.emergency *= 1.5;
        if (this.currentWeights.distance) this.currentWeights.distance *= 1.2;
      } else if (mode === 'emergency') {
        if (this.currentWeights.emergency) this.currentWeights.emergency *= 2.5;
        if (this.currentWeights.distance) this.currentWeights.distance *= 2.0;
        if (this.currentWeights.cost) this.currentWeights.cost *= 0.1;
      }
      
      this.updateMatrixAndPriorities();
    }
  }


  // ============================================================================
  // CLASS 2: NSGA2 (Non-dominated Sorting Genetic Algorithm II)
  // ============================================================================
  class NSGA2 {
    constructor(config = {}) {
      this.populationSize = config.populationSize || 20;
      this.generations = config.generations || 15;
      this.crossoverRate = config.crossoverRate || 0.9;
      this.mutationRate = config.mutationRate || 0.1;
      this.eta_c = config.eta_c || 20; // distribution index for crossover
      this.eta_m = config.eta_m || 20; // distribution index for mutation
    }

    optimize(objectives, constraints, decisionVars) {
      let pop = this.initializePopulation(decisionVars);
      
      this.evaluatePopulation(pop, objectives, constraints);
      this.fastNonDominatedSort(pop);
      this.crowdingDistanceAssignment(pop);

      for (let g = 0; g < this.generations; g++) {
        let offspring = this.createOffspring(pop, decisionVars);
        this.evaluatePopulation(offspring, objectives, constraints);
        
        let combinedPop = pop.concat(offspring);
        let fronts = this.fastNonDominatedSort(combinedPop);
        
        let nextPop = [];
        let i = 0;
        
        while (i < fronts.length && nextPop.length + fronts[i].length <= this.populationSize) {
          this.crowdingDistanceAssignment(fronts[i]);
          nextPop = nextPop.concat(fronts[i]);
          i++;
        }
        
        if (nextPop.length < this.populationSize && i < fronts.length) {
          this.crowdingDistanceAssignment(fronts[i]);
          fronts[i].sort((a, b) => b.crowdingDistance - a.crowdingDistance);
          let remaining = this.populationSize - nextPop.length;
          nextPop = nextPop.concat(fronts[i].slice(0, remaining));
        }
        
        pop = nextPop;
      }
      
      let finalFronts = this.fastNonDominatedSort(pop);
      return finalFronts[0];
    }

    initializePopulation(decisionVars) {
      let pop = [];
      for (let i = 0; i < this.populationSize; i++) {
        let ind = { variables: [] };
        let sum = 0;
        for (let j = 0; j < decisionVars.count; j++) {
          let val = Math.random() * (decisionVars.max - decisionVars.min) + decisionVars.min;
          ind.variables.push(val);
          sum += val;
        }
        // Normalize if they represent fractions
        if (sum > 0) {
          ind.variables = ind.variables.map(v => v / sum);
        }
        pop.push(ind);
      }
      return pop;
    }

    evaluatePopulation(pop, objectives, constraints) {
      pop.forEach(ind => {
        ind.objectives = objectives.map(obj => {
          let val = obj.evaluate(ind.variables);
          return obj.type === 'minimize' ? val : -val; 
        });
        ind.feasible = constraints.every(c => c.check(ind.variables));
      });
    }

    fastNonDominatedSort(population) {
      let fronts = [[]];
      
      population.forEach(p => {
        p.dominationCount = 0;
        p.dominatedSet = [];
        
        population.forEach(q => {
          if (this.dominates(p, q)) {
            p.dominatedSet.push(q);
          } else if (this.dominates(q, p)) {
            p.dominationCount++;
          }
        });
        
        if (p.dominationCount === 0) {
          p.rank = 0;
          fronts[0].push(p);
        }
      });
      
      let i = 0;
      while (fronts[i].length > 0) {
        let nextFront = [];
        fronts[i].forEach(p => {
          p.dominatedSet.forEach(q => {
            q.dominationCount--;
            if (q.dominationCount === 0) {
              q.rank = i + 1;
              nextFront.push(q);
            }
          });
        });
        i++;
        if (nextFront.length > 0) {
          fronts.push(nextFront);
        } else {
          break;
        }
      }
      
      return fronts;
    }

    dominates(p, q) {
      if (!p.feasible && q.feasible) return false;
      if (p.feasible && !q.feasible) return true;
      
      let strictlyBetter = false;
      for (let i = 0; i < p.objectives.length; i++) {
        if (p.objectives[i] > q.objectives[i]) return false;
        if (p.objectives[i] < q.objectives[i]) strictlyBetter = true;
      }
      return strictlyBetter;
    }

    crowdingDistanceAssignment(front) {
      let l = front.length;
      if (l === 0) return;
      
      front.forEach(p => p.crowdingDistance = 0);
      let numObjectives = front[0].objectives.length;
      
      for (let m = 0; m < numObjectives; m++) {
        front.sort((a, b) => a.objectives[m] - b.objectives[m]);
        
        front[0].crowdingDistance = Infinity;
        front[l - 1].crowdingDistance = Infinity;
        
        let fMax = front[l - 1].objectives[m];
        let fMin = front[0].objectives[m];
        
        if (fMax === fMin) continue;
        
        for (let i = 1; i < l - 1; i++) {
          front[i].crowdingDistance += (front[i + 1].objectives[m] - front[i - 1].objectives[m]) / (fMax - fMin);
        }
      }
    }

    createOffspring(pop, decisionVars) {
      let offspring = [];
      while (offspring.length < this.populationSize) {
        let parent1 = this.tournamentSelection(pop);
        let parent2 = this.tournamentSelection(pop);
        
        let [child1, child2] = this.sbxCrossover(parent1, parent2, decisionVars);
        
        this.polynomialMutation(child1, decisionVars);
        this.polynomialMutation(child2, decisionVars);
        
        // Normalize
        let sum1 = child1.variables.reduce((a,b)=>a+b, 0);
        let sum2 = child2.variables.reduce((a,b)=>a+b, 0);
        if (sum1 > 0) child1.variables = child1.variables.map(v => v/sum1);
        if (sum2 > 0) child2.variables = child2.variables.map(v => v/sum2);

        offspring.push(child1);
        if (offspring.length < this.populationSize) offspring.push(child2);
      }
      return offspring;
    }

    tournamentSelection(pop) {
      let i = Math.floor(Math.random() * pop.length);
      let j = Math.floor(Math.random() * pop.length);
      
      let p1 = pop[i];
      let p2 = pop[j];
      
      if (p1.rank < p2.rank) return p1;
      if (p2.rank < p1.rank) return p2;
      return p1.crowdingDistance > p2.crowdingDistance ? p1 : p2;
    }

    sbxCrossover(p1, p2, bounds) {
      let c1 = { variables: [] };
      let c2 = { variables: [] };
      
      for (let i = 0; i < p1.variables.length; i++) {
        if (Math.random() <= this.crossoverRate) {
          let u = Math.random();
          let beta = u <= 0.5 ? Math.pow(2 * u, 1 / (this.eta_c + 1)) : Math.pow(1 / (2 * (1 - u)), 1 / (this.eta_c + 1));
          
          let v1 = 0.5 * ((1 + beta) * p1.variables[i] + (1 - beta) * p2.variables[i]);
          let v2 = 0.5 * ((1 - beta) * p1.variables[i] + (1 + beta) * p2.variables[i]);
          
          v1 = Math.max(bounds.min, Math.min(bounds.max, v1));
          v2 = Math.max(bounds.min, Math.min(bounds.max, v2));
          
          c1.variables.push(v1);
          c2.variables.push(v2);
        } else {
          c1.variables.push(p1.variables[i]);
          c2.variables.push(p2.variables[i]);
        }
      }
      return [c1, c2];
    }

    polynomialMutation(ind, bounds) {
      for (let i = 0; i < ind.variables.length; i++) {
        if (Math.random() <= this.mutationRate) {
          let u = Math.random();
          let delta = u <= 0.5 ? Math.pow(2 * u, 1 / (this.eta_m + 1)) - 1 : 1 - Math.pow(2 * (1 - u), 1 / (this.eta_m + 1));
          
          let val = ind.variables[i] + delta * (bounds.max - bounds.min);
          ind.variables[i] = Math.max(bounds.min, Math.min(bounds.max, val));
        }
      }
    }
  }


  // ============================================================================
  // CLASS 3: HungarianAlgorithm
  // ============================================================================
  class HungarianAlgorithm {
    solve(costMatrix) {
      if (costMatrix.length === 0 || costMatrix[0].length === 0) {
        return { assignments: [], totalCost: 0 };
      }

      let n = costMatrix.length;
      let m = costMatrix[0].length;
      let dim = Math.max(n, m);

      // Pad matrix to be square
      let matrix = Array(dim).fill(0).map(() => Array(dim).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
          matrix[i][j] = costMatrix[i][j];
        }
      }

      let rowPotentials = Array(dim).fill(0);
      let colPotentials = Array(dim).fill(0);
      let assignment = Array(dim).fill(-1); // col -> row
      let reverseAssignment = Array(dim).fill(-1); // row -> col

      for (let i = 0; i < dim; i++) {
        let minVals = Array(dim).fill(Infinity);
        let links = Array(dim).fill(-1);
        let visited = Array(dim).fill(false);
        let markedI = i, markedJ = -1, j0 = -1;
        
        assignment[j0] = i; 
        // using an extra column to hold the start
        // this is standard shortest-path augmenting path for Hungarian
        let curJ = dim;
        let p = Array(dim + 1).fill(-1); 
        let way = Array(dim + 1).fill(-1); 
        p[dim] = i;

        do {
          visited[curJ] = true;
          let i0 = p[curJ], delta = Infinity, j1 = -1;
          
          for (let j = 0; j < dim; j++) {
            if (!visited[j]) {
              let cur = matrix[i0][j] - rowPotentials[i0] - colPotentials[j];
              if (cur < minVals[j]) {
                minVals[j] = cur;
                way[j] = curJ;
              }
              if (minVals[j] < delta) {
                delta = minVals[j];
                j1 = j;
              }
            }
          }

          for (let j = 0; j <= dim; j++) {
            if (visited[j]) {
              rowPotentials[p[j]] += delta;
              colPotentials[j] -= delta;
            } else {
              minVals[j] -= delta;
            }
          }
          curJ = j1;
        } while (p[curJ] !== -1);

        do {
          let j1 = way[curJ];
          p[curJ] = p[j1];
          curJ = j1;
        } while (curJ !== dim);
      }

      let assignments = [];
      let totalCost = 0;
      for (let j = 0; j < dim; j++) {
        let i = p[j];
        if (i < n && j < m) {
          assignments.push([i, j, costMatrix[i][j]]);
          totalCost += costMatrix[i][j];
        }
      }

      return { assignments, totalCost };
    }
  }


  // ============================================================================
  // CLASS 4: VehicleRouter
  // ============================================================================
  class VehicleRouter {
    constructor(config = {}) {
      this.speedKmph = config.speedKmph || 40;
    }

    generateDeliveryPlan(assignments) {
      let stops = assignments.map(a => ({
        ...a,
        id: Math.random().toString(36).substring(7)
      }));

      // Simple heuristic: optimize each assignment as a point-to-point path,
      // For a real VR, we would group by source/destination.
      let optimizedStops = this.optimizeRouteOrder(stops);
      let plan = [];
      
      let currentDistance = 0;
      for (let i = 0; i < optimizedStops.length; i++) {
        let stop = optimizedStops[i];
        let distance = this.calculateDistance(stop.source, stop.destination);
        let eta = this.calculateETA(distance, stop.trafficFactor || 1);
        plan.push({
          stopId: stop.id,
          source: stop.source,
          destination: stop.destination,
          units: stop.units,
          distance,
          eta
        });
      }

      return plan;
    }

    optimizeRouteOrder(stops) {
      if (stops.length <= 1) return stops;
      
      // Nearest neighbor approach for simplicity
      let unvisited = [...stops];
      let route = [unvisited.shift()];
      
      while (unvisited.length > 0) {
        let current = route[route.length - 1];
        let nearestIdx = 0;
        let minDist = Infinity;
        
        for (let i = 0; i < unvisited.length; i++) {
          let dist = this.calculateDistance(current.destination, unvisited[i].source);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }
        
        route.push(unvisited.splice(nearestIdx, 1)[0]);
      }
      
      return route;
    }

    calculateDistance(p1, p2) {
      // Haversine formula
      const R = 6371; // km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLng = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    calculateETA(distance, trafficFactor) {
      let hours = distance / (this.speedKmph / trafficFactor);
      return hours * 60; // minutes
    }
  }


  // ============================================================================
  // CLASS 5: OptimizationEngine (Facade)
  // ============================================================================
  class OptimizationEngine {
    constructor(config) {
      this.ahp = new AHP(config.ahp.criteria, config.ahp.defaultWeights);
      this.nsga2 = new NSGA2(config.nsga2);
      this.hungarian = new HungarianAlgorithm();
      this.vehicleRouter = new VehicleRouter(config.routing);
    }
    
    optimizeAllocation(request, candidates, emergencyMode) {
      // 1. AHP Ranking
      this.ahp.adjustForMode(emergencyMode);
      let rankedCandidates = this.ahp.evaluate(candidates);
      
      // 2. Filter top candidates
      let topCandidates = rankedCandidates.slice(0, 5);
      
      // 3. Set up multi-objective optimization (NSGA-II)
      let objectives = [
        {
          name: 'travelTime',
          type: 'minimize',
          evaluate: (vars) => {
            return vars.reduce((sum, v, i) => sum + v * topCandidates[i].distance, 0);
          }
        },
        {
          name: 'reliability',
          type: 'maximize',
          evaluate: (vars) => {
            return vars.reduce((sum, v, i) => sum + v * topCandidates[i].reliability, 0);
          }
        }
      ];
      
      let constraints = [
        {
          name: 'totalUnits',
          check: (vars) => Math.abs(vars.reduce((a,b)=>a+b, 0) - 1.0) < 0.001
        }
      ];
      
      let decisionVars = {
        min: 0,
        max: 1,
        count: topCandidates.length
      };
      
      let paretoFront = this.nsga2.optimize(objectives, constraints, decisionVars);
      let bestAllocation = paretoFront[0]; // Just take first Pareto solution for simplicity

      // 4. Vehicle Routing
      let assignments = [];
      for(let i=0; i<topCandidates.length; i++) {
        let allocFraction = bestAllocation.variables[i];
        if (allocFraction > 0.05) {
           assignments.push({
             source: topCandidates[i].location,
             destination: request.location,
             units: Math.round(allocFraction * request.unitsRequested),
             priority: emergencyMode
           });
        }
      }
      
      let routingPlan = this.vehicleRouter.generateDeliveryPlan(assignments);
      
      return {
        rankedCandidates,
        paretoFront,
        bestAllocation,
        routingPlan
      };
    }

    optimizeBatch(requests, candidates, emergencyMode) {
      // Cost matrix for assignments (requests x candidates)
      let costMatrix = [];
      for (let r = 0; r < requests.length; r++) {
        let row = [];
        for (let c = 0; c < candidates.length; c++) {
          let dist = this.vehicleRouter.calculateDistance(requests[r].location, candidates[c].location);
          row.push(dist); // using distance as cost
        }
        costMatrix.push(row);
      }
      
      let solution = this.hungarian.solve(costMatrix);
      
      // Format results
      let batchResults = solution.assignments.map(a => {
        let reqIdx = a[0];
        let candIdx = a[1];
        let cost = a[2];
        return {
          request: requests[reqIdx],
          assignedTo: candidates[candIdx],
          cost
        };
      });
      
      return { batchResults, totalCost: solution.totalCost };
    }
  }

  // ============================================================================
  // EXPORT
  // ============================================================================
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OptimizationEngine, AHP, NSGA2, HungarianAlgorithm, VehicleRouter };
  } else {
    root.OptimizationEngine = OptimizationEngine;
    root.AHP = AHP;
    root.NSGA2 = NSGA2;
    root.HungarianAlgorithm = HungarianAlgorithm;
    root.VehicleRouter = VehicleRouter;
  }
})(typeof self !== 'undefined' ? self : this);
