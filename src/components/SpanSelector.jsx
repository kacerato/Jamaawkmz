import React, { useEffect, useState } from 'react';
import { GripHorizontal, X, Check, ChevronsUp } from 'lucide-react';

// Cores vibrantes para diferenciar visualmente no mapa escuro
export const SPAN_COLORS = {
  1: '#3b82f6', // Azul Elétrico (1 Fio/Cabo)
  2: '#10b981', // Verde Neon (2 Fios)
  3: '#f59e0b', // Laranja Solar (3 Fios)
  4: '#8b5cf6', // Roxo Cyber (4+ Fios)
};

const SpanSelector = ({ currentSpans = 1, onSelect, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Animação de entrada suave
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);
  
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Espera a animação de saída
  };
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center pointer-events-none pb-8">
      {/* Overlay invisível para fechar ao clicar fora (opcional) */}
      <div className="absolute inset-0 pointer-events-auto" onClick={handleClose} />

      {/* O CARD FLUTUANTE */}
      <div 
        className={`
          pointer-events-auto relative mx-4
          bg-slate-950/90 backdrop-blur-xl border border-white/10
          shadow-[0_0_40px_-10px_rgba(0,0,0,0.7)]
          rounded-[24px] p-1.5 flex flex-col gap-3
          transition-all duration-300 ease-out transform
          w-full max-w-sm
          ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-95'}
        `}
      >
        {/* Cabeçalho Minimalista */}
        <div className="flex items-center justify-between px-4 pt-2">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="p-1.5 bg-slate-900 rounded-lg border border-white/5">
              <ChevronsUp size={14} className="text-cyan-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Densidade de Vão</span>
          </div>
          
          <button 
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Grid de Opções */}
        <div className="grid grid-cols-4 gap-2 p-1">
          {[1, 2, 3, 4].map((count) => {
            const isSelected = currentSpans === count;
            const color = SPAN_COLORS[count];
            
            return (
              <button
                key={count}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(count);
                  // Opcional: Fechar automaticamente após selecionar?
                  // handleClose(); 
                }}
                className={`
                  relative group flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all duration-300
                  border
                  ${isSelected 
                    ? 'bg-slate-800 border-white/20 translate-y-[-2px] shadow-lg' 
                    : 'bg-transparent border-transparent hover:bg-white/5'}
                `}
              >
                {/* Indicador Visual (Bolinha brilhante) */}
                <div 
                  className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-all duration-500
                    ${isSelected ? 'scale-110' : 'scale-75 opacity-50 group-hover:opacity-100'}
                  `}
                  style={{ backgroundColor: color, color: color }}
                />
                
                {/* Texto */}
                <span 
                  className={`text-sm font-bold font-mono transition-colors ${isSelected ? 'text-white' : 'text-slate-500'}`}
                >
                  {count}AG
                </span>

                {/* Efeito de Fundo Ativo (Glow) */}
                {isSelected && (
                  <div 
                    className="absolute inset-0 rounded-2xl opacity-10"
                    style={{ backgroundColor: color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpanSelector;