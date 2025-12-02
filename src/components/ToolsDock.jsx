import React, { useState } from 'react';
import { 
  Navigation, MousePointerClick, Camera, Plus, X, 
  Cpu, Zap, Scan
} from 'lucide-react';

const ToolsDock = ({ 
  onStartGPS, 
  onStartTouch, 
  onStartAR, 
  onNewProject,
  active 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Feedback Tátil
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

  // Botão de Ação Individual
  const DockItem = ({ icon: Icon, label, color, onClick, delay }) => (
    <button
      onClick={() => handleAction(onClick)}
      className={`group flex flex-col items-center justify-center gap-1 transition-all duration-300 ease-out ${
        isOpen 
          ? `translate-y-0 opacity-100 scale-100` 
          : `translate-y-10 opacity-0 scale-50 pointer-events-none`
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-900/80 border border-white/10 shadow-lg backdrop-blur-md overflow-hidden group-active:scale-90 transition-transform`}>
        {/* Glow de Fundo */}
        <div className={`absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity ${color}`}></div>
        
        {/* Ícone */}
        <Icon className={`w-6 h-6 z-10 ${color.replace('bg-', 'text-')}`} />
        
        {/* Brilho da Borda */}
        <div className={`absolute inset-0 border-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl ${color.replace('bg-', 'border-')}`}></div>
      </div>
      
      {/* Label com fundo escuro para leitura */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/5">
        {label}
      </span>
    </button>
  );

  if (active) return null; // Esconde se já estiver rastreando

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center gap-4">
      
      {/* ÁREA DE ÍCONES EXPANDIDA */}
      <div className={`flex items-end gap-3 mb-2 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
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
        className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)] transition-all duration-300 active:scale-95 ${
          isOpen ? 'bg-red-500/90 rotate-45' : 'bg-slate-950/90'
        }`}
      >
        {/* Efeito Glass no Botão Principal */}
        <div className="absolute inset-0 rounded-full border border-white/10 backdrop-blur-xl"></div>
        
        {/* Animação de Pulso (Só quando fechado) */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping-slow"></span>
        )}

        {/* Ícone Central */}
        {isOpen ? (
          <Plus className="w-8 h-8 text-white relative z-10" />
        ) : (
          <Cpu className="w-7 h-7 text-cyan-400 relative z-10 animate-pulse-slow" />
        )}

        {/* Texto "FERRAMENTAS" Curvado ou Label (Opcional, preferi limpo) */}
      </button>

      {/* Label do Botão Principal */}
      <span className={`text-[10px] font-bold text-cyan-400/80 tracking-[0.2em] transition-opacity duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`}>
        FERRAMENTAS
      </span>

      {/* Overlay Escuro para focar no menu (Cobre o mapa) */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[-1] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
};

export default ToolsDock;