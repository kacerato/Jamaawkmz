// src/utils/geoUtils.js

// --- CONSTANTES ---
const R_EARTH = 6378137; // Raio da Terra em metros (WGS-84)

// --- CÁLCULO GEODÉSICO DE ALTA PRECISÃO ---
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

// --- A FUNÇÃO MESTRA DE METRAGEM ---
// Esta é a ÚNICA função que deve ser usada em todo o app.
export const calculateTotalProjectDistance = (points, connections = []) => {
  if (!points || points.length < 2) return 0;
  
  let totalDistance = 0;

  // 1. Cria um Mapa de Hash para acesso instantâneo (Performance O(1))
  // Isso faz o cálculo ser instantâneo mesmo com 10.000 pontos
  const pointMap = new Map();
  for (const p of points) {
    pointMap.set(p.id, p);
  }

  // 2. Calcula Distância das Ramificações (Árvore Principal)
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let parent = null;

    if (point.connectedFrom) {
      // Se tem pai explícito (Ramificação)
      parent = pointMap.get(point.connectedFrom);
    } else if (i > 0 && !point.isGap) {
      // Fallback para lógica sequencial antiga (se necessário)
      parent = points[i - 1];
    }

    if (parent) {
      const dist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);
      const spans = point.spans || 1; // Multiplicador AG
      totalDistance += (dist * spans);
    }
  }

  // 3. Calcula Distância das Conexões Extras (Loops/Anéis)
  if (connections && connections.length > 0) {
    for (const conn of connections) {
      const p1 = pointMap.get(conn.fromId);
      const p2 = pointMap.get(conn.toId);

      if (p1 && p2) {
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const spans = conn.spans || 1; // Multiplicador AG
        totalDistance += (dist * spans);
      }
    }
  }

  return totalDistance;
};

// --- FORMATAÇÃO VISUAL ---
export const formatDistanceDetailed = (distanceInMeters) => {
  if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
    return "0 m";
  }
  const distance = Number(distanceInMeters);
  if (distance < 1) return `${(distance * 100).toFixed(0)} cm`;
  else if (distance < 1000) return `${distance.toFixed(0)} m`;
  else if (distance < 10000) return `${(distance / 1000).toFixed(2)} km`;
  else return `${(distance / 1000).toFixed(3)} km`; // 3 casas decimais para precisão (ex: 12.345 km)
};

// --- OUTROS UTILITÁRIOS ---
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