import React, { useState } from 'react';
import { Menu, X, FolderOpen, Users, LogOut, Map, Activity } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const GlowMenu = ({
  user,
  onLogout,
  onOpenProjects,
  onOpenJoin,
  isOnline,
  tracking
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleMenu = async () => {
    await Haptics.impact({ style: ImpactStyle.Medium });
    setIsOpen(!isOpen);
  };
  
  const handleAction = async (action) => {
    await Haptics.impact({ style: ImpactStyle.Light });
    setIsOpen(false);
    action();
  };
  
  return (
    <>
      {/* Botão Flutuante Principal */}
      <button
        onClick={toggleMenu}
        className={`fixed top-4 left-4 z-50 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-2xl ${
          isOpen 
            ? 'bg-red-500/20 border-red-500/50 text-red-400 rotate-90' 
            : 'bg-slate-900/80 border-cyan-500/30 text-cyan-400 backdrop-blur-xl'
        } border hover:shadow-cyan-500/20`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Menu Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      >
        <div 
          className={`absolute top-20 left-4 w-64 transition-all duration-300 transform ${
            isOpen ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-900 border border-cyan-500/20 rounded-2xl p-2 shadow-[0_0_30px_rgba(8,145,178,0.15)] overflow-hidden">
            
            {/* Header do User */}
            <div className="p-3 mb-2 border-b border-white/5">
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-1">
              <MenuItem 
                icon={FolderOpen} 
                label="Meus Projetos" 
                onClick={() => handleAction(onOpenProjects)}
                disabled={tracking}
              />
              <MenuItem 
                icon={Users} 
                label="Entrar / Compartilhar" 
                onClick={() => handleAction(onOpenJoin)}
                highlight
                disabled={tracking}
              />
              <MenuItem 
                icon={Map} 
                label="Configurar Mapa" 
                onClick={() => alert('Em breve')} // Placeholder para settings
              />
            </div>

            {/* Footer */}
            <div className="mt-2 pt-2 border-t border-white/5">
              <button
                onClick={() => handleAction(onLogout)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-bold text-sm">Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, highlight, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
      disabled 
        ? 'opacity-50 cursor-not-allowed' 
        : highlight
          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/20'
          : 'text-slate-200 hover:bg-white/5'
    }`}
  >
    <Icon className={`w-5 h-5 ${highlight ? 'text-cyan-400' : 'text-slate-400'}`} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

export default GlowMenu;