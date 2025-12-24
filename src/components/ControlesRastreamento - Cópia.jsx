import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, MapPin, Save, Navigation, Undo, MousePointerClick, X } from 'lucide-react';

const ControlesRastreamento = ({
  tracking,
  paused,
  pauseTracking,
  addManualPoint,
  stopTracking,
  setShowProjectDialog,
  setShowProjectDetails,
  manualPoints,
  totalDistance,
  trackingMode,
  currentPosition,
  currentProject,
  snappingEnabled,
  onToggleSnapping,
  gpsAccuracy,
  speed,
  handleRemovePoints,
  showProjectDialog,
  selectedMarkers = [],
  setSelectedMarkers,
  undoLastPoint,
  formatDistanceDetailed,
  selectedStartPoint,
  resetStartPoint
}) => {
  
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const isTouchMode = trackingMode && trackingMode.toLowerCase().includes('toque');
  const safeGpsAccuracy = gpsAccuracy || 0;
  
  // Referência para o card para capturar movimento
  const cardRef = useRef(null);
  
  // Efeito "Context Aware Glow"
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };
  
  const formatDistance = (distanceInMeters) => {
    if (formatDistanceDetailed) {
      return formatDistanceDetailed(distanceInMeters);
    }
    
    if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
      return "0 m";
    }
    
    const distance = Number(distanceInMeters);
    
    if (distance < 1) {
      return `${(distance * 100).toFixed(0)} cm`;
    } else if (distance < 1000) {
      return `${distance.toFixed(0)} m`;
    } else if (distance < 10000) {
      return `${(distance / 1000).toFixed(2)} km`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  };
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-bottom w-full max-w-[360px] px-2">
      {/* Container Principal com Efeito Glow */}
      <div 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        className="group relative rounded-2xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl tracking-controls-container"
        style={{
          '--mouse-x': '50%',
          '--mouse-y': '50%',
        }}
      >
        {/* Camada de Glow do Background */}
        <div 
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.15), transparent 40%)`,
          }}
        />

        {/* Camada de Glow da Borda (Shine Border) */}
        <div 
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.6), transparent 40%)`,
            maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
            WebkitMaskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1.5px'
          }}
        />

        {/* Conteúdo Real */}
        <div className="relative p-4 bg-slate-900/80 backdrop-blur-xl h-full rounded-2xl">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500'} shadow-[0_0_10px_currentColor]`}></div>
                {!paused && <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>}
              </div>
              <div className="flex flex-col">
                <span className="text-white text-xs font-bold tracking-wider uppercase opacity-80">
                  {paused ? 'Pausado' : 'Rastreando'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {safeManualPoints.length} PONTOS
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 font-black text-xl leading-none tracking-tight">
                {formatDistance(safeTotalDistance)}
              </p>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                {isTouchMode ? (
                  <MousePointerClick className="w-3 h-3 text-cyan-500" />
                ) : (
                  <Navigation className="w-3 h-3 text-cyan-500" />
                )}
                <p className="text-cyan-500/80 text-[10px] font-bold uppercase tracking-widest">
                  {trackingMode || 'Manual'}
                </p>
              </div>
            </div>
          </div>

          {/* Grid de Controles */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {/* Botão Pausar/Continuar */}
            <Button
              onClick={pauseTracking}
              className={`h-12 rounded-xl border transition-all duration-300 ${
                paused 
                  ? 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                  : 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
              }`}
            >
              {paused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
            </Button>

            {/* Botão Snap */}
            <Button
              onClick={onToggleSnapping}
              className={`h-12 rounded-xl border transition-all duration-300 ${
                snappingEnabled 
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Navigation className={`w-5 h-5 ${snappingEnabled ? 'fill-current' : ''}`} />
            </Button>

            {/* Botão Desfazer */}
            <Button
              onClick={undoLastPoint}
              disabled={safeManualPoints.length === 0}
              className="h-12 rounded-xl bg-slate-800 border border-slate-700 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 hover:text-orange-300 transition-all duration-300"
            >
              <Undo className="w-5 h-5" />
            </Button>

            {/* Botão Add Ponto (Principal) */}
            <Button
              onClick={() => addManualPoint()}
              disabled={paused || !currentPosition}
              className={`h-12 rounded-xl border transition-all duration-300 relative overflow-hidden group/btn ${
                selectedStartPoint 
                  ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' 
                  : 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_20px_rgba(8,145,178,0.3)]'
              }`}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
              <MapPin className="w-5 h-5 fill-current relative z-10" />
            </Button>
          </div>
          
          {/* Botão Parar */}
          <div className="mb-3">
             <Button
              onClick={stopTracking}
              className="w-full h-10 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300 font-semibold text-xs uppercase tracking-wide"
            >
              <Square className="w-3.5 h-3.5 mr-2 fill-current" /> Encerrar Sessão
            </Button>
          </div>

          {/* Info Bar */}
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
               {currentProject ? (
                 <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 rounded border border-slate-700 max-w-full">
                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0"></div>
                   <span className="text-[10px] text-cyan-300 truncate font-medium max-w-[120px] block">
                     {currentProject.name}
                   </span>
                 </div>
               ) : (
                 <span className="text-[10px] text-slate-500 italic truncate">
                   {isTouchMode ? 'Toque no mapa' : 'Caminhe para rastrear'}
                 </span>
               )}
            </div>
            
            <div className="flex items-center gap-2">
              {!isTouchMode && safeGpsAccuracy > 0 && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded border bg-slate-800/50 ${
                  safeGpsAccuracy <= 10 ? 'border-green-500/30 text-green-400' : 
                  safeGpsAccuracy <= 20 ? 'border-yellow-500/30 text-yellow-400' : 
                  'border-red-500/30 text-red-400'
                }`}>
                  <div className="w-1 h-1 rounded-full bg-current"></div>
                  <span className="text-[10px] font-mono font-bold">±{Math.round(safeGpsAccuracy)}m</span>
                </div>
              )}
            </div>
          </div>

          {/* Ações de Projeto Carregado (Botão Detalhes REMOVIDO) */}
          {currentProject && safeManualPoints.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <Button
                onClick={handleRemovePoints}
                className="w-full h-8 rounded-lg bg-slate-800 hover:bg-red-950/30 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-400 text-[10px] uppercase font-bold tracking-wider transition-all"
              >
                Limpar Pontos do Mapa
              </Button>
            </div>
          )}

          {/* Botão Salvar (Só aparece se não for projeto carregado ou se tiver modificações) */}
          {safeManualPoints.length > 0 && !showProjectDialog && !currentProject && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <Button
                onClick={() => setShowProjectDialog(true)}
                className="w-full h-9 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-purple-900/20 font-bold text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                Salvar Projeto
              </Button>
            </div>
          )}
        </div>
      </div> 
    </div>
  );
};

export default ControlesRastreamento;