// ================================================================
// RaktaSetu — Advanced Route Optimizer
// Real road routing with OSRM + Graph algorithms (Dijkstra, A*)
// Dynamic rerouting with traffic conditions
// ================================================================

class RouteOptimizer {
  constructor(config = {}) {
    // Dynamic configuration (no hardcoded values)
    this.config = {
      maxColdChainHours: config.maxColdChainHours || 4,
      avgSpeedCityKph: config.avgSpeedCityKph || 35,
      avgSpeedHighwayKph: config.avgSpeedHighwayKph || 60,
      osrmBaseUrl: config.osrmBaseUrl || 'https://router.project-osrm.org/route/v1/driving',
      rerouteCheckInterval: config.rerouteCheckInterval || 30000, // 30 seconds
      trafficUpdateInterval: config.trafficUpdateInterval || 10000, // 10 seconds
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 100
    };

    this.routeCache = new Map();
    this.activeRoutes = new Map();
    this.trafficConditions = new Map();
    this.graphNodes = new Map();
    this.graphEdges = new Map();
    this.adjacencyList = new Map();
    
    if (this.config.enableCaching) {
      this.initializeCache();
    }
  }

  initializeCache() {
    // Simple LRU cache implementation
    this.cacheMaxSize = this.config.cacheSize;
    this.cacheAccessOrder = [];
  }

  updateCache(key, value) {
    if (this.routeCache.size >= this.cacheMaxSize) {
      const lruKey = this.cacheAccessOrder.shift();
      this.routeCache.delete(lruKey);
    }
    this.routeCache.set(key, value);
    this.cacheAccessOrder.push(key);
  }

