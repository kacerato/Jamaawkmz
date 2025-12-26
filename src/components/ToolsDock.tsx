import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, MousePointerClick, Camera, Plus } from 'lucide-react';

interface ToolsDockProps {
  active: boolean;
  onStartGPS: () => void;
  onStartTouch: () => void;
  onStartAR: () => void;
  onNewProject: () => void;
}

const ToolsDock: React.FC<ToolsDockProps> = ({ active, onStartGPS, onStartTouch, onStartAR, onNewProject }) => {
  if (active) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 animate-slide-in-bottom">

      {/* Botão Novo Projeto */}
      <Button
        onClick={onNewProject}
        className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-105 transition-all duration-300 border-0 flex flex-col items-center justify-center gap-0.5 p-0"
      >
        <Plus className="w-6 h-6" />
        <span className="text-[9px] font-bold uppercase tracking-tighter">Novo</span>
      </Button>

      {/* Dock Flutuante */}
      <div className="flex items-center gap-1 p-1.5 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">

        <Button
          variant="ghost"
          onClick={onStartGPS}
          className="flex flex-col items-center justify-center w-16 h-14 gap-1 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-xl transition-all"
        >
          <Play className="w-5 h-5 fill-current" />
          <span className="text-[9px] font-semibold uppercase">GPS</span>
        </Button>

        <div className="w-px h-8 bg-white/10 mx-0.5"></div>

        <Button
          variant="ghost"
          onClick={onStartTouch}
          className="flex flex-col items-center justify-center w-16 h-14 gap-1 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
        >
          <MousePointerClick className="w-5 h-5" />
          <span className="text-[9px] font-semibold uppercase">Toque</span>
        </Button>

        <div className="w-px h-8 bg-white/10 mx-0.5"></div>

        <Button
          variant="ghost"
          onClick={onStartAR}
          className="flex flex-col items-center justify-center w-16 h-14 gap-1 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-xl transition-all"
        >
          <Camera className="w-5 h-5" />
          <span className="text-[9px] font-semibold uppercase">AR</span>
        </Button>

      </div>
    </div>
  );
};

export default ToolsDock;
