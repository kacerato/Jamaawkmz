// ResumoProjeto.jsx - Substitua o conteúdo completo por este
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ruler, MapPin, Navigation, Save, BarChart3 } from 'lucide-react';

// Função safeToFixed para este componente
const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return "0".padStart(decimals + 2, '0');
  }
  return Number(value).toFixed(decimals);
};

const ResumoProjeto = ({ manualPoints, totalDistance, selectedBairro, trackingMode, segmentDistances }) => {
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeSelectedBairro = selectedBairro || 'todos';
  const safeTrackingMode = trackingMode || 'manual';
  const safeSegmentDistances = segmentDistances || [];

  return (
    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
      <p className="text-sm text-cyan-400 font-medium mb-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Resumo do Projeto
      </p>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{safeManualPoints.length}</div>
          <div className="text-gray-400 text-xs">Pontos</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">
            {safeTotalDistance < 1000
              ? `${Math.round(safeTotalDistance)}m`
              : `${safeToFixed(safeTotalDistance / 1000, 2)}km`
            }
          </div>
          <div className="text-gray-400 text-xs">Distância</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">
            {safeSelectedBairro !== 'todos' ? safeSelectedBairro : 'Vários'}
          </div>
          <div className="text-gray-400 text-xs">Bairro</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">
            {safeTrackingMode === 'manual' ? 'Manual' : 'Auto'}
          </div>
          <div className="text-gray-400 text-xs">Modo</div>
        </div>
      </div>
    </div>
  );
};

export default ResumoProjeto;