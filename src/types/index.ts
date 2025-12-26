// Global types for the application

export interface User {
  id: string;
  email?: string;
  full_name?: string;
  aud?: string;
  created_at?: string;
}

export interface Point {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number; // Used in GPSFilter
  created_by?: string;
  user_id?: string;
  user_email?: string;
  connectedFrom?: string | null;
  spans?: number;
  isGap?: boolean;
  photos?: string[]; // Base64 strings
  name?: string;
  description?: string;
  color?: string; // e.g. '#FF0000'
  bairro?: string;
  rua?: string;
  descricao?: string;
}

export interface Connection {
  fromId: string;
  toId: string;
  spans?: number;
}

export interface Project {
  id: string | number; // Support both for legacy/new
  name: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  points: Point[];
  extra_connections?: Connection[]; // Matches DB/JS usage
  total_distance: number;
  totalDistance?: number; // Legacy support
  bairro?: string;
  tracking_mode?: string;
  color?: string;
  locked_by?: string | null;
  lock_expires_at?: string | null;
}

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
}

export interface SnappedPoint {
  lat: number;
  lng: number;
  address?: unknown; // Using unknown as structure wasn't fully detailed in JS
  snapped: boolean;
}

export interface MarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  descricao?: string;
  bairro?: string;
  color?: string;
  user_id?: string;
  created_at?: string;
  rua?: string;
}