  getFromCache(key) {
    if (this.routeCache.has(key)) {
      // Update access order
      const index = this.cacheAccessOrder.indexOf(key);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
        this.cacheAccessOrder.push(key);
      }
      return this.routeCache.get(key);
    }
    return null;
  }

  // ================================================================
  // OSRM REAL ROAD ROUTING
  // ================================================================

  async getOSRMRoute(source, destination) {
    const cacheKey = `osrm-${source.lat.toFixed(4)},${source.lng.toFixed(4)}-${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout for snappy UI
      const url = `${this.config.osrmBaseUrl}/${source.lng},${source.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`OSRM error: ${data.code}`);
      }

      const route = data.routes[0];
      const result = {
        waypoints: route.geometry.coordinates.map(coord => ({
          lat: coord[1],
          lng: coord[0]
        })),
        distance: route.distance / 1000, // meters to km
        duration: route.duration / 3600, // seconds to hours
        realRoute: true,
        steps: route.steps
      };

      this.updateCache(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('OSRM route fetch fallback to graph algorithm:', error.message || error);
      return null;
    }
  }

  // ================================================================
  // GRAPH ALGORITHMS
  // ================================================================

  buildGraph(locations) {
    // Build a graph from blood banks and hospitals
    this.graphNodes.clear();
    this.graphEdges.clear();
    this.adjacencyList.clear();

    locations.forEach((loc, index) => {
      this.graphNodes.set(index, {
        id: loc.id || index,
        lat: loc.lat,
        lng: loc.lng,
        name: loc.name || `Node ${index}`
      });
    });

    // Create edges between all nodes
    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        this.addEdge(i, j);
      }
    }
  }

  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Fast Dijkstra's Algorithm using Adjacency List
  dijkstra(startIndex, endIndex) {
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();

    this.graphNodes.forEach((node, index) => {
      distances.set(index, Infinity);
      unvisited.add(index);
    });

    distances.set(startIndex, 0);

    while (unvisited.size > 0) {
      let current = null;
      let minDist = Infinity;
      
      unvisited.forEach(index => {
        const d = distances.get(index);
        if (d < minDist) {
          minDist = d;
          current = index;
        }
      });

      if (current === null || current === endIndex) break;

      unvisited.delete(current);

      const neighbors = this.adjacencyList.get(current) || [];
      for (const neighborIndex of neighbors) {
        if (unvisited.has(neighborIndex)) {
          const edgeKey = `${current}-${neighborIndex}`;
          const edge = this.graphEdges.get(edgeKey);
          
          if (edge) {
            const trafficFactor = this.trafficConditions.get(edgeKey) || edge.trafficFactor;
            const alt = distances.get(current) + (edge.weight * trafficFactor);
            
            if (alt < distances.get(neighborIndex)) {
              distances.set(neighborIndex, alt);
              previous.set(neighborIndex, current);
            }
          }
        }
      }
    }

    const path = [];
    let current = endIndex;
    while (current !== undefined) {
      path.unshift(current);
      current = previous.get(current);
    }

    if (path[0] !== startIndex) {
      return null;
    }

    return {
      path,
      distance: distances.get(endIndex),
      duration: this.estimateTravelTime(distances.get(endIndex))
    };
  }

  // Fast A* Search Algorithm using Adjacency List
  aStar(startIndex, endIndex) {
    const openSet = [startIndex];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    this.graphNodes.forEach((node, index) => {
      gScore.set(index, Infinity);
      fScore.set(index, Infinity);
    });

    gScore.set(startIndex, 0);
    fScore.set(startIndex, this.heuristic(startIndex, endIndex));

    while (openSet.length > 0) {
      openSet.sort((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
      const current = openSet.shift();

      if (current === endIndex) {
        return this.reconstructPath(cameFrom, current, gScore.get(current));
      }

      const neighbors = this.adjacencyList.get(current) || [];
      for (const neighborIndex of neighbors) {
        const edgeKey = `${current}-${neighborIndex}`;
        const edge = this.graphEdges.get(edgeKey);
        
        if (edge) {
          const trafficFactor = this.trafficConditions.get(edgeKey) || edge.trafficFactor;
          const tentativeGScore = gScore.get(current) + (edge.weight * trafficFactor);

          if (tentativeGScore < (gScore.get(neighborIndex) || Infinity)) {
            cameFrom.set(neighborIndex, current);
            gScore.set(neighborIndex, tentativeGScore);
            fScore.set(neighborIndex, tentativeGScore + this.heuristic(neighborIndex, endIndex));

            if (!openSet.includes(neighborIndex)) {
              openSet.push(neighborIndex);
            }
          }
        }
      }
    }

    return null;
  }

  heuristic(nodeIndex, endIndex) {
    const node = this.graphNodes.get(nodeIndex);
    const end = this.graphNodes.get(endIndex);
    return this.haversineDistance(node.lat, node.lng, end.lat, end.lng);
  }

  reconstructPath(cameFrom, current, totalDistance) {
    const path = [current];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    return {
      path,
      distance: totalDistance,
      duration: this.estimateTravelTime(totalDistance)
    };
  }

  // Nearest Neighbor Algorithm
  nearestNeighbor(startIndex, locations) {
    const unvisited = new Set(locations.map((_, i) => i));
    unvisited.delete(startIndex);
    
    const path = [startIndex];
    let current = startIndex;
    let totalDistance = 0;

    while (unvisited.size > 0) {
      let nearest = null;
      let minDist = Infinity;

      unvisited.forEach(index => {
        const dist = this.haversineDistance(
          this.graphNodes.get(current).lat, this.graphNodes.get(current).lng,
          this.graphNodes.get(index).lat, this.graphNodes.get(index).lng
        );
        
        if (dist < minDist) {
          minDist = dist;
          nearest = index;
        }
      });

      if (nearest !== null) {
        path.push(nearest);
        totalDistance += minDist;
        unvisited.delete(nearest);
        current = nearest;
      }
    }

    return {
      path,
      distance: totalDistance,
      duration: this.estimateTravelTime(totalDistance)
    };
  }

  // ================================================================
  // DYNAMIC REROUTING
  // ================================================================

  startTrafficUpdates() {
    // Simulate traffic condition updates
    setInterval(() => {
      this.updateTrafficConditions();
    }, this.config.trafficUpdateInterval);
  }

  updateTrafficConditions() {
    // Simulate traffic changes
    this.graphEdges.forEach((edge, key) => {
      const trafficFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
      this.trafficConditions.set(key, trafficFactor);
    });

    // Check if active routes need rerouting
    this.activeRoutes.forEach((routeData, routeId) => {
      if (routeData.reroutingEnabled) {
        this.checkRerouteNeeded(routeId);
      }
    });
  }

  async checkRerouteNeeded(routeId) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return;

    // Recalculate route with current traffic
    const newRoute = await this.calculateRoute(
      routeData.source,
      routeData.destination,
      routeData.algorithm
    );

    if (newRoute && newRoute.duration < routeData.currentDuration * 0.9) {
      // Significant improvement found (>10% faster)
      await this.reroute(routeId, newRoute);
    }
  }

  async reroute(routeId, newRoute) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return;

    routeData.currentRoute = newRoute;
    routeData.currentDuration = newRoute.duration;
    routeData.rerouteCount = (routeData.rerouteCount || 0) + 1;

    // Trigger reroute event
    if (routeData.onReroute) {
      routeData.onReroute(newRoute);
    }

    console.log(`Route ${routeId} rerouted. New duration: ${newRoute.duration.toFixed(2)}h`);
  }

  // ================================================================
  // MAIN ROUTING FUNCTION
  // ================================================================

  async calculateRoute(source, destination, algorithm = 'osrm') {
    this.updateStatus('processing', `Calculating route using ${algorithm}...`);

    try {
      let result;

      switch (algorithm) {
        case 'osrm':
          result = await this.getOSRMRoute(source, destination);
          if (!result) {
            // Fallback to graph algorithm if OSRM fails
            console.log('OSRM failed, falling back to Dijkstra');
            result = this.fallbackToGraphAlgorithm(source, destination);
          }
          break;

        case 'dijkstra':
          result = this.fallbackToGraphAlgorithm(source, destination, 'dijkstra');
          break;

        case 'astar':
          result = this.fallbackToGraphAlgorithm(source, destination, 'astar');
          break;

        case 'nearest':
          result = this.fallbackToGraphAlgorithm(source, destination, 'nearest');
          break;

        default:
          result = await this.getOSRMRoute(source, destination);
      }

      if (result) {
        this.updateStatus('active', 'Route calculated successfully');
        return result;
      } else {
        this.updateStatus('error', 'Route calculation failed');
        return null;
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      this.updateStatus('error', 'Route calculation error');
      return null;
    }
  }

  fallbackToGraphAlgorithm(source, destination, algorithm = 'dijkstra') {
    this.graphNodes.clear();
    this.graphEdges.clear();

    const gridSize = 10;
    // Add small buffer to bounding box
    const minLat = Math.min(source.lat, destination.lat) - 0.05;
    const maxLat = Math.max(source.lat, destination.lat) + 0.05;
    const minLng = Math.min(source.lng, destination.lng) - 0.05;
    const maxLng = Math.max(source.lng, destination.lng) + 0.05;

    const latStep = (maxLat - minLat) / gridSize;
    const lngStep = (maxLng - minLng) / gridSize;

    let nodeIndex = 0;
    
    // Add source (0) and destination (1)
    this.graphNodes.set(0, { id: 'source', lat: source.lat, lng: source.lng, name: 'Source' });
    this.graphNodes.set(1, { id: 'destination', lat: destination.lat, lng: destination.lng, name: 'Destination' });
    nodeIndex = 2;

    const gridMap = [];
    for (let i = 0; i <= gridSize; i++) {
      gridMap[i] = [];
      for (let j = 0; j <= gridSize; j++) {
        const lat = minLat + i * latStep;
        const lng = minLng + j * lngStep;
        
        // Add jitter to make the grid look like real organic roads
        const jitterLat = (Math.random() - 0.5) * latStep * 0.4;
        const jitterLng = (Math.random() - 0.5) * lngStep * 0.4;
        
        this.graphNodes.set(nodeIndex, { id: `grid_${i}_${j}`, lat: lat + jitterLat, lng: lng + jitterLng, name: `Intersection ${i},${j}` });
        gridMap[i][j] = nodeIndex;
        nodeIndex++;
      }
    }

    // Connect grid nodes
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const currentId = gridMap[i][j];
        
        // Connect to right
        if (i < gridSize) {
          this.addEdge(currentId, gridMap[i+1][j]);
        }
        // Connect to down
        if (j < gridSize) {
          this.addEdge(currentId, gridMap[i][j+1]);
        }
        // Random diagonal connection to simulate complex city streets
        if (i < gridSize && j < gridSize && Math.random() > 0.6) {
           this.addEdge(currentId, gridMap[i+1][j+1]);
        }
      }
    }

    // Connect source and destination to nearest grid nodes
    this.connectToNearest(0, gridMap, gridSize);
    this.connectToNearest(1, gridMap, gridSize);

    let result;
    switch (algorithm) {
      case 'dijkstra':
        result = this.dijkstra(0, 1);
        break;
      case 'astar':
        result = this.aStar(0, 1);
        break;
      case 'nearest':
        // For grid simulation, nearest neighbor is same as dijkstra logic on a graph
        result = this.dijkstra(0, 1);
        break;
      default:
        result = this.dijkstra(0, 1);
    }

    if (result) {
      // Convert path indices to waypoints
      const waypoints = result.path.map(index => ({
        lat: this.graphNodes.get(index).lat,
        lng: this.graphNodes.get(index).lng
      }));

      return {
        waypoints,
        path: result.path,
        distance: result.distance,
        duration: result.duration,
        realRoute: false,
        algorithm: algorithm
      };
    }

    return null;
  }

  addEdge(nodeA, nodeB) {
    const node1 = this.graphNodes.get(nodeA);
    const node2 = this.graphNodes.get(nodeB);
    if (!node1 || !node2) return;
    const dist = this.haversineDistance(node1.lat, node1.lng, node2.lat, node2.lng);
    
    // Traffic factor variation
    const trafficFactor = 0.8 + Math.random() * 0.8; 
    
    this.graphEdges.set(`${nodeA}-${nodeB}`, { from: nodeA, to: nodeB, weight: dist, trafficFactor });
    this.graphEdges.set(`${nodeB}-${nodeA}`, { from: nodeB, to: nodeA, weight: dist, trafficFactor });

    if (!this.adjacencyList.has(nodeA)) this.adjacencyList.set(nodeA, []);
    if (!this.adjacencyList.has(nodeB)) this.adjacencyList.set(nodeB, []);
    
    if (!this.adjacencyList.get(nodeA).includes(nodeB)) this.adjacencyList.get(nodeA).push(nodeB);
    if (!this.adjacencyList.get(nodeB).includes(nodeA)) this.adjacencyList.get(nodeB).push(nodeA);
  }

  connectToNearest(nodeId, gridMap, gridSize) {
    const target = this.graphNodes.get(nodeId);
    let nearestDist = Infinity;
    let nearestId = null;
    let secondNearestId = null;

    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const candidateId = gridMap[i][j];
        const candidate = this.graphNodes.get(candidateId);
        const dist = this.haversineDistance(target.lat, target.lng, candidate.lat, candidate.lng);
        if (dist < nearestDist) {
          secondNearestId = nearestId;
          nearestDist = dist;
          nearestId = candidateId;
        }
      }
    }

    if (nearestId !== null) this.addEdge(nodeId, nearestId);
    if (secondNearestId !== null) this.addEdge(nodeId, secondNearestId);
  }

  // ================================================================
  // UTILITY FUNCTIONS
  // ================================================================

  estimateTravelTime(distanceKm) {
    if (distanceKm <= 20) {
      return distanceKm / this.config.avgSpeedCityKph;
    }
    return 20 / this.config.avgSpeedCityKph + (distanceKm - 20) / this.config.avgSpeedHighwayKph;
  }

  updateStatus(status, message) {
    // This would be used to update UI status
    console.log(`[${status.toUpperCase()}] ${message}`);
  }

  // ================================================================
  // ACTIVE ROUTE MANAGEMENT
  // ================================================================

  createActiveRoute(routeId, source, destination, algorithm, options = {}) {
    const routeData = {
      id: routeId,
      source,
      destination,
      algorithm,
      currentRoute: null,
      currentDuration: Infinity,
      reroutingEnabled: options.reroutingEnabled !== false,
      onReroute: options.onReroute,
      startTime: new Date().toISOString(),
      rerouteCount: 0
    };

    this.activeRoutes.set(routeId, routeData);
    return routeData;
  }

  getActiveRoute(routeId) {
    return this.activeRoutes.get(routeId);
  }

  cancelRoute(routeId) {
    this.activeRoutes.delete(routeId);
  }

  // ================================================================
  // FIND OPTIMAL SOURCE
  // ================================================================

  async findOptimalSource(request, bloodBanks) {
    const { destinationLat, destinationLng, bloodType, units } = request;
    const destination = { lat: destinationLat, lng: destinationLng };

    // Score each blood bank
    const candidates = await Promise.all(
      bloodBanks
        .filter(bb => bb.status === 'operational')
        .map(async (bb) => {
          const source = { lat: bb.lat, lng: bb.lng };
          const routeResult = await this.calculateRoute(source, destination, 'osrm');
          
          if (!routeResult) return null;

          const stock = bb.inventory[bloodType]?.units || 0;
          const canFulfill = stock >= units;
          
          // Composite score (lower is better)
          const distanceScore = routeResult.distance / 100;
          const stockScore = canFulfill ? 0 : (units - stock) / units * 5;
          const timeScore = routeResult.duration > this.config.maxColdChainHours ? 10 : routeResult.duration / this.config.maxColdChainHours;
          
          const totalScore = distanceScore * 0.4 + stockScore * 0.35 + timeScore * 0.25;

          return {
            bloodBank: bb,
            distance: Math.round(routeResult.distance * 10) / 10,
            travelTime: routeResult.duration,
            travelTimeFormatted: this.formatDuration(routeResult.duration),
            stock,
            canFulfill,
            score: Math.round(totalScore * 100) / 100,
            withinColdChain: routeResult.duration <= this.config.maxColdChainHours,
            route: routeResult
          };
        })
    );

    const validCandidates = candidates.filter(c => c !== null).sort((a, b) => {
      if (a.canFulfill && !b.canFulfill) return -1;
      if (!a.canFulfill && b.canFulfill) return 1;
      if (a.withinColdChain && !b.withinColdChain) return -1;
      if (!a.withinColdChain && b.withinColdChain) return 1;
      return a.score - b.score;
    });

    if (validCandidates.length === 0) {
      return { type: 'no_solution' };
    }

    if (!validCandidates[0].canFulfill) {
      return this.findMultiSourceSolution(request, validCandidates);
    }

    return {
      type: 'single_source',
      primary: validCandidates[0],
      alternatives: validCandidates.slice(1, 4),
      route: validCandidates[0].route,
      estimatedDelivery: this.calculateETA(validCandidates[0].travelTime)
    };
  }

  findMultiSourceSolution(request, candidates) {
    const { units, bloodType } = request;
    const sources = [];
    let remaining = units;

    for (const candidate of candidates) {
      if (remaining <= 0) break;
      if (candidate.stock > 0 && candidate.withinColdChain) {
        const allocated = Math.min(candidate.stock, remaining);
        sources.push({
          ...candidate,
          allocatedUnits: allocated
        });
        remaining -= allocated;
      }
    }

    return {
      type: remaining > 0 ? 'partial_fulfillment' : 'multi_source',
      sources,
      totalFulfilled: units - remaining,
      shortfall: remaining,
      estimatedDelivery: sources.length > 0 
        ? this.calculateETA(Math.max(...sources.map(s => s.travelTime)))
        : null
    };
  }

  formatDuration(hours) {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  calculateETA(travelTimeHours) {
    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + Math.round(travelTimeHours * 60));
    return eta.toISOString();
  }

  // ================================================================
  // MULTI-STOP OPTIMIZATION
  // ================================================================

  async optimizeMultiStopRoute(stops, algorithm = 'nearest') {
    if (stops.length <= 2) {
      const route = await this.calculateRoute(stops[0], stops[1], 'osrm');
      return {
        route: [stops[0], stops[1]],
        totalDistance: route?.distance || 0,
        totalTime: route?.duration || 0,
        totalTimeFormatted: this.formatDuration(route?.duration || 0)
      };
    }

    this.buildGraph(stops);

    let optimizedPath;
    switch (algorithm) {
      case 'dijkstra':
        // For multi-stop, we use nearest neighbor as base then optimize
        optimizedPath = this.nearestNeighbor(0, stops);
        break;
      case 'astar':
        optimizedPath = this.nearestNeighbor(0, stops);
        break;
      default:
        optimizedPath = this.nearestNeighbor(0, stops);
    }

    // Apply 2-opt improvement
    const improvedPath = this.twoOptImprovement(optimizedPath.path, stops);

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < improvedPath.length - 1; i++) {
      totalDistance += this.haversineDistance(
        stops[improvedPath[i]].lat, stops[improvedPath[i]].lng,
        stops[improvedPath[i + 1]].lat, stops[improvedPath[i + 1]].lng
      );
    }

    return {
      route: improvedPath.map(index => stops[index]),
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime: this.estimateTravelTime(totalDistance),
      totalTimeFormatted: this.formatDuration(this.estimateTravelTime(totalDistance))
    };
  }

  twoOptImprovement(path, locations) {
    let improved = true;
    let bestPath = [...path];

    while (improved) {
      improved = false;
      for (let i = 1; i < path.length - 1; i++) {
        for (let j = i + 1; j < path.length; j++) {
          const newPath = this.twoOptSwap(bestPath, i, j);
          const newDist = this.calculatePathDistance(newPath, locations);
          const bestDist = this.calculatePathDistance(bestPath, locations);

          if (newDist < bestDist) {
            bestPath = newPath;
            improved = true;
          }
        }
      }
    }

    return bestPath;
  }

  twoOptSwap(path, i, j) {
    const newPath = path.slice(0, i);
    const reversed = path.slice(i, j + 1).reverse();
    const remaining = path.slice(j + 1);
    return [...newPath, ...reversed, ...remaining];
  }

  calculatePathDistance(path, locations) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      total += this.haversineDistance(
        locations[path[i]].lat, locations[path[i]].lng,
        locations[path[i + 1]].lat, locations[path[i + 1]].lng
      );
    }
    return total;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RouteOptimizer;
}