import React from 'react';
import { GripHorizontal, X } from 'lucide-react';

// Cores definidas para cada quantidade de vãos
export const SPAN_COLORS = {
  1: '#1e3a8a', // Azul Escuro (Padrão)
  2: '#059669', // Verde Esmeralda
  3: '#d97706', // Âmbar/Laranja
  4: '#7c3aed', // Roxo
};

const SpanSelector = ({ currentSpans = 1, onSelect, onClose, style }) => {
  return (
    <div 
      className="absolute z-[10000] animate-in fade-in zoom-in duration-200"
      style={style}
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-3 w-[160px]">
        
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
            <GripHorizontal size={12} /> Vãos de Fio
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={(e) => {
                e.stopPropagation(); // Impede clique no mapa
                onSelect(count);
              }}
              className={`
                relative h-9 rounded-lg flex items-center justify-center gap-1 transition-all border
                ${currentSpans === count 
                  ? 'border-white/40 shadow-[0_0_10px_currentColor]' 
                  : 'border-transparent hover:bg-white/5'}
              `}
              style={{ 
                backgroundColor: `${SPAN_COLORS[count]}20`,
                color: SPAN_COLORS[count],
                borderColor: currentSpans === count ? SPAN_COLORS[count] : 'transparent'
              }}
            >
              <span className="font-bold text-sm">{count}x</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Seta do Balão */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 
        border-l-[8px] border-l-transparent
        border-r-[8px] border-r-transparent
        border-t-[8px] border-t-slate-900/95">
      </div>
    </div>
  );
};

export default SpanSelector;