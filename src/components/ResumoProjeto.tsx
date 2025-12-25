import React, { useEffect, useState, useRef } from 'react';
import { Ruler, MapPin, Navigation, BarChart3, Loader2 } from 'lucide-react';
import BairroDetectionService from './BairroDetectionService';

interface ResumoProjetoProps {
  manualPoints: any[];
  totalDistance: number;
  selectedBairro: string;
  trackingMode: string;
  onBairroDetected?: (bairro: string) => void;
}

const safeToFixed = (value: number | null | undefined, decimals = 2): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "0".padStart(decimals + 2, '0');
  }
  return Number(value).toFixed(decimals);
};

const ResumoProjeto: React.FC<ResumoProjetoProps> = ({
  manualPoints,
  totalDistance,
  selectedBairro,
  trackingMode,
  onBairroDetected
}) => {
  const [bairroDisplay, setBairroDisplay] = useState(selectedBairro || 'Vários');
  const [isDetecting, setIsDetecting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const safeManualPoints = manualPoints || [];
  const safeTotalDistance = totalDistance || 0;
  const safeTrackingMode = trackingMode || 'manual';
  
  // Lógica de Detecção Automática
  useEffect(() => {
    const detect = async () => {
      // Se já temos pontos e o bairro atual é genérico ('todos', 'Vários' ou vazio)
      if (safeManualPoints.length > 0) {
        setIsDetecting(true);
        try {
          // Pequeno delay para UX (para ver o loading) e não travar renderização imediata
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const detected = await BairroDetectionService.detectBairroForProject(safeManualPoints);
          
          if (detected && detected !== 'Vários') {
            setBairroDisplay(detected);
            if (onBairroDetected) onBairroDetected(detected);
          } else if (selectedBairro && selectedBairro !== 'todos') {
            setBairroDisplay(selectedBairro);
          }
        } catch (error) {
          console.error('Erro na detecção automática:', error);
          if (selectedBairro && selectedBairro !== 'todos') {
            setBairroDisplay(selectedBairro);
          }
        } finally {
          setIsDetecting(false);
        }
      }
    };
    
    detect();
  }, [safeManualPoints, selectedBairro]);
  
  // Lógica do Efeito Glow (Mouse Move)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };
  
  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="group relative rounded-xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-cyan-500/20"
      style={{
        // @ts-ignore - CSS Custom Properties in style
        '--mouse-x': '50%',
        '--mouse-y': '50%',
      }}
    >
      {/* Camada de Glow do Background */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.1), transparent 40%)`,
        }}
      />

      {/* Camada de Glow da Borda */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.4), transparent 40%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          WebkitMaskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px'
        }}
      />

      {/* Conteúdo */}
      <div className="relative p-4 bg-slate-900/60 backdrop-blur-xl h-full rounded-xl">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-slate-200 tracking-wide">
            Resumo do Projeto
          </span>
        </div>
        
        {/* Grid de Métricas */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pontos */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors group/item">
            <div className="mb-1 text-cyan-400 p-1.5 rounded-full bg-cyan-950/30 group-hover/item:scale-110 transition-transform">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              {safeManualPoints.length}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pontos</span>
          </div>

          {/* Distância */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors group/item">
            <div className="mb-1 text-emerald-400 p-1.5 rounded-full bg-emerald-950/30 group-hover/item:scale-110 transition-transform">
              <Ruler className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              {safeTotalDistance < 1000 
                ? `${Math.round(safeTotalDistance)}m` 
                : `${safeToFixed(safeTotalDistance / 1000, 2)}km`
              }
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Distância</span>
          </div>

          {/* Bairro (Com Detecção) */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors group/item relative overflow-hidden">
            {isDetecting && (
              <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 backdrop-blur-[1px]">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            )}
            <div className="mb-1 text-purple-400 p-1.5 rounded-full bg-purple-950/30 group-hover/item:scale-110 transition-transform">
              <Navigation className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white text-center line-clamp-1 px-1">
              {bairroDisplay === 'todos' ? 'Vários' : bairroDisplay}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
              {isDetecting ? 'Detectando...' : 'Bairro'}
            </span>
          </div>

          {/* Modo */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors group/item">
            <div className="mb-1 text-blue-400 p-1.5 rounded-full bg-blue-950/30 group-hover/item:scale-110 transition-transform">
              <Navigation className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white uppercase">
              {safeTrackingMode === 'manual' ? 'Manual' : 'Auto'}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Modo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumoProjeto;
