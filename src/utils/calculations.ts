// src/utils/calculations.ts

export interface Point {
  id: string | number;
  lat: number;
  lng: number;
  connectedFrom?: string | number | null;
  spans?: number | string; // vãos
  isGap?: boolean;
  [key: string]: any; // Allow other properties
}

export interface ExtraConnection {
  fromId: string | number;
  toId: string | number;
  spans?: number | string;
}

const R_EARTH = 6378137; // Earth Radius (WGS-84)

/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Calculates the total project distance, respecting "vãos" (spans) multiplier.
 * Standardizes the calculation across the entire app.
 */
const calculateTotalProjectDistance = (points: Point[], extraConnections: ExtraConnection[] = []): number => {
  if (!points || points.length < 2) return 0;

  let totalDistance = 0;
  const pointMap = new Map<string | number, Point>();
  points.forEach(p => pointMap.set(String(p.id), p)); // Force string keys for consistency

  // 1. Main Tree Distance (Branches + Sequential)
  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    // Determine the "parent" point (where this point connects FROM)
    let parent: Point | undefined;

    if (point.connectedFrom !== null && point.connectedFrom !== undefined) {
      // Explicit branching
      parent = pointMap.get(String(point.connectedFrom));
    } else if (i > 0 && !point.isGap) {
      // Implicit sequential connection (default behavior if no branching logic is active)
      // Checks if the previous point exists and is not a "gap" (start of a new disconnected segment)
      parent = points[i - 1];
    }

    if (parent) {
      const dist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);

      // APPLY SPANS (Vãos)
      // The 'spans' property is on the *target* point (the end of the segment).
      const spans = point.spans ? Number(point.spans) : 1;
      const multiplier = isNaN(spans) ? 1 : spans;

      totalDistance += (dist * multiplier);
    }
  }

  // 2. Extra Connections (Loops)
  if (Array.isArray(extraConnections)) {
    for (const conn of extraConnections) {
      const p1 = pointMap.get(String(conn.fromId));
      const p2 = pointMap.get(String(conn.toId));

      if (p1 && p2) {
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const spans = conn.spans ? Number(conn.spans) : 1;
        const multiplier = isNaN(spans) ? 1 : spans;
        totalDistance += (dist * multiplier);
      }
    }
  }

  return totalDistance;
};

/**
 * Merges extra_connections into the points array as a special property to persist data
 * without needing a separate SQL column.
 *
 * Strategy: Store outgoing extra connections on the 'from' point.
 */
const embedConnectionsInPoints = (points: Point[], extraConnections: ExtraConnection[]): Point[] => {
  if (!extraConnections || extraConnections.length === 0) return points;

  // Deep copy to avoid mutating state directly
  const newPoints = points.map(p => ({ ...p, _extraConnections: [] as ExtraConnection[] }));

  extraConnections.forEach(conn => {
    const sourcePoint = newPoints.find(p => String(p.id) === String(conn.fromId));
    if (sourcePoint) {
      if (!sourcePoint._extraConnections) sourcePoint._extraConnections = [];
      sourcePoint._extraConnections.push(conn);
    }
  });

  return newPoints;
};

/**
 * Extracts extra_connections from the points array (restoring state from DB).
 */
const extractConnectionsFromPoints = (points: Point[]): ExtraConnection[] => {
  if (!points) return [];

  const connections: ExtraConnection[] = [];

  points.forEach(p => {
    if (p._extraConnections && Array.isArray(p._extraConnections)) {
      connections.push(...p._extraConnections);
    }
  });

  return connections;
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export {
  calculateDistance,
  calculateTotalProjectDistance,
  embedConnectionsInPoints,
  extractConnectionsFromPoints
};
