// components/ARCamera.jsx
import { useEffect, useRef, useState } from 'react';
import { Camera, Compass, MapPin, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ARCamera = ({ 
  markers = [], 
  currentPosition, 
  onClose,
  manualPoints = []
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [compassHeading, setCompassHeading] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Inicializar câmera
  useEffect(() => {
    startCamera();
    startCompass();

    return () => {
      stopCamera();
      stopCompass();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const startCompass = () => {
    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    } else {
      console.log('Bússola não suportada neste dispositivo');
    }
  };

  const stopCompass = () => {
    window.removeEventListener('deviceorientation', handleDeviceOrientation);
  };

  const handleDeviceOrientation = (event) => {
    if (event.alpha !== null) {
      setCompassHeading(event.alpha);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Calcular distância e direção para marcadores
  const calculateMarkerPosition = (marker) => {
    if (!currentPosition) return null;

    const R = 6371e3; // Raio da Terra em metros
    const φ1 = currentPosition.lat * Math.PI / 180;
    const φ2 = marker.lat * Math.PI / 180;
    const Δφ = (marker.lat - currentPosition.lat) * Math.PI / 180;
    const Δλ = (marker.lng - currentPosition.lng) * Math.PI / 180;

    // Distância
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Direção (bearing)
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;

    return { distance, bearing };
  };

  // Renderizar marcadores AR
  useEffect(() => {
    if (!canvasRef.current || !isCameraActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const drawFrame = () => {
      // Limpar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Desenhar bússola
      drawCompass(ctx, canvas);
      
      // Desenhar marcadores
      const allMarkers = [...markers, ...manualPoints];
      allMarkers.forEach(marker => {
        drawARMarker(ctx, canvas, marker);
      });
      
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  }, [markers, manualPoints, currentPosition, compassHeading, isCameraActive]);

  const drawCompass = (ctx, canvas) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 100;
    const radius = 40;

    // Círculo da bússola
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ponteiro norte
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((-compassHeading * Math.PI) / 180);
    
    ctx.beginPath();
    ctx.moveTo(0, -radius + 5);
    ctx.lineTo(-10, -radius + 25);
    ctx.lineTo(10, -radius + 25);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    
    ctx.restore();

    // Texto
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - radius - 10);
    ctx.fillText(`${Math.round(compassHeading)}°`, centerX, centerY + 5);
  };

  const drawARMarker = (ctx, canvas, marker) => {
    const markerData = calculateMarkerPosition(marker);
    if (!markerData) return;

    const { distance, bearing } = markerData;
    
    // Calcular posição no canvas baseado na direção
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Ângulo relativo à direção atual da câmera
    const relativeBearing = (bearing - compassHeading + 360) % 360;
    
    // Se o marcador está atrás do usuário, não mostrar
    if (Math.abs(relativeBearing - 180) > 90) return;
    
    // Converter para coordenadas de tela
    const fov = 60; // Campo de visão em graus
    const screenX = centerX + (relativeBearing - 180) * (canvas.width / fov);
    const screenY = centerY - (distance / 50); // Ajuste de escala

    // Desenhar marcador apenas se estiverem na tela
    if (screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height) {
      // Círculo do marcador
      ctx.beginPath();
      ctx.arc(screenX, screenY, 15, 0, 2 * Math.PI);
      ctx.fillStyle = marker.isManual ? 'rgba(59, 130, 246, 0.8)' : 'rgba(34, 197, 94, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ícone interno
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📍', screenX, screenY);

      // Linha de distância
      ctx.beginPath();
      ctx.moveTo(screenX, screenY + 15);
      ctx.lineTo(screenX, screenY + 40);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Texto de distância
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`,
        screenX,
        screenY + 60
      );

      // Nome do marcador (se próximo)
      if (distance < 50) {
        ctx.fillText(
          marker.name || `Ponto ${marker.id}`,
          screenX,
          screenY + 80
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video da câmera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      
      {/* Canvas overlay para AR */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        width={window.innerWidth}
        height={window.innerHeight}
      />
      
      {/* Controles overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <Button
          onClick={onClose}
          size="icon"
          className="bg-red-500 hover:bg-red-600 text-white shadow-lg"
        >
          <X className="w-5 h-5" />
        </Button>
        
        <div className="flex gap-2">
          <Button
            onClick={toggleCamera}
            size="icon"
            className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
          >
            <Camera className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Informações na parte inferior */}
      <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold">Modo AR Ativo</span>
          </div>
          <div className="text-sm">
            {markers.length + manualPoints.length} marcadores visíveis
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Postes Importados: {markers.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Pontos Manuais: {manualPoints.length}</span>
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-300">
          📍 Aponte a câmera para visualizar postes no mundo real
          <br />
          🧭 Use a bússola para navegar até os marcadores
        </div>
      </div>

      {/* Indicador de loading */}
      {!isCameraActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p>Inicializando câmera AR...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ARCamera;