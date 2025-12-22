import React, { useState } from 'react';
import { LocateFixed, Map as MapIcon, Moon, Sun, Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MapControls = ({
  onCenterMap,
  currentMapStyle,
  onChangeStyle,
  isTrackingActive
}) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  
  const styles = [
    { id: 'satellite', name: 'Satélite', icon: Globe, color: 'text-green-400', desc: 'Foto aérea' },
    { id: 'streets', name: 'Ruas', icon: MapIcon, color: 'text-blue-400', desc: 'Vetor padrão' },
    { id: 'dark', name: 'Escuro', icon: Moon, color: 'text-purple-400', desc: 'Modo noturno' },
    { id: 'light', name: 'Claro', icon: Sun, color: 'text-yellow-400', desc: 'Alto contraste' },
  ];
  
  // Posições Calculadas
  const centerMapPosition = isTrackingActive
    ? 'top-[90px] right-4' // Tracking: Topo Direita (Abaixo do menu hambúrguer)
    : 'bottom-10 left-[calc(50%+40px)] sm:left-[calc(50%+50px)]'; // Default: Direita do Dock (Centro + Offset)

  const layerMapPosition = isTrackingActive
    ? 'top-[146px] right-4' // Tracking: Abaixo do botão de centralizar
    : 'bottom-10 right-[calc(50%+40px)] sm:right-[calc(50%+50px)]'; // Default: Esquerda do Dock

  return (
    <>
      {/* Botão de Centralizar (Direita do Dock / Topo Direita) */}
      <div className={`absolute z-20 transition-all duration-500 ease-in-out ${centerMapPosition}`}>
        <Button
          size="icon"
          onClick={onCenterMap}
          className="w-12 h-12 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-2xl hover:scale-105 hover:border-cyan-400/50 hover:shadow-cyan-500/20 transition-all group"
        >
          <LocateFixed className="w-6 h-6 text-white group-hover:text-cyan-400 transition-colors" />
        </Button>
      </div>

      {/* Botão de Camadas (Esquerda do Dock / Topo Direita) */}
      <div className={`absolute z-20 transition-all duration-500 ease-in-out flex flex-col items-end ${layerMapPosition}`}>
        
        {/* Menu Dropdown (Direção dinâmica) */}
        <div className={`
          absolute flex flex-col gap-2 transition-all duration-300 origin-bottom
          ${isTrackingActive ? 'right-14 top-0 origin-top-right' : 'bottom-14 left-0 origin-bottom-left'}
          ${showStyleMenu ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}
        `}>
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => { onChangeStyle(style.id); setShowStyleMenu(false); }}
              className={`
                group flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-xl transition-all w-40 text-left
                ${currentMapStyle === style.id 
                  ? 'bg-slate-800/95 border-cyan-500/50 ring-1 ring-cyan-500/30' 
                  : 'bg-slate-900/90 border-white/10 hover:bg-slate-800'}
              `}
            >
              <div className={`p-1.5 rounded-lg bg-slate-950/50 border border-white/5 ${style.color}`}>
                <style.icon size={16} />
              </div>
              <div className="flex-1">
                <span className={`block text-[10px] font-bold uppercase tracking-wider ${currentMapStyle === style.id ? 'text-white' : 'text-slate-300'}`}>
                  {style.name}
                </span>
              </div>
              {currentMapStyle === style.id && <Check size={14} className="text-cyan-400" />}
            </button>
          ))}
        </div>

        {/* Botão Gatilho */}
        <Button
          size="icon"
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className={`
            w-12 h-12 rounded-2xl shadow-2xl border transition-all duration-300
            ${showStyleMenu 
              ? 'bg-cyan-600 border-cyan-400 text-white shadow-cyan-500/30' 
              : 'bg-slate-900/90 backdrop-blur-xl border-white/20 text-purple-400 hover:scale-105'}
          `}
        >
          <MapIcon className="w-6 h-6" /> 
        </Button>
      </div>
    </>
  );
};

export default MapControls;
