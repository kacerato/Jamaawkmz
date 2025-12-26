import React from 'react';
import { Button } from '@/components/ui/button';
import { LocateFixed, Map as MapIcon } from 'lucide-react';

interface MapControlsProps {
  onCenterMap: () => void;
  currentMapStyle: string;
  onChangeStyle: (style: string) => void;
  isTrackingActive: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  onCenterMap,
  currentMapStyle,
  onChangeStyle,
  isTrackingActive
}) => {
  return (
    <div className={`absolute top-20 right-4 flex flex-col gap-2 z-10 transition-opacity duration-300 ${isTrackingActive ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

      {/* Botão de Centralizar */}
      <Button
        size="icon"
        onClick={onCenterMap}
        className="bg-slate-900/90 border border-slate-700 text-cyan-400 hover:bg-slate-800 hover:text-cyan-300 rounded-xl shadow-lg h-10 w-10"
      >
        <LocateFixed className="w-5 h-5" />
      </Button>

      {/* Menu de Estilos (Simplificado para Toggle por enquanto ou Dropdown futuro) */}
      <div className="group relative">
        <Button
          size="icon"
          className="bg-slate-900/90 border border-slate-700 text-white hover:bg-slate-800 rounded-xl shadow-lg h-10 w-10"
        >
          <MapIcon className="w-5 h-5" />
        </Button>

        {/* Dropdown on Hover */}
        <div className="absolute right-full top-0 mr-2 w-32 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-xl p-1 hidden group-hover:block transition-all">
           <button
             onClick={() => onChangeStyle('streets')}
             className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg mb-1 ${currentMapStyle === 'streets' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'}`}
           >
             Ruas
           </button>
           <button
             onClick={() => onChangeStyle('satellite')}
             className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg mb-1 ${currentMapStyle === 'satellite' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'}`}
           >
             Satélite
           </button>
           <button
             onClick={() => onChangeStyle('dark')}
             className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg ${currentMapStyle === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'}`}
           >
             Escuro
           </button>
        </div>
      </div>

    </div>
  );
};

export default MapControls;
