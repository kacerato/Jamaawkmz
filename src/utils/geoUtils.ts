// src/utils/geoUtils.ts

// --- CONSTANTES ---
const R_EARTH = 6378137; // Raio da Terra em metros (WGS-84)

// --- TIPOS ---
export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  id?: string;
  connectedFrom?: string;
  isGap?: boolean;
  spans?: number | string;
  [key: string]: any;
}

export interface Connection {
  fromId: string;
  toId: string;
  spans?: number | string;
  [key: string]: any;
}

export interface ProjectData {
  points?: GeoPoint[];
  extra_connections?: Connection[];
  total_distance?: number;
  totalDistance?: number;
  [key: string]: any;
}

// --- FILTRO AVANÇADO DE GPS ---
export class GPSFilter {
  private minAccuracy: number;
  private minDistance: number;
  private lastValidPoint: GeoPoint | null;

  constructor(minAccuracy = 30, minDistance = 0.5) {
    this.minAccuracy = minAccuracy;
    this.minDistance = minDistance;
    this.lastValidPoint = null;
  }

  isValid(newPoint: GeoPoint): boolean {
    // 1. Rejeita precisão ruim
    if (newPoint.accuracy && newPoint.accuracy > this.minAccuracy) {
      return false;
    }
    // 2. Rejeita jitter (movimento minúsculo)
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

// --- KALMAN FILTER ---
export class KalmanFilter {
  private R: number;
  private Q: number;
  private A: number;
  private B: number;
  private C: number;
  private cov: number;
  private x: number;

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

export class RoadSnappingService {
  static async snapToRoad(lat: number, lng: number): Promise<{ lat: number; lng: number; address?: any; snapped: boolean }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

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
      // Falha silenciosa
    }
    return { lat, lng, snapped: false };
  }
}

// --- CÁLCULO GEODÉSICO ---
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH * c;
};

// --- A FUNÇÃO CRÍTICA DE CÁLCULO TOTAL (CORRIGIDA E OTIMIZADA) ---
export const calculateTotalProjectDistance = (points: GeoPoint[], connections: Connection[] = []): number => {
  if (!points || points.length < 2) return 0;
  
  let totalDistance = 0;
  const pointMap = new Map<string, GeoPoint>();
  
  // Mapear pontos para acesso rápido
  for (const p of points) {
    if (p && p.id) {
      pointMap.set(p.id, p);
    }
  }
  
  // 1. Distância Sequencial / Ramificações
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point || !point.lat || !point.lng) continue;

    let parent: GeoPoint | null | undefined = null;
    
    // Encontrar ponto pai (conexão ou sequencial)
    if (point.connectedFrom) {
      parent = pointMap.get(point.connectedFrom);
    } else if (i > 0 && !point.isGap) {
      parent = points[i - 1];
    }
    
    if (parent && parent.lat && parent.lng) {
      const dist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);

      // Multiplicador de Vãos (Spans) - CRÍTICO
      const spans = (point.spans !== undefined && point.spans !== null) ?
                    Number(point.spans) : 1;

      // Garantir que spans seja um número válido
      const validSpans = isNaN(spans) || spans < 1 ? 1 : Math.max(1, spans);

      totalDistance += (dist * validSpans);
    }
  }
  
  // 2. Distância de Conexões Extras (Loops)
  if (connections && Array.isArray(connections) && connections.length > 0) {
    for (const conn of connections) {
      const p1 = pointMap.get(conn.fromId);
      const p2 = pointMap.get(conn.toId);
      
      if (p1 && p2 && p1.lat && p1.lng && p2.lat && p2.lng) {
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const spans = (conn.spans !== undefined && conn.spans !== null) ?
                      Number(conn.spans) : 1;

        const validSpans = isNaN(spans) || spans < 1 ? 1 : Math.max(1, spans);
        totalDistance += (dist * validSpans);
      }
    }
  }
  
  return totalDistance;
};

// --- FUNÇÃO AUXILIAR PARA CÁLCULO RÁPIDO DE DISTÂNCIA DURANTE RASTREAMENTO ---
export const calculateTrackingDistance = (points: GeoPoint[]): number => {
  if (!points || points.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];

    if (current && previous && current.lat && current.lng && previous.lat && previous.lng) {
      const dist = calculateDistance(previous.lat, previous.lng, current.lat, current.lng);
      const spans = (current.spans !== undefined && current.spans !== null) ?
                    Number(current.spans) : 1;

      const validSpans = isNaN(spans) || spans < 1 ? 1 : Math.max(1, spans);
      totalDistance += (dist * validSpans);
    }
  }

  return totalDistance;
};

// --- FORMATAÇÃO E UTILITÁRIOS ---
export const safeToFixed = (value: number | null | undefined, decimals = 2): string => {
  if (value === undefined || value === null || isNaN(value)) return "0".padStart(decimals + 2, '0');
  return Number(value).toFixed(decimals);
};

export const formatDistanceDetailed = (distanceInMeters: number | null | undefined): string => {
  if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
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
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateRandomColor = (): string => {
  const colors = ['#1e3a8a', '#3730a3', '#5b21b6', '#7c2d12', '#0f766e', '#b91c1c'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// --- NOVA FUNÇÃO: ATUALIZAÇÃO DE DISTÂNCIA EM TEMPO REAL ---
export const updateProjectDistance = (project: ProjectData): ProjectData => {
  if (!project) return project;

  const { points = [], extra_connections = [] } = project;
  const totalDistance = calculateTotalProjectDistance(points, extra_connections);

  return {
    ...project,
    total_distance: totalDistance,
    totalDistance: totalDistance // Mantém compatibilidade
  };
};

// --- NOVA FUNÇÃO: VALIDAÇÃO E NORMALIZAÇÃO DE SPANS ---
export const normalizeSpans = (points: GeoPoint[] = []): GeoPoint[] => {
  return points.map(point => ({
    ...point,
    spans: (point.spans !== undefined && point.spans !== null && !isNaN(Number(point.spans))) ?
           Math.max(1, Number(point.spans)) : 1
  }));
};
