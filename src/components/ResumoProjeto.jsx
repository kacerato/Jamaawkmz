import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ruler, MapPin, Navigation, Save } from 'lucide-react';

const ResumoProjeto = ({ manualPoints, totalDistance, selectedBairro, trackingMode }) => {
  return (
    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
      <p className="text-sm text-cyan-400 font-medium mb-2">Resumo do Projeto</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{manualPoints.length}</div>
          <div className="text-gray-400 text-xs">Pontos</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{(totalDistance / 1000).toFixed(2)} km</div>
          <div className="text-gray-400 text-xs">Distância</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{selectedBairro !== 'todos' ? selectedBairro : 'Vários'}</div>
          <div className="text-gray-400 text-xs">Bairro</div>
        </div>
        <div className="text-center p-2 bg-slate-700/30 rounded">
          <div className="text-cyan-400 font-bold">{trackingMode === 'manual' ? 'Manual' : 'Automático'}</div>
          <div className="text-gray-400 text-xs">Modo</div>
        </div>
      </div>
    </div>
  );
};

export default ResumoProjeto;