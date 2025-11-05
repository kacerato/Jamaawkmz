// components/ResumoProjeto.jsx - Versão atualizada
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ruler, MapPin, Navigation, Save, BarChart3 } from 'lucide-react';

const ResumoProjeto = ({ manualPoints, totalDistance, selectedBairro, trackingMode, segmentDistances }) => {
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeSelectedBairro = selectedBairro || 'todos';
  const safeTrackingMode = trackingMode || 'manual';
  const safeSegmentDistances = segmentDistances || [];
  
  // Calcular métricas por segmento
  const segmentStats = safeSegmentDistances.reduce((acc, segment, index) => {
    acc.total += segment.distance;
    acc.segments.push({
      number: index + 1,
      distance: segment.distance,
      from: segment.from,
      to: segment.to
    });
    return acc;
  }, { total: 0, segments: [] });
  
  return (
    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
      <p className="text-sm text-cyan-400 font-medium mb-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Métricas Detalhadas do Projeto
      </p>
      
      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{safeManualPoints.length}</div>
          <div className="text-gray-400 text-xs">Pontos Totais</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{safeToFixed(safeTotalDistance / 1000, 2)} km</div>
          <div className="text-gray-400 text-xs">Distância Total</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{safeSelectedBairro !== 'todos' ? safeSelectedBairro : 'Vários'}</div>
          <div className="text-gray-400 text-xs">Bairro</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{safeTrackingMode === 'manual' ? 'Manual' : 'Automático'}</div>
          <div className="text-gray-400 text-xs">Modo</div>
        </div>
      </div>

      {/* Detalhes por segmento */}
      {safeSegmentDistances.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Distâncias por Segmento:</p>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
            {safeSegmentDistances.map((segment, index) => (
              <div key={index} className="flex justify-between items-center py-1 px-2 bg-slate-700/20 rounded">
                <span className="text-gray-300">Segmento {segment.from}-{segment.to}</span>
                <span className="text-cyan-400 font-mono">
                  {safeToFixed(segment.distance, 1)} m
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-600/30">
            <span className="text-gray-300 text-xs">Soma dos segmentos:</span>
            <span className="text-green-400 font-mono text-xs">
              {safeToFixed(segmentStats.total, 2)} m
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumoProjeto;