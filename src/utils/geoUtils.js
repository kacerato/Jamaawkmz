// src/utils/geoUtils.js

// --- Classes Utilitárias ---

export class KalmanFilter {
  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R;
    this.Q = Q;
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
  static async snapToRoad(lat, lng, radius = 50) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      );
      
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
      console.warn('Erro no snapping de rua:', error);
    }
    
    return { lat, lng, snapped: false };
  }
  
  static async snapMultiplePoints(points) {
    const snappedPoints = [];
    for (const point of points) {
      const snapped = await this.snapToRoad(point.lat, point.lng);
      snappedPoints.push({
        ...point,
        lat: snapped.lat,
        lng: snapped.lng,
        originalLat: point.lat,
        originalLng: point.lng
      });
      // Delay pequeno para não ser bloqueado pela API (rate limit)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return snappedPoints;
  }
}

// --- Funções Puras ---

export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
      v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateRandomColor = () => {
  const colors = [
    '#1e3a8a', '#3730a3', '#5b21b6', '#7c2d12', '#831843',
    '#0f766e', '#1e40af', '#334155', '#475569', '#6b21a8',
    '#86198f', '#9d174d', '#be185d', '#7e22ce', '#6d28d9',
    '#4338ca', '#374151', '#4b5563', '#1f2937', '#111827'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return "0".padStart(decimals + 2, '0');
  }
  return Number(value).toFixed(decimals);
};

export const formatDistanceDetailed = (distanceInMeters) => {
  if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
    return "0 m";
  }
  const distance = Number(distanceInMeters);
  if (distance < 1) return `${(distance * 100).toFixed(0)} cm`;
  else if (distance < 1000) return `${distance.toFixed(0)} m`;
  else if (distance < 10000) return `${(distance / 1000).toFixed(2)} km`;
  else return `${(distance / 1000).toFixed(1)} km`;
};

// Cálculo de Alta Precisão (WGS-84)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6378137;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const calculateTotalDistance = (points) => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(
      points[i].lat, points[i].lng,
      points[i + 1].lat, points[i + 1].lng
    );
  }
  return total;
};

export const calculateTotalDistanceWithBranches = (points) => {
  if (points.length < 2) return 0;
  let total = 0;
  
  const mainPathPoints = points.filter(point => point.connectedFrom === null);
  for (let i = 0; i < mainPathPoints.length - 1; i++) {
    total += calculateDistance(
      mainPathPoints[i].lat, mainPathPoints[i].lng,
      mainPathPoints[i + 1].lat, mainPathPoints[i + 1].lng
    );
  }
  
  const branchPoints = points.filter(point => point.connectedFrom !== null);
  for (const branchPoint of branchPoints) {
    const parentPoint = points.find(p => p.id === branchPoint.connectedFrom);
    if (parentPoint) {
      total += calculateDistance(
        parentPoint.lat, parentPoint.lng,
        branchPoint.lat, branchPoint.lng
      );
    }
  }
  return total;
};