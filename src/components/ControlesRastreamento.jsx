import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, MapPin, Save, Navigation, Layers, Undo, MousePointer, X } from 'lucide-react';

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
  // Novas props para o modo régua
  undoLastPoint,
  // Novas props para seleção de ponto
  selectingContinuePoint,
  setSelectingContinuePoint,
  selectedContinuePoint,
  cancelContinueSelection,
  formatDistanceDetailed
}) => {
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeTrackingMode = trackingMode || 'manual';
  const safeGpsAccuracy = gpsAccuracy || 0;
  const safeSpeed = speed || 0;

  // Função para formatar distância detalhada (fallback caso não seja passada como prop)
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

  // Encontrar a posição do ponto selecionado para continuar
  const getSelectedPointPosition = () => {
    if (!selectedContinuePoint) return null;
    const index = safeManualPoints.findIndex(p => p.id === selectedContinuePoint.id);
    return index !== -1 ? index + 1 : null;
  };

  const selectedPointPosition = getSelectedPointPosition();

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-bottom">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-lg border border-slate-600/50 rounded-xl shadow-2xl p-3 min-w-[320px] max-w-[95vw] tracking-controls-container">
        
        {/* Header compacto */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
            <span className="text-white text-sm font-medium points-counter">
              {paused ? 'Pausado' : 'Ativo'} • {safeManualPoints.length} pontos
            </span>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">
              {formatDistance(safeTotalDistance)}
            </p>
            <p className="text-cyan-400 text-xs">
              {safeTrackingMode === 'manual' ? 'Modo Manual' : 'Modo Régua'}
            </p>
          </div>
        </div>

        {/* Botões principais */}
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
            title={paused ? 'Continuar rastreamento' : 'Pausar rastreamento'}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>

          {/* Botão de Alinhamento - APENAS NO MODO MANUAL */}
          {safeTrackingMode === 'manual' && (
            <Button
              onClick={onToggleSnapping}
              size="sm"
              className={`h-9 tracking-button snapping-toggle ${
                snappingEnabled 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              }`}
              title={snappingEnabled ? 'Alinhamento ativo' : 'Alinhamento inativo'}
            >
              <Navigation className="w-4 h-4" />
            </Button>
          )}

          {/* Botão de Voltar Ponto - APENAS SE HOUVER PONTOS */}
          {safeManualPoints.length > 0 && (
            <Button
              onClick={undoLastPoint}
              disabled={safeManualPoints.length === 0}
              size="sm"
              className="h-9 tracking-button bg-orange-500 hover:bg-orange-600 text-white"
              title="Voltar último ponto"
            >
              <Undo className="w-4 h-4" />
            </Button>
          )}

          {/* Botão de Ponto Manual/Selecionar para Continuar */}
          {safeTrackingMode === 'manual' ? (
            <Button
              onClick={addManualPoint}
              disabled={paused || !currentPosition}
              size="sm"
              className="h-9 tracking-button bg-blue-500 hover:bg-blue-600 text-white"
              title="Adicionar ponto manual"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (selectingContinuePoint) {
                  // Cancelar seleção se já estiver selecionando
                  setSelectingContinuePoint(false);
                  cancelContinueSelection && cancelContinueSelection();
                } else {
                  // Iniciar modo de seleção
                  setSelectingContinuePoint(true);
                }
              }}
              size="sm"
              className={`h-9 tracking-button ${
                selectingContinuePoint 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
              title={selectingContinuePoint ? "Cancelar seleção de ponto" : "Selecionar ponto para continuar"}
            >
              <MousePointer className="w-4 h-4" />
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

        {/* Status info compacta */}
        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              safeTrackingMode === 'manual' && snappingEnabled ? 'bg-green-500 animate-pulse' : 
              selectingContinuePoint ? 'bg-purple-500 animate-pulse' : 'bg-gray-500'
            }`}></div>
            <span>
              {selectingContinuePoint ? 'Selecionando...' : 
               safeTrackingMode === 'manual' ? 'Manual' : 'Régua'}
            </span>
            {currentProject && (
              <span className="text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded text-[10px]">
                {currentProject.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {safeTrackingMode === 'manual' && safeGpsAccuracy > 0 && (
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
            {safeTrackingMode === 'manual' && safeSpeed > 0.5 && (
              <span className="text-cyan-400" title="Velocidade atual">
                {Math.round(safeSpeed * 3.6)}km/h
              </span>
            )}
            {safeTrackingMode === 'ruler' && !selectingContinuePoint && (
              <span className="text-green-400" title="Modo Régua Ativo">
                Clique no mapa
              </span>
            )}
            {selectingContinuePoint && (
              <span className="text-purple-400 animate-pulse" title="Selecionando ponto">
                Clique em um ponto
              </span>
            )}
          </div>
        </div>

        {/* Indicador de qualidade do GPS - APENAS NO MODO MANUAL */}
        {safeTrackingMode === 'manual' && safeGpsAccuracy > 0 && (
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

        {/* Indicador de ponto selecionado para continuar */}
        {selectedContinuePoint && selectedPointPosition && (
          <div className="mt-2 p-2 bg-purple-500/20 border border-purple-500/40 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-purple-300 font-medium">
                Continuando do ponto {selectedPointPosition}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedContinuePoint && setSelectedContinuePoint(null);
                  setSelectingContinuePoint && setSelectingContinuePoint(false);
                }}
                className="h-5 text-xs bg-purple-500 hover:bg-purple-600 text-white"
                title="Cancelar continuação"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-purple-200 text-[10px] mt-1">
              Novos pontos serão inseridos APÓS este ponto
            </p>
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
                title="Ver detalhes do projeto"
              >
                Detalhes
              </Button>
              <Button
                onClick={handleRemovePoints}
                size="sm"
                className="flex-1 text-xs h-7 bg-red-500 hover:bg-red-600 text-white"
                title="Limpar pontos do projeto"
              >
                Limpar
              </Button>
            </div>
          </div>
        )}

        {/* Seção de seleção múltipla */}
        {selectedMarkers && selectedMarkers.length > 0 && (
          <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-400">{selectedMarkers.length} marcadores selecionados</span>
              <Button
                size="sm"
                onClick={() => setSelectedMarkers && setSelectedMarkers([])}
                className="h-5 text-xs bg-cyan-500 hover:bg-cyan-600 text-white"
                title="Limpar seleção"
              >
                <Layers className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
        )}

        {/* Botão Salvar Projeto */}
        {safeManualPoints.length > 0 && !showProjectDialog && (
          <div className="mt-3 pt-2 border-t border-slate-600/50">
            <Button
              onClick={() => setShowProjectDialog(true)}
              size="sm"
              className="w-full h-8 tracking-button bg-purple-500 hover:bg-purple-600 text-white"
              title="Salvar projeto"
            >
              <Save className="w-4 h-4 mr-1" />
              Salvar Projeto
            </Button>
          </div>
        )}

        {/* Indicador de modo de seleção ativo */}
        {selectingContinuePoint && (
          <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-purple-400 animate-pulse">Modo Seleção Ativo</span>
              <span className="text-purple-300 text-[10px]">
                Clique em qualquer ponto do traçado
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlesRastreamento;
