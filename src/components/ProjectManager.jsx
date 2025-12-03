import React, { useState } from 'react';
import { 
  FolderOpen, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, MapPin 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';

const ProjectManager = ({ 
  isOpen, 
  onClose, 
  projects, 
  currentUserId,
  onLoadProject, 
  onDeleteProject, 
  onExportProject,
  onJoinProject 
}) => {
  const [activeTab, setActiveTab] = useState('mine');
  const [joinId, setJoinId] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const myProjects = projects.filter(p => p.user_id === currentUserId);
  const sharedProjects = projects.filter(p => p.user_id !== currentUserId);
  
  const displayedProjects = (activeTab === 'mine' ? myProjects : sharedProjects)
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleCopyId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const ProjectCard = ({ project }) => {
    const isMine = project.user_id === currentUserId;
    const accentColor = isMine ? 'text-cyan-400' : 'text-purple-400';
    const glowColor = isMine ? 'bg-cyan-500' : 'bg-purple-500';

    return (
      <div className="group relative liquid-glass rounded-2xl p-4 mb-3 transition-all duration-300 active:scale-[0.98] overflow-hidden">
        {/* Shine Effect Suave */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="flex justify-between items-start relative z-10">
          <div className="flex gap-4 items-center">
            {/* Ícone Glow */}
            <div className="w-12 h-12 flex-shrink-0 icon-glow-container">
              <div className={`icon-glow-bg ${glowColor}`}></div>
              <div className={`relative z-10 bg-slate-950/60 p-2.5 rounded-xl border border-white/10 ${accentColor} shadow-sm backdrop-blur-md`}>
                {isMine ? <FolderOpen size={20} /> : <Users size={20} />}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white leading-tight truncate pr-2">
                {project.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-medium text-slate-400 bg-slate-900/40 px-2 py-0.5 rounded-full border border-white/5">
                  {(project.total_distance/1000).toFixed(2)}km
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={(e) => handleCopyId(e, project.id)}
            className="p-2 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors active:bg-cyan-500/20"
          >
            {copiedId === project.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-wide border-0 shadow-lg transition-transform active:scale-95 ${
              isMine 
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
            }`}
          >
            <Play size={12} className="mr-2 fill-current" /> Carregar
          </Button>
          
          <div className="flex gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => onExportProject(project)}
              className="h-10 w-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20"
            >
              <Download size={18} />
            </Button>
            
            {isMine && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onDeleteProject(project.id)}
                className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20"
              >
                <Trash2 size={18} />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      // Em ProjectManager.jsx

<DialogContent 
  className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw] max-w-md h-[80vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden data-[state=open]:animate-in ..." 

      
        className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw] max-w-md h-[80vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden"
      >
        <div className="flex flex-col h-full liquid-glass rounded-[32px] overflow-hidden relative shadow-2xl">
          
          {/* Header */}
          <div className="flex-none p-5 pb-2 bg-gradient-to-b from-white/5 to-transparent">
            <DialogHeader className="flex flex-row items-center justify-between mb-4 space-y-0 text-left">
              <div>
                <DialogTitle className="text-xl font-bold text-white tracking-tight">
                  Projetos
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-1">
                  Gerencie seus rastreios
                </DialogDescription>
              </div>
              
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={onClose}
                className="rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 active:scale-90 transition-transform -mr-2"
              >
                <X size={20} />
              </Button>
            </DialogHeader>

            {/* Tabs */}
            <div className="bg-slate-950/40 p-1 rounded-full flex relative mb-4 border border-white/5">
              <button
                onClick={() => setActiveTab('mine')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all duration-300 ${
                  activeTab === 'mine' 
                    ? 'bg-slate-800 text-cyan-400 shadow-lg' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                MEUS
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all duration-300 ${
                  activeTab === 'shared' 
                    ? 'bg-slate-800 text-purple-400 shadow-lg' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                COMPARTILHADOS
              </button>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar projeto..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/30 border border-white/5 rounded-2xl pl-10 pr-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950/50 focus:border-cyan-500/30 transition-all"
              />
            </div>
          </div>

          {/* Importar */}
          {activeTab === 'shared' && (
            <div className="px-5 pb-2 animate-in slide-in-from-top-2">
              <div className="flex gap-2">
                <input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="ID do projeto..."
                  className="flex-1 bg-purple-900/10 border border-purple-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-purple-400/30 focus:border-purple-500/50 outline-none"
                />
                <Button 
                  size="icon"
                  onClick={() => { if(joinId) onJoinProject(joinId); }}
                  className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white w-12 h-11 shadow-lg shadow-purple-900/20 active:scale-95"
                >
                  <Plus size={22} />
                </Button>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar space-y-1 pb-20">
            {displayedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <FolderOpen size={32} className="opacity-20 mb-2" />
                <p className="text-sm font-medium opacity-50">Nenhum projeto</p>
              </div>
            ) : (
              displayedProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))
            )}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectManager;