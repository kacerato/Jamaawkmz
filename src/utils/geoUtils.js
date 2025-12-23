// src/utils/geoUtils.js

// --- CONSTANTES ---
const R_EARTH = 6378137; // Raio da Terra em metros (WGS-84)

// --- FILTRO AVANÇADO DE GPS ---
export class GPSFilter {
  constructor(minAccuracy = 25, minDistance = 0.5) {
    this.minAccuracy = minAccuracy; // Ignora pontos com precisão pior que X metros
    this.minDistance = minDistance; // Ignora movimentos menores que X metros (jitter)
    this.lastValidPoint = null;
  }

  isValid(newPoint) {
    // 1. Rejeita se a precisão for ruim (ex: > 25m de erro)
    // Se a internet cair, a precisão ("accuracy") geralmente sobe para 50m+. Isso filtra esses pontos.
    if (newPoint.accuracy && newPoint.accuracy > this.minAccuracy) {
      console.warn(`GPS: Ponto ignorado (Precisão baixa: ${newPoint.accuracy}m)`);
      return false;
    }

    // 2. Rejeita se não houver movimento significativo (evita o boneco "tremendo" parado)
    if (this.lastValidPoint) {
      const dist = calculateDistance(
        this.lastValidPoint.lat, this.lastValidPoint.lng,
        newPoint.lat, newPoint.lng
      );
      if (dist < this.minDistance) {
        return false;
      }
    }

    this.lastValidPoint = newPoint;
    return true;
  }
}

// --- KALMAN FILTER (Mantido e Ajustado) ---
export class KalmanFilter {
  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R; // Ruído da medição (Aumente se o GPS for instável)
    this.Q = Q; // Ruído do processo
    this.A = A; 
    this.B = B; 
    this.C = C; 
    this.cov = NaN;
    this.x = NaN; 
  }
  
  filter(z, u = 0) {
    if (isNaN(this.x)) {
      this.x = (1 / this.C) * z;
      this.cov = (1 / this.C) * this.Q * (1 / this.C);
    } else {
      const predX = (this.A * this.x) + (this.B * u);
      const predCov = ((this.A * this.cov) * this.A) + this.Q;
      const K = predCov * this.C * (1 / ((this.C * predCov * this.C) + this.R));
      this.x = predX + K * (z - (this.C * predX));
      this.cov = predCov - (K * this.C * predCov);
    }
    return this.x;
  }
}

export class RoadSnappingService {
  static async snapToRoad(lat, lng) {
    try {
      // Adicionado timeout para não travar se a internet estiver ruim
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos max

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, 
        { 
          headers: { 'User-Agent': 'JamaawApp/1.0' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data && data.lat && data.lon) {
        return {
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lon),
          address: data.address,
          snapped: true
        };
      }
    } catch (error) {
      // Silencioso, pois falhar aqui é normal offline
    }
    
    return { lat, lng, snapped: false };
  }
}

// --- CÁLCULO GEODÉSICO (Referência Única) ---
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH * c;
}

export const calculateTotalProjectDistance = (points, connections = []) => {
  if (!points || points.length < 2) return 0;
  
  let totalDistance = 0;
  const pointMap = new Map();
  for (const p of points) pointMap.set(p.id, p);
  
  // Distância Linear
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let parent = null;
    
    if (point.connectedFrom) parent = pointMap.get(point.connectedFrom);
    else if (i > 0 && !point.isGap) parent = points[i - 1];
    
    if (parent) {
      const dist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);
      const spans = point.spans || 1;
      totalDistance += (dist * spans);
    }
  }
  
  // Distância Conexões Extras (Loops)
  if (connections && connections.length > 0) {
    for (const conn of connections) {
      const p1 = pointMap.get(conn.fromId);
      const p2 = pointMap.get(conn.toId);
      
      if (p1 && p2) {
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const spans = conn.spans || 1;
        totalDistance += (dist * spans);
      }
    }
  }
  
  return totalDistance;
};

// --- FORMATAÇÃO VISUAL CENTRALIZADA ---
export const formatDistanceDetailed = (distanceInMeters) => {
  if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
    return "0 m";
  }
  const distance = Number(distanceInMeters);
  if (distance < 1) return `${(distance * 100).toFixed(0)} cm`;
  else if (distance < 1000) return `${distance.toFixed(0)} m`;
  else if (distance < 10000) return `${(distance / 1000).toFixed(2)} km`;
  else return `${(distance / 1000).toFixed(3)} km`;
};

export const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) return "0".padStart(decimals + 2, '0');
  return Number(value).toFixed(decimals);
};

export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateRandomColor = () => {
  const colors = ['#1e3a8a', '#3730a3', '#5b21b6', '#7c2d12', '#0f766e', '#b91c1c'];
  return colors[Math.floor(Math.random() * colors.length)];
};