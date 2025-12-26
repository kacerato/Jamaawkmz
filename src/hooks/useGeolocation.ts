import { useState, useRef, useEffect, useCallback } from 'react';
import { KalmanFilter, GPSFilter } from '../utils/geoUtils';
import { Point } from '../types';

export interface GeoPosition {
  lat: number;
  lng: number;
}

export type TrackingMode = 'gps' | 'touch' | 'manual';

export const useGeolocation = () => {
  const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('gps');
  const [paused, setPaused] = useState<boolean>(false);
  const [positionHistory, setPositionHistory] = useState<Point[]>([]);

  // Refs for filters to persist across renders without causing re-renders
  const kalmanLatRef = useRef<KalmanFilter>(new KalmanFilter(0.1, 0.1));
  const kalmanLngRef = useRef<KalmanFilter>(new KalmanFilter(0.1, 0.1));
  const gpsFilterRef = useRef<GPSFilter>(new GPSFilter(30, 0.5));
  const watchIdRef = useRef<number | null>(null);

  const startTracking = useCallback((mode: TrackingMode = 'gps') => {
    setIsTracking(true);
    setTrackingMode(mode);
    setPaused(false);

    // Reset filters
    kalmanLatRef.current = new KalmanFilter(0.1, 0.1);
    kalmanLngRef.current = new KalmanFilter(0.1, 0.1);
    gpsFilterRef.current = new GPSFilter(30, 0.5);
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setPaused(false);
    setTrackingMode('gps');
    setPositionHistory([]);
    setGpsAccuracy(null);
    setSpeed(0);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const togglePause = useCallback(() => {
    setPaused(prev => !prev);
  }, []);

  useEffect(() => {
    // Only run GPS logic if tracking is active, not paused, and mode is 'gps'
    // Or if we just want to track user position even if not recording (standard behavior often is tracking user location always, but recording only when "tracking")
    // App.jsx: navigator.geolocation.watchPosition is inside a useEffect that depends on [tracking, paused]
    // But it seems App.jsx updates currentPosition even if not tracking?
    // "watchId = navigator.geolocation.watchPosition" is inside "useEffect(..., [tracking, paused])"
    // In App.jsx code:
    // useEffect(() => { ... if (navigator.geolocation) { watchId = ... } }, [tracking, paused])
    // It updates currentPosition.
    // AND it adds to positionHistory (likely only used for debugging or trailing).

    // Refined logic: Always watch position to show user on map?
    // App.jsx logic seems to imply it always runs because it cleans up and restarts on tracking/paused change.
    // Wait, if I look closely at App.jsx:
    // It runs `watchPosition`. Inside callback:
    // 1. `gpsFilterRef.current.isValid(rawPoint)`
    // 2. `setCurrentPosition`, `setGpsAccuracy`, `setSpeed`
    // 3. `setPositionHistory`

    // It seems it updates `currentPosition` regardless of `tracking` state in the code block I read?
    // Actually the useEffect has `[tracking, paused]` dependencies.
    // But it doesn't check `if (tracking)` inside the effect to START watching.
    // It starts watching whenever the effect runs.
    // However, usually we want `currentPosition` to be available even when not "recording a track".

    const handlePositionUpdate = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed: rawSpeed } = position.coords;
      const rawPoint = {
        id: 'gps-raw',
        lat: latitude,
        lng: longitude,
        timestamp: Date.now(),
        accuracy
      };

      // Filter Logic
      if (gpsFilterRef.current.isValid(rawPoint)) {
        const smoothedLat = kalmanLatRef.current.filter(latitude);
        const smoothedLng = kalmanLngRef.current.filter(longitude);

        const smoothedPosition = { lat: smoothedLat, lng: smoothedLng };

        setCurrentPosition(smoothedPosition);
        setGpsAccuracy(accuracy);
        setSpeed(rawSpeed || 0);

        // Only add to history if we want to visualize the trail or debugging
        setPositionHistory(prev => {
           const newHistory = [...prev, {
             id: `gps-${Date.now()}`,
             lat: smoothedLat,
             lng: smoothedLng,
             timestamp: Date.now(),
             accuracy: accuracy
           }].slice(-10); // Keep last 10
           return newHistory;
        });

      } else {
        // Weak GPS or stationary
        setGpsAccuracy(accuracy);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Error obtaining location:', error);
      // Fallback for getting at least one position
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.error('Fallback location error:', err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
      );
    };

    if (navigator.geolocation) {
      // We always watch position to update the "You are here" marker
      // The "recording" logic (adding points to a project) is handled by the consumer of this hook (App.jsx or ProjectContext)
      // observing `currentPosition` changes when `isTracking` is true.

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []); // Run once on mount to start watching? Or depend on tracking settings if we want to change accuracy?
  // App.jsx had [tracking, paused].
  // If we change tracking mode, maybe we don't need to restart watchPosition unless we want to save battery?
  // For now, let's keep it simple: always watch.

  return {
    currentPosition,
    gpsAccuracy,
    speed,
    isTracking,
    trackingMode,
    paused,
    positionHistory,
    startTracking,
    stopTracking,
    togglePause
  };
};
