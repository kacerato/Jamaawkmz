// src/utils/geoUtils.js

const R_EARTH = 6378137; // Raio da Terra (WGS-84)

// --- CLASSES ---
export class KalmanFilter {
  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R; this.Q = Q; this.A = A; this.B = B; this.C = C;
    this.cov = NaN; this.x = NaN;
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'JamaawApp/1.0' } }
      );
      const data = await response.json();
      if (data && data.lat && data.lon) {
        return { lat: parseFloat(data.lat), lng: parseFloat(data.lon), snapped: true };
      }
    } catch (e) { console.warn(e); }
    return { lat, lng, snapped: false };
  }
}

// --- MATH CORE ---
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// A ÚNICA FUNÇÃO QUE IMPORTA
export const calculateTotalProjectDistance = (points, connections = []) => {
  if (!points || points.length < 2) return 0;
  
  let totalDistance = 0;
  const pointMap = new Map(points.map(p => [p.id, p]));

  // 1. Distância da Árvore Principal (Ramificações + Sequencial)
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    // Ignora o primeiro ponto se ele não tiver pai explícito (raiz)
    // Mas calcula se for sequencial (índice > 0 e sem pai definido e não é gap)
    let parent = null;

    if (point.connectedFrom) {
      // Ramificação explícita
      parent = pointMap.get(point.connectedFrom);
    } else if (i > 0 && !point.isGap) {
      // Sequencial implícito (Modo simples)
      parent = points[i - 1];
    }

    if (parent) {
      const dist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);
      // CORREÇÃO CRÍTICA: Aplica o multiplicador de vãos (AG) aqui
      // Se spans for undefined ou null, assume 1
      const multiplier = (point.spans && !isNaN(point.spans)) ? parseInt(point.spans) : 1;
      totalDistance += (dist * multiplier);
    }
  }

  // 2. Distância de Conexões Extras (Loops/Fechamentos de anel)
  if (Array.isArray(connections)) {
    for (const conn of connections) {
      const p1 = pointMap.get(conn.fromId);
      const p2 = pointMap.get(conn.toId);
      
      if (p1 && p2) {
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        // Aplica multiplicador na conexão extra também
        const multiplier = (conn.spans && !isNaN(conn.spans)) ? parseInt(conn.spans) : 1;
        totalDistance += (dist * multiplier);
      }
    }
  }

  return totalDistance;
};

// Helpers
export const safeToFixed = (val, dec = 2) => (val === undefined || val === null || isNaN(val)) ? "0.00" : Number(val).toFixed(dec);
export const formatDistanceDetailed = (m) => m < 1 ? `${(m*100).toFixed(0)} cm` : m < 1000 ? `${m.toFixed(0)} m` : `${(m/1000).toFixed(3)} km`;
export const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
export const generateRandomColor = () => ['#1e3a8a', '#3730a3', '#dc2626', '#16a34a', '#d97706'][Math.floor(Math.random()*5)];

// Aliases para não quebrar imports antigos, mas todos apontam para a nova lógica
export const calculateTotalDistance = calculateTotalProjectDistance;
export const calculateTotalDistanceWithBranches = calculateTotalProjectDistance;