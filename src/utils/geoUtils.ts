// src/utils/geoUtils.ts
import { Point, Connection } from '../types';

// --- CONSTANTES ---
const R_EARTH = 6378137; // Raio da Terra em metros (WGS-84)

// --- CLASSES UTILITÁRIAS (Necessárias para o GPS e Build) ---

export class KalmanFilter {
  R: number; // Ruído da medição
  Q: number; // Ruído do processo
  A: number; // Estado
  B: number; // Controle
  C: number; // Medição
  cov: number;
  x: number; // Valor filtrado

  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R;
    this.Q = Q;
    this.A = A;
    this.B = B;
    this.C = C;
    this.cov = NaN;
    this.x = NaN;
  }
  
  filter(z: number, u = 0): number {
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

// ADICIONADO: Classe GPSFilter exportada
export class GPSFilter {
  minAccuracy: number;
  minMovement: number;
  lastValidPoint: { lat: number; lng: number } | null;

  constructor(minAccuracy = 30, minMovement = 0.5) {
    this.minAccuracy = minAccuracy;
    this.minMovement = minMovement;
    this.lastValidPoint = null;
  }

  isValid(point: { lat: number; lng: number; accuracy: number }): boolean {
    if (point.accuracy > this.minAccuracy) {
      return false;
    }

    if (!this.lastValidPoint) {
      this.lastValidPoint = point;
      return true;
    }

    const dist = calculateDistance(
      this.lastValidPoint.lat,
      this.lastValidPoint.lng,
      point.lat,
      point.lng
    );

    if (dist >= this.minMovement) {
      this.lastValidPoint = point;
      return true;
    }

    return false;
  }
}

interface SnappedLocation {
    lat: number;
    lng: number;
    address?: any;
    snapped: boolean;
}

export class RoadSnappingService {
  static async snapToRoad(lat: number, lng: number): Promise<SnappedLocation> {
    try {
      // Usa Nominatim (OSM) para achar a rua mais próxima
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'JamaawApp/1.0' } }
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
    
    // Fallback: retorna original se falhar
    return { lat, lng, snapped: false };
  }
}

// --- CÁLCULO GEODÉSICO DE ALTA PRECISÃO ---
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === undefined || lat1 === null || lon1 === undefined || lon1 === null ||
      lat2 === undefined || lat2 === null || lon2 === undefined || lon2 === null) return 0;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH * c;
}

export const normalizeSpans = (spans: any): number => {
  if (spans !== undefined && spans !== null && !isNaN(Number(spans))) {
    return Math.max(1, Number(spans));
  }
  return 1;
};

// --- A FUNÇÃO MESTRA DE METRAGEM (BRUTALMENTE OTIMIZADA) ---
export const calculateTotalProjectDistance = (points: Point[] | null, connections: Connection[] = []): number => {
  if (!points || !Array.isArray(points) || points.length < 2) return 0;
  
  let totalDistance = 0;
  
  // 1. Mapa de Hash para acesso O(1)
  const pointMap = new Map<string, Point>();
  for (const p of points) {
    if (p && p.id) {
        pointMap.set(p.id, p);
    }
  }
  
  // 2. Calcula Distância das Ramificações (Árvore Principal)
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;

    let parent: Point | undefined | null = null;
    
    // Prioridade: connectedFrom explícito > Sequencial (se não for gap e não for o primeiro)
    if (point.connectedFrom && pointMap.has(point.connectedFrom)) {
      parent = pointMap.get(point.connectedFrom);
    } else if (i > 0 && !point.isGap && !point.connectedFrom) {
      // Fallback legado: sequencial apenas se não tiver connectedFrom definido
      parent = points[i - 1];
    }
    
    if (parent) {
      const dist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);

      // PARSE INT EXPLICITO PARA EVITAR ERROS DE STRING/JSON
      let spans = Number(point.spans);
      if (isNaN(spans) || spans < 1) spans = 1;

      totalDistance += (dist * spans);
    }
  }
  
  // 3. Calcula Distância das Conexões Extras (Loops/Anéis)
  if (connections && Array.isArray(connections) && connections.length > 0) {
    for (const conn of connections) {
      const p1 = pointMap.get(conn.fromId);
      const p2 = pointMap.get(conn.toId);
      
      if (p1 && p2) {
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);

        // PARSE INT TAMBÉM NAS CONEXÕES
        let spans = Number(conn.spans);
        if (isNaN(spans) || spans < 1) spans = 1;

        totalDistance += (dist * spans);
      }
    }
  }
  
  return totalDistance;
};

// --- ALIAS PARA COMPATIBILIDADE ---
export const calculateTotalDistanceWithBranches = calculateTotalProjectDistance;
export const calculateTotalDistance = calculateTotalProjectDistance;

// --- FORMATAÇÃO VISUAL E HELPERS ---

export const safeToFixed = (value: number | string | null | undefined, decimals = 2): string => {
  if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
    return "0".padStart(decimals + 2, '0');
  }
  return Number(value).toFixed(decimals);
};

export const formatDistanceDetailed = (distanceInMeters: number | string | null | undefined): string => {
  if (distanceInMeters === undefined || distanceInMeters === null || (typeof distanceInMeters === 'number' && isNaN(distanceInMeters))) {
    return "0 m";
  }
  const distance = Number(distanceInMeters);
  if (distance < 1) return `${(distance * 100).toFixed(0)} cm`;
  else if (distance < 1000) return `${distance.toFixed(0)} m`;
  else if (distance < 10000) return `${(distance / 1000).toFixed(2)} km`;
  else return `${(distance / 1000).toFixed(3)} km`;
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0,
      v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateRandomColor = (): string => {
  const colors = ['#1e3a8a', '#3730a3', '#5b21b6', '#7c2d12', '#0f766e', '#b91c1c'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// ADICIONADO: calculateTrackingDistance (simples, sequencial, para fallback)
export const calculateTrackingDistance = (points: Point[]): number => {
  if (!points || points.length < 2) return 0;
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += calculateDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return dist;
};
