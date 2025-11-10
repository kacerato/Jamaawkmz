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
}) => {
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeTrackingMode = trackingMode || 'manual';
  const safeGpsAccuracy = gpsAccuracy || 0;
  const safeSpeed = speed || 0;
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-bottom">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-lg border border-slate-600/50 rounded-xl shadow-2xl p-3 min-w-[320px] max-w-[95vw] tracking-controls-container">
        
        {/* Header compacto - ATUALIZADO COM ANIMAÇÃO */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
            <span className="text-white text-sm font-medium points-counter">
              {paused ? 'Pausado' : 'Ativo'} • {safeManualPoints.length} pontos
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

        {/* Botões principais - AGORA COM 5 COLUNAS */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {/* Botão Pausar/Continuar */}
          <Button
            onClick={pauseTracking}
            size="sm"
            className={`h-9 tracking-button ${
              paused 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>

          {/* Botão de Alinhamento - NOVO */}
          <Button
            onClick={onToggleSnapping}
            size="sm"
            className={`h-9 tracking-button snapping-toggle ${
              snappingEnabled 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-gray-500 hover:bg-gray-600 text-white'
            }`}
            title={snappingEnabled ? 'Alinhamento ativo - Clique para desativar' : 'Alinhamento inativo - Clique para ativar'}
          >
            <Navigation className="w-4 h-4" />
          </Button>

          {/* Botão de Ponto Manual */}
          {safeTrackingMode === 'manual' && (
            <Button
              onClick={addManualPoint}
              disabled={paused || !currentPosition}
              size="sm"
              className="h-9 tracking-button bg-blue-500 hover:bg-blue-600 text-white"
              title="Adicionar ponto manual"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          )}

          {/* Botão Salvar Projeto */}
          {safeManualPoints.length > 0 && !showProjectDialog && (
            <Button
              onClick={() => setShowProjectDialog(true)}
              size="sm"
              className="h-9 tracking-button bg-purple-500 hover:bg-purple-600 text-white"
              title="Salvar projeto"
            >
              <Save className="w-4 h-4" />
            </Button>
          )}

          {/* Botão Parar Rastreamento */}
          <Button
            onClick={stopTracking}
            size="sm"
            className="h-9 tracking-button bg-red-500 hover:bg-red-600 text-white"
            title="Parar rastreamento"
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>

        {/* Status info compacta - ATUALIZADA COM INDICADOR DE ALINHAMENTO */}
        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${snappingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span>{safeTrackingMode === 'manual' ? 'Manual' : 'Auto'}</span>
            {currentProject && (
              <span className="text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded text-[10px]">
                {currentProject.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {safeGpsAccuracy > 0 && (
              <span 
                className={
                  safeGpsAccuracy <= 10 ? 'text-green-400' : 
                  safeGpsAccuracy <= 20 ? 'text-yellow-400' : 
                  'text-red-400'
                }
                title="Precisão do GPS"
              >
                ±{Math.round(safeGpsAccuracy)}m
              </span>
            )}
            {safeSpeed > 0.5 && (
              <span className="text-cyan-400" title="Velocidade atual">
                {Math.round(safeSpeed * 3.6)}km/h
              </span>
            )}
          </div>
        </div>

        {/* Informações adicionais em modo automático */}
        {safeTrackingMode === 'automatic' && !paused && (
          <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400">Modo Automático</span>
              <span className="text-green-300">
                {safeSpeed > 0.5 ? 'Em movimento' : 'Aguardando movimento'}
              </span>
            </div>
            <div className="text-[10px] text-green-300 mt-1">
              Pontos automáticos a cada 10m
            </div>
          </div>
        )}

        {/* Indicador de qualidade do GPS */}
        {safeGpsAccuracy > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Qualidade do GPS:</span>
              <span>
                {safeGpsAccuracy <= 10 ? 'Excelente' : 
                 safeGpsAccuracy <= 20 ? 'Boa' : 
                 safeGpsAccuracy <= 50 ? 'Moderada' : 'Ruim'}
              </span>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${
                  safeGpsAccuracy <= 10 ? 'bg-green-500' : 
                  safeGpsAccuracy <= 20 ? 'bg-yellow-500' : 
                  safeGpsAccuracy <= 50 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.max(10, 100 - (safeGpsAccuracy * 2))}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Ações rápidas para projetos carregados */}
        {currentProject && safeManualPoints.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-600/50">
            <div className="flex gap-2">
              <Button
                onClick={() => setShowProjectDetails(true)}
                size="sm"
                className="flex-1 text-xs h-7 bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                Detalhes
              </Button>
              <Button
                onClick={handleRemovePoints}
                size="sm"
                className="flex-1 text-xs h-7 bg-red-500 hover:bg-red-600 text-white"
              >
                Limpar
              </Button>
            </div>
          </div>
        )}
      </div> 
      // Adicionar no componente ControlesRastreamento, antes do fechamento do último div:
{selectedMarkers.length > 0 && (
  <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
    <div className="flex items-center justify-between text-xs">
      <span className="text-cyan-400">{selectedMarkers.length} marcadores selecionados</span>
      <Button
        size="sm"
        onClick={() => setSelectedMarkers([])}
        className="h-5 text-xs bg-cyan-500 hover:bg-cyan-600 text-white"
      >
        Limpar
      </Button>
    </div>
  </div>
)}
      </div>
  );
};

export default ControlesRastreamento;