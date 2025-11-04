import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, MapPin, Save, Navigation } from 'lucide-react';

const ControlesRastreamento = ({
  tracking,
  paused,
  pauseTracking,
  addManualPoint,
  stopTracking,
  setShowProjectDialog,
  manualPoints,
  totalDistance,
  trackingMode,
  currentPosition,
  snappingEnabled,
  gpsAccuracy,
  speed,
}) => {
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeTrackingMode = trackingMode || 'manual';
  const safeGpsAccuracy = gpsAccuracy || 0;
  const safeSpeed = speed || 0;
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-bottom">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-lg border border-slate-600/50 rounded-xl shadow-2xl p-3 min-w-[280px] max-w-[95vw]">
        
        {/* Header compacto */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
            <span className="text-white text-sm font-medium">
              {paused ? 'Pausado' : 'Ativo'} • {safeManualPoints.length}p
            </span>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">
              {safeTotalDistance < 1000 ? 
                `${Math.round(safeTotalDistance)}m` : 
                `${(safeTotalDistance / 1000).toFixed(1)}km`
              }
            </p>
          </div>
        </div>

        {/* Botões principais */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <Button
            onClick={pauseTracking}
            size="sm"
            className={`h-9 ${paused ?
                'bg-green-500 hover:bg-green-600 text-white' :
                'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>

          {safeTrackingMode === 'manual' && (
            <Button
              onClick={addManualPoint}
              disabled={paused || !currentPosition}
              size="sm"
              className="h-9 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          )}

          {safeManualPoints.length > 0 && (
            <Button
              onClick={() => setShowProjectDialog(true)}
              size="sm"
              className="h-9 bg-purple-500 hover:bg-purple-600 text-white"
            >
              <Save className="w-4 h-4" />
            </Button>
          )}

          <Button
            onClick={stopTracking}
            size="sm"
            className="h-9 bg-red-500 hover:bg-red-600 text-white"
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>

        {/* Status info compacta */}
        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${snappingEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            <span>{safeTrackingMode === 'manual' ? 'Manual' : 'Auto'}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {safeGpsAccuracy > 0 && (
              <span className={safeGpsAccuracy <= 10 ? 'text-green-400' : safeGpsAccuracy <= 20 ? 'text-yellow-400' : 'text-red-400'}>
                ±{Math.round(safeGpsAccuracy)}m
              </span>
            )}
            {safeSpeed > 0.5 && (
              <span className="text-cyan-400">
                {Math.round(safeSpeed * 3.6)}km/h
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlesRastreamento;