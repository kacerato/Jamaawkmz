import React, { useState } from 'react';
import { 
  Navigation, MousePointerClick, Camera, Plus, 
  LayoutGrid, X // Ícone LayoutGrid é mais neutro e funcional
} from 'lucide-react';

const ToolsDock = ({ 
  onStartGPS, 
  onStartTouch, 
  onStartAR, 
  onNewProject,
  active 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Feedback Tátil (Vibração)
  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const toggleOpen = () => {
    vibrate();
    setIsOpen(!isOpen);
  };

  const handleAction = (action) => {
    vibrate();
    setIsOpen(false);
    action();
  };

  // Botão de cada ferramenta
  const DockItem = ({ icon: Icon, label, color, onClick, delay }) => (
    <button
      onClick={(e) => {
        e.stopPropagation(); // Impede fechar ao clicar
        handleAction(onClick);
      }}
      // Z-Index alto para garantir o clique
      className={`relative z-[60] group flex flex-col items-center justify-center gap-1 transition-all duration-300 ease-out ${
        isOpen 
          ? `translate-y-0 opacity-100 scale-100` 
          : `translate-y-12 opacity-0 scale-50 pointer-events-none`
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-900 border border-white/20 shadow-xl overflow-hidden active:scale-90 transition-transform">
        {/* Fundo Colorido Suave */}
        <div className={`absolute inset-0 opacity-20 ${color}`}></div>
        
        {/* Ícone */}
        <Icon className={`w-6 h-6 z-10 ${color.replace('bg-', 'text-')}`} />
      </div>
      
      {/* Label com fundo para garantir leitura */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-slate-900/90 px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
        {label}
      </span>
    </button>
  );

  if (active) return null;

  return (
    <>
      {/* OVERLAY (FUNDO ESCURO/BORRADO)
         Separado do container principal para não bloquear cliques nos botões
         z-index: 40 (Abaixo do menu, acima do mapa)
      */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[40] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* CONTAINER DO MENU */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center gap-5">
        
        {/* BOTÕES DAS FERRAMENTAS (Aparecem acima do botão principal) */}
        <div className="flex items-end gap-4 mb-2">
          <DockItem 
            icon={Navigation} 
            label="GPS" 
            color="bg-green-500" 
            onClick={onStartGPS} 
            delay={0}
          />
          <DockItem 
            icon={MousePointerClick} 
            label="Manual" 
            color="bg-blue-500" 
            onClick={onStartTouch} 
            delay={50}
          />
          <DockItem 
            icon={Camera} 
            label="AR" 
            color="bg-purple-500" 
            onClick={onStartAR} 
            delay={100}
          />
          <DockItem 
            icon={Plus} 
            label="Novo" 
            color="bg-cyan-500" 
            onClick={onNewProject} 
            delay={150}
          />
        </div>

        {/* BOTÃO PRINCIPAL (TRIGGER) */}
        <button
          onClick={toggleOpen}
          className={`relative z-[60] w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-300 active:scale-95 border border-white/10 ${
            isOpen ? 'bg-red-500 rotate-90' : 'bg-slate-900'
          }`}
        >
          {isOpen ? (
            <X className="w-7 h-7 text-white" />
          ) : (
            // Ícone Grid (Menu de Apps) - Mais intuitivo
            <LayoutGrid className="w-7 h-7 text-cyan-400" />
          )}
        </button>

        {/* LABEL DO BOTÃO PRINCIPAL (Com fundo para visibilidade) */}
        <div className={`transition-all duration-300 ${isOpen ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <span className="text-[10px] font-bold text-cyan-100 bg-slate-900/80 px-3 py-1 rounded-full border border-white/10 shadow-lg backdrop-blur-md">
            FERRAMENTAS
          </span>
        </div>

      </div>
    </>
  );
};

export default ToolsDock;