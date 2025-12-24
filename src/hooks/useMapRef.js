// hooks/useMapRef.js
import { useRef, useCallback } from 'react';

export const useMapRef = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  const setMapRef = useCallback((node) => {
    mapRef.current = node;
    if (node && node.getMap) {
      mapInstanceRef.current = node.getMap();
    }
  }, []);
  
  const flyToSafe = useCallback((options) => {
    if (mapInstanceRef.current && typeof mapInstanceRef.current.flyTo === 'function') {
      try {
        mapInstanceRef.current.flyTo(options);
        return true;
      } catch (error) {
        console.warn('Erro no flyTo, usando jumpTo:', error);
        if (typeof mapInstanceRef.current.jumpTo === 'function') {
          mapInstanceRef.current.jumpTo({
            center: options.center,
            zoom: options.zoom || 14
          });
        }
        return false;
      }
    }
    return false;
  }, []);
  
  const getMapInstance = useCallback(() => {
    return mapInstanceRef.current;
  }, []);
  
  return {
    mapRef: setMapRef,
    flyToSafe,
    getMapInstance,
    isMapReady: () => mapInstanceRef.current !== null
  };
};