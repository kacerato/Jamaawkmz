// src/utils/geoUtils.js
import {
  calculateTotalProjectDistance as calcDistNew,
  calculateDistance as calcDistSingle,
  generateUUID as genUUID,
  embedConnectionsInPoints as embedConn,
  extractConnectionsFromPoints as extractConn
} from './calculations';

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

// --- MATH CORE (DELEGATED TO TS) ---
export const calculateDistance = calcDistSingle;
export const calculateTotalProjectDistance = calcDistNew;
export const embedConnectionsInPoints = embedConn;
export const extractConnectionsFromPoints = extractConn;

// Helpers
export const safeToFixed = (val, dec = 2) => (val === undefined || val === null || isNaN(val)) ? "0.00" : Number(val).toFixed(dec);
export const formatDistanceDetailed = (m) => m < 1 ? `${(m*100).toFixed(0)} cm` : m < 1000 ? `${m.toFixed(0)} m` : `${(m/1000).toFixed(3)} km`;
export const generateUUID = genUUID; // Use the TS one if possible, or keep the JS one if simpler
export const generateRandomColor = () => ['#1e3a8a', '#3730a3', '#dc2626', '#16a34a', '#d97706'][Math.floor(Math.random()*5)];

// Aliases
export const calculateTotalDistance = calculateTotalProjectDistance;
export const calculateTotalDistanceWithBranches = calculateTotalProjectDistance;
