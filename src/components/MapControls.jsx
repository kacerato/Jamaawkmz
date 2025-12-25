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
  
  return (
    <>
      {/* ================================================================
        1. BOTÃO DE CENTRALIZAR (LOCATE)
        - Idle: Lado DIREITO do Dock inferior
        - Tracking: Topo Direito (abaixo do botão de camadas)
        ================================================================
      */}
      <div 
        className={`absolute z-20 transition-all duration-500 ease-in-out ${
          isTrackingActive 
            ? 'top-[70px] sm:top-[80px] right-4 translate-x-0' // Modo Rastreamento (Topo)
            : 'bottom-8 left-[calc(50%+75px)] sm:left-[calc(50%+90px)] -translate-x-1/2' // Modo Idle (Ao lado do Dock)
        }`}
      >
        <Button
          size="icon"
          onClick={onCenterMap}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl sm:rounded-full bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:scale-110 hover:border-cyan-400/50 hover:shadow-cyan-500/20 transition-all group"
        >
          <LocateFixed className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-cyan-400 transition-colors" />
        </Button>
      </div>

      {/* ================================================================
        2. BOTÃO DE CAMADAS (LAYERS) + MENU
        - Idle: Lado ESQUERDO do Dock inferior
        - Tracking: Topo Direito
        ================================================================
      */}
      <div 
        className={`absolute z-20 transition-all duration-500 ease-in-out flex flex-col items-end ${
          isTrackingActive 
            ? 'top-4 right-4 translate-x-0' // Modo Rastreamento (Topo)
            : 'bottom-8 left-[calc(50%-75px)] sm:left-[calc(50%-90px)] -translate-x-1/2' // Modo Idle (Ao lado do Dock)
        }`}
      >
        
        {/* MENU DROPDOWN DE ESTILOS */}
        <div className={`
          absolute flex flex-col gap-2 transition-all duration-300 origin-right w-max
          ${isTrackingActive ? 'top-full mt-3' : 'bottom-full mb-3'} /* Direção de abertura */
          ${showStyleMenu 
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 scale-90 pointer-events-none ' + (isTrackingActive ? '-translate-y-4' : 'translate-y-4')
          }
        `}>
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => { onChangeStyle(style.id); setShowStyleMenu(false); }}
              className={`
                group flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl backdrop-blur-xl border shadow-xl transition-all text-left
                ${currentMapStyle === style.id 
                  ? 'bg-slate-800/95 border-cyan-500/50 ring-1 ring-cyan-500/30' 
                  : 'bg-slate-900/90 border-white/10 hover:bg-slate-800'}
              `}
            >
              <div className={`p-1.5 sm:p-2 rounded-lg bg-slate-950/50 border border-white/5 ${style.color}`}>
                <style.icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="flex-1 min-w-[80px] sm:min-w-[100px]">
                <span className={`block text-[10px] sm:text-xs font-bold uppercase tracking-wider ${currentMapStyle === style.id ? 'text-white' : 'text-slate-300'}`}>
                  {style.name}
                </span>
              </div>
              {currentMapStyle === style.id && <Check size={14} className="text-cyan-400" />}
            </button>
          ))}
        </div>

        {/* BOTÃO GATILHO (MAP ICON) */}
        <Button
          size="icon"
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-2xl shadow-2xl border transition-all duration-300
            ${showStyleMenu 
              ? 'bg-cyan-600 border-cyan-400 text-white shadow-cyan-500/30' 
              : 'bg-slate-900/90 backdrop-blur-xl border-white/20 text-cyan-400 hover:scale-105'}
          `}
        >
          <MapIcon className="w-5 h-5 sm:w-6 sm:h-6" /> 
        </Button>
      </div>
    </>
  );
};

export default MapControls;