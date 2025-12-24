// hooks/useMapRef.js - Versão corrigida
import { useRef, useCallback, useEffect } from 'react';

export const useMapRef = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  const setMapRef = useCallback((node) => {
    if (node && node.getMap) {
      mapRef.current = node;
      mapInstanceRef.current = node.getMap();
    }
  }, []);
  
  const flyToSafe = useCallback((options) => {
    if (mapInstanceRef.current && typeof mapInstanceRef.current.flyTo === 'function') {
      try {
        // Garantir que o mapa está pronto
        if (!mapInstanceRef.current.loaded()) {
          setTimeout(() => flyToSafe(options), 100);
          return false;
        }
        
        mapInstanceRef.current.flyTo(options);
        return true;
      } catch (error) {
        console.warn('Erro no flyTo:', error);
        // Tentar fallback mais seguro
        if (mapInstanceRef.current && options.center) {
          mapInstanceRef.current.jumpTo({
            center: options.center,
            zoom: options.zoom || 16
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
  
  const isMapReady = useCallback(() => {
    return mapInstanceRef.current !== null && mapInstanceRef.current.loaded();
  }, []);
  
  return {
    mapRef: setMapRef,
    flyToSafe,
    getMapInstance,
    isMapReady
  };
};