// Global types for the application

export interface User {
  id: string;
  email?: string;
  full_name?: string;
}

export interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  descricao?: string;
  bairro?: string;
  color?: string;
  user_id?: string;
  created_at?: string;
}

export interface Point {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  created_by?: string;
  user_id?: string;
  user_email?: string;
  connectedFrom?: string | null;
  spans?: number;
  isGap?: boolean;
  photos?: string[];
  name?: string;
  description?: string;
  color?: string; // e.g. '#FF0000'
}

export interface Connection {
  fromId: string;
  toId: string;
  spans?: number;
}

export interface Project {
  id: string;
  name: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  points: Point[];
  connections?: Connection[];
  extra_connections?: Connection[];
  totalDistance?: number;
  total_distance?: number;
  bairro?: string;
  color?: string;
  tracking_mode?: string;
}

export interface Member {
  user_id: string;
  role: 'owner' | 'viewer' | 'editor';
  joined_at: string;
  email?: string;
  name?: string;
  stats?: {
    points: number;
    distance: number;
  };
}

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: number;
}
