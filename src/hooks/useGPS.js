// src/hooks/useGPS.js
import { useState, useEffect, useRef } from 'react';
import { KalmanFilter } from '../utils/geoUtils'; // Importe do seu arquivo de utils criado anteriormente

export function useGPS(tracking, paused) {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [history, setHistory] = useState([]);
  
  // Referências para os filtros (não resetam no re-render)
  const kalmanLatRef = useRef(new KalmanFilter(0.1, 0.1));
  const kalmanLngRef = useRef(new KalmanFilter(0.1, 0.1));
  
  useEffect(() => {
    let watchId = null;
    
    if (navigator.geolocation) {
      // Configuração de Alta Precisão
      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      };
      
      const success = (position) => {
        const { latitude, longitude, accuracy: acc, speed: spd } = position.coords;
        
        // Aplica o filtro de Kalman
        const smoothedLat = kalmanLatRef.current.filter(latitude);
        const smoothedLng = kalmanLngRef.current.filter(longitude);
        
        const newPos = { lat: smoothedLat, lng: smoothedLng };
        
        setCurrentPosition(newPos);
        setAccuracy(acc);
        setSpeed(spd || 0);
        
        // Mantém histórico curto (ex: para rastro visual imediato)
        setHistory(prev => {
          const newHistory = [...prev, {
            ...newPos,
            timestamp: Date.now(),
            accuracy: acc
          }].slice(-20); // Guarda apenas os últimos 20 pontos
          return newHistory;
        });
      };
      
      const error = (err) => {
        console.error('Erro GPS:', err);
        // Fallback simples se falhar o watch
        navigator.geolocation.getCurrentPosition(success, null, { enableHighAccuracy: false });
      };
      
      watchId = navigator.geolocation.watchPosition(success, error, options);
    }
    
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [tracking, paused]); // Recria o listener se o estado de tracking mudar (opcional, pode ser [] se quiser gps sempre ligado)
  
  return { currentPosition, accuracy, speed, history };
}