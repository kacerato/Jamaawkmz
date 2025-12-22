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
  
  // LÓGICA DE POSICIONAMENTO SIMPLIFICADA E ROBUSTA
  // Usando translate-x para garantir centralização relativa ao meio da tela

  // RASTREAMENTO ATIVO: Topo Direita
  const trackingContainerClass = 'top-[90px] right-4 flex-col gap-3 items-end';

  // DEFAULT: Rodapé, ao lado do Dock
  // Dock ~280px wide. Centro = 50%.
  // Layer (Esq): right-1/2 translate-x-[-160px] -> Move para esquerda do centro
  // Center (Dir): left-1/2 translate-x-[160px] -> Move para direita do centro

  const centerBtnClass = isTrackingActive
    ? 'fixed top-[90px] right-4 z-50'
    : 'fixed bottom-10 left-1/2 ml-[140px] z-50 transform transition-all duration-300';

  const layerBtnClass = isTrackingActive
    ? 'fixed top-[146px] right-4 z-50'
    : 'fixed bottom-10 left-1/2 -ml-[190px] z-50 transform transition-all duration-300';

  return (
    <>
      {/* Botão de Centralizar (Direita) */}
      <div className={centerBtnClass}>
        <Button
          size="icon"
          onClick={onCenterMap}
          className="w-12 h-12 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-2xl hover:scale-105 hover:border-cyan-400/50 hover:shadow-cyan-500/20 transition-all group"
        >
          <LocateFixed className="w-6 h-6 text-white group-hover:text-cyan-400 transition-colors" />
        </Button>
      </div>

      {/* Botão de Camadas (Esquerda) */}
      <div className={`${layerBtnClass} flex flex-col items-end`}>
        
        {/* Menu Dropdown */}
        <div className={`
          absolute flex flex-col gap-2 transition-all duration-300
          ${isTrackingActive ? 'right-14 top-0 origin-top-right' : 'bottom-14 left-0 origin-bottom-left'}
          ${showStyleMenu ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}
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
