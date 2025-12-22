import React, { useState } from 'react';
import { LocateFixed, Map as MapIcon, Moon, Sun, Globe, Check, Layers } from 'lucide-react';
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
      {/* Botão de Centralizar (Sobe quando rastreia) */}
      <div 
        className={`absolute right-4 z-20 transition-all duration-500 ease-in-out ${
          isTrackingActive ? 'bottom-48' : 'bottom-32'
        }`}
      >
        <Button
          size="icon"
          onClick={onCenterMap}
          className="w-12 h-12 rounded-full bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:scale-110 hover:border-cyan-400/50 hover:shadow-cyan-500/20 transition-all group"
        >
          <LocateFixed className="w-6 h-6 text-white group-hover:text-cyan-400 transition-colors" />
        </Button>
      </div>

      {/* Seletor de Estilo */}
      <div className="absolute top-24 right-4 z-20 flex flex-col items-end gap-2">
        
        {/* Menu Dropdown */}
        <div className={`
          flex flex-col gap-2 transition-all duration-300 origin-top-right
          ${showStyleMenu ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-4 pointer-events-none'}
        `}>
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => { onChangeStyle(style.id); setShowStyleMenu(false); }}
              className={`
                group flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-xl transition-all w-48 text-left
                ${currentMapStyle === style.id 
                  ? 'bg-slate-800/95 border-cyan-500/50 ring-1 ring-cyan-500/30' 
                  : 'bg-slate-900/80 border-white/10 hover:bg-slate-800'}
              `}
            >
              <div className={`p-2 rounded-lg bg-slate-950/50 border border-white/5 ${style.color}`}>
                <style.icon size={18} />
              </div>
              <div className="flex-1">
                <span className={`block text-xs font-bold uppercase tracking-wider ${currentMapStyle === style.id ? 'text-white' : 'text-slate-300'}`}>
                  {style.name}
                </span>
              </div>
              {currentMapStyle === style.id && <Check size={14} className="text-cyan-400" />}
            </button>
          ))}
        </div>

        {/* Botão Gatilho (Ícone Alterado para MapIcon) */}
        <Button
          size="icon"
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className={`
            w-12 h-12 rounded-2xl shadow-2xl border transition-all duration-300
            ${showStyleMenu 
              ? 'bg-cyan-600 border-cyan-400 text-white shadow-cyan-500/30' 
              : 'bg-slate-900/90 backdrop-blur-xl border-white/20 text-cyan-400 hover:scale-105'}
          `}
        >
          {/* MUDANÇA: Ícone Map em vez de Layers */}
          <MapIcon className="w-6 h-6" /> 
        </Button>
      </div>
    </>
  );
};

export default MapControls;