import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, MapPin, Save, FolderOpen, Navigation, Clock, Info } from 'lucide-react';

// Função de proteção global
const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return "0".padStart(decimals + 2, '0');
  }
  return Number(value).toFixed(decimals);
};

const safeRound = (value) => {
  if (value === undefined || value === null || isNaN(value)) {
    return 0;
  }
  return Math.round(Number(value));
};

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
  gpsAccuracy,
  speed,
}) => {
  // Validar todos os valores recebidos
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeTrackingMode = trackingMode || 'manual';
  const safeGpsAccuracy = gpsAccuracy || 0;
  const safeSpeed = speed || 0;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-bottom">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-lg border border-slate-600/50 rounded-2xl shadow-2xl p-4 min-w-[320px] max-w-[90vw] tracking-controls-container">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${paused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'} border-2 border-white`}></div>
              {!paused && (
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">
                {paused ? 'Rastreamento Pausado' : 'Rastreamento Ativo'}
              </h3>
              <p className="text-cyan-400 text-xs font-medium">
                {safeManualPoints.length === 1 ? '1 ponto' : `${safeManualPoints.length} pontos`} • {safeTrackingMode === 'manual' ? 'Modo Manual' : 'Modo Automático'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {safeTotalDistance < 1000 ? `${safeRound(safeTotalDistance)} m` : `${safeToFixed(safeTotalDistance / 1000, 3)} km`}
            </p>
            <p className="text-cyan-400 text-xs font-medium">Distância total</p>
          </div>
        </div>

        {currentProject && (
          <div className="mb-3 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 font-medium text-sm">Projeto Atual:</span>
            </div>
            <p className="text-white text-sm font-medium truncate">{currentProject.name}</p>
            <p className="text-cyan-400 text-xs">
              {currentProject.points?.length || 0} pontos • {safeToFixed((currentProject.totalDistance || currentProject.total_distance || 0) / 1000, 2)} km
            </p>
          </div>
        )}

        <div className="w-full bg-slate-600/50 rounded-full h-2 mb-4">
          <div
            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min((safeTotalDistance / 5000) * 100, 100)}%`
            }}
          ></div>
        </div>

        <div className="flex gap-2 mb-3 tracking-controls-grid">
          <Button
            onClick={pauseTracking}
            className={`tracking-button ${paused
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white'
              }`}
          >
            {paused ? (
              <>
                <Play className="w-4 h-4 mr-1" />
                <span>Retomar</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-1" />
                <span>Pausar</span>
              </>
            )}
          </Button>

          {safeTrackingMode === 'manual' && (
            <Button
              onClick={addManualPoint}
              disabled={paused || !currentPosition}
              className="tracking-button bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium"
            >
              <MapPin className="w-4 h-4 mr-1" />
              <span>Add Ponto</span>
            </Button>
          )}

          {safeManualPoints.length > 0 && (
            <Button
              onClick={() => setShowProjectDialog(true)}
              className="tracking-button bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-medium"
            >
              <Save className="w-4 h-4 mr-1" />
              <span>Salvar</span>
            </Button>
          )}

          {currentProject && (
            <Button
              onClick={() => setShowProjectDetails(true)}
              className="tracking-button bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium"
            >
              <Info className="w-4 h-4 mr-1" />
              <span>Detalhes</span>
            </Button>
          )}

          <Button
            onClick={stopTracking}
            className="tracking-button bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-medium"
          >
            <Square className="w-4 h-4 mr-1" />
            <span>Parar</span>
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${snappingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-cyan-400 text-xs font-medium">
              Alinhamento {snappingEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {safeGpsAccuracy > 0 && (
              <div className="flex items-center gap-1">
                <Navigation className="w-3 h-3 text-cyan-400" />
                <span className={`font-medium ${safeGpsAccuracy <= 10 ? 'text-green-400' :
                    safeGpsAccuracy <= 20 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                  ±{safeToFixed(safeGpsAccuracy, 0)}m
                </span>
              </div>
            )}
            {safeSpeed > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span className="text-cyan-400 font-medium">
                  {safeToFixed(safeSpeed * 3.6, 1)} km/h
                </span>
              </div>
            )}
          </div>
        </div>

        {safeTotalDistance > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-600/50">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="text-center">
                <div className="text-gray-400">Distância Atual</div>
                <div className="text-white font-bold">
                  {safeTotalDistance < 1000 ?
                    `${safeRound(safeTotalDistance)} metros` :
                    `${safeToFixed(safeTotalDistance / 1000, 3)} quilômetros`
                  }
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Pontos no Traçado</div>
                <div className="text-white font-bold">
                  {safeManualPoints.length} {safeManualPoints.length === 1 ? 'ponto' : 'pontos'}
                </div>
              </div>
            </div>

            {safeGpsAccuracy > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Precisão do GPS</span>
                  <span className={safeGpsAccuracy <= 10 ? 'text-green-400' : safeGpsAccuracy <= 20 ? 'text-yellow-400' : 'text-red-400'}>
                    {safeGpsAccuracy <= 10 ? 'Excelente' : safeGpsAccuracy <= 20 ? 'Boa' : 'Baixa'}
                  </span>
                </div>
                <div className="w-full bg-slate-600/50 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${safeGpsAccuracy <= 10 ? 'bg-green-500' :
                        safeGpsAccuracy <= 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    style={{ width: `${Math.max(0, 100 - (safeGpsAccuracy * 5))}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Informações de Status Adicionais */}
        <div className="mt-3 pt-3 border-t border-slate-600/50">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-gray-400">Modo</div>
              <div className={`font-bold ${safeTrackingMode === 'manual' ? 'text-blue-400' : 'text-green-400'}`}>
                {safeTrackingMode === 'manual' ? 'Manual' : 'Automático'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Pontos</div>
              <div className="text-white font-bold">
                {safeManualPoints.length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Status</div>
              <div className={`font-bold ${paused ? 'text-yellow-400' : 'text-green-400'}`}>
                {paused ? 'Pausado' : 'Ativo'}
              </div>
            </div>
          </div>
        </div>

        {/* Dicas Contextuais */}
        {safeTrackingMode === 'automatic' && !paused && (
          <div className="mt-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-blue-400 text-xs text-center">
              🎯 Modo automático: Pontos são adicionados automaticamente a cada 5 segundos
            </p>
          </div>
        )}

        {safeTrackingMode === 'manual' && !paused && (
          <div className="mt-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <p className="text-purple-400 text-xs text-center">
              👆 Modo manual: Clique em "Add Ponto" para marcar localizações
            </p>
          </div>
        )}

        {paused && (
          <div className="mt-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-yellow-400 text-xs text-center">
              ⏸️ Rastreamento pausado - Pontos não estão sendo coletados
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlesRastreamento;