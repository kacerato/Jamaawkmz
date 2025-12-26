export interface Point {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  connectedFrom?: string | null;
  spans?: number;
  user_id?: string;
  user_email?: string;
  photos?: string[]; // Base64 strings
  isGap?: boolean; // Added back to support gap logic
}

export interface ExtraConnection {
  fromId: string;
  toId: string;
  spans?: number;
}

export interface Project {
  id: string | number;
  name: string;
  points: Point[];
  extra_connections?: ExtraConnection[];
  total_distance: number;
  totalDistance?: number; // Legacy support
  bairro?: string;
  tracking_mode?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  color?: string; // UI only
  locked_by?: string;
  lock_expires_at?: string;
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

export interface User {
  id: string;
  email?: string;
  aud: string;
  created_at: string;
}

export type TrackingMode = 'gps' | 'touch' | 'manual';
