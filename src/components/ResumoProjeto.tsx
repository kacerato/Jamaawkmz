import React from 'react';
import { Ruler, MapPin, Navigation } from 'lucide-react';
import { Point } from '../types/models';
import { formatDistanceDetailed } from '../utils/geoUtils';

interface ResumoProjetoProps {
  manualPoints: Point[];
  totalDistance: number;
  trackingMode: string;
  selectedBairro: string;
}

const ResumoProjeto: React.FC<ResumoProjetoProps> = ({
  manualPoints,
  totalDistance,
  trackingMode,
  selectedBairro
}) => {
  return (
    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-3">

      {/* Distância */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <Ruler className="w-4 h-4" />
          <span className="text-xs font-medium uppercase">Distância Total</span>
        </div>
        <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          {formatDistanceDetailed(totalDistance)}
        </span>
      </div>

      {/* Pontos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="w-4 h-4" />
          <span className="text-xs font-medium uppercase">Pontos Coletados</span>
        </div>
        <span className="text-sm font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
          {manualPoints.length}
        </span>
      </div>

      <div className="w-full h-px bg-slate-800"></div>

      {/* Info Extra */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-900 rounded-lg p-2 flex flex-col items-center justify-center border border-slate-800/50">
          <span className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Modo</span>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Navigation className="w-3 h-3" />
            <span className="text-xs font-bold">{trackingMode === 'gps' ? 'GPS' : 'Manual'}</span>
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg p-2 flex flex-col items-center justify-center border border-slate-800/50">
          <span className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Bairro</span>
          <span className="text-xs font-bold text-white truncate max-w-full px-1">
            {selectedBairro || 'N/A'}
          </span>
        </div>
      </div>

    </div>
  );
};

export default ResumoProjeto;
