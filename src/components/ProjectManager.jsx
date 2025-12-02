// components/ProjectManager.jsx
import React, { useState } from 'react';
import { 
  FolderOpen, Share2, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [loadingJoin, setLoadingJoin] = useState(false);

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none m-0 p-0 rounded-none bg-slate-950 border-none text-white flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        
        {/* HEADER ESTILO APP ANDROID */}
        <div className="flex-none p-4 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 flex flex-col gap-4 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h2 className="text-lg font-bold tracking-wide flex-1">Meus Projetos</h2>
            <div className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2 py-1 rounded">
              {projects.length} Total
            </div>
          </div>

          {/* Barra de Busca e Tabs Compactas */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
            {activeTab === 'shared' && (
               <Button size="icon" className="rounded-full bg-purple-600" onClick={() => {
                 if(joinId) onJoinProject(joinId);
               }}>
                 <Plus className="w-5 h-5" />
               </Button>
            )}
          </div>

          <div className="flex p-1 bg-slate-800/50 rounded-lg">
            <button
              onClick={() => setActiveTab('mine')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                activeTab === 'mine' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400'
              }`}
            >
              Meus
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                activeTab === 'shared' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400'
              }`}
            >
              Compartilhados
            </button>
          </div>
        </div>

        {/* INPUT IMPORTAR (Aparece condicionalmente) */}
        {activeTab === 'shared' && (
           <div className="px-4 pt-2 pb-0">
             <input
               value={joinId}
               onChange={(e) => setJoinId(e.target.value)}
               placeholder="Colar ID do projeto compartilhado..."
               className="w-full bg-slate-900 border border-purple-500/30 rounded-lg px-3 py-3 text-sm font-mono text-white focus:border-purple-500 transition-colors"
             />
           </div>
        )}

        {/* LISTA DE PROJETOS (Scrollável) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {displayedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
              <FolderOpen className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">Nenhum projeto encontrado</p>
            </div>
          ) : (
            displayedProjects.map(project => (
              <div 
                key={project.id} 
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 active:scale-[0.98] transition-transform duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-3 items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                      project.user_id === currentUserId 
                        ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-400' 
                        : 'bg-purple-950/30 border-purple-500/30 text-purple-400'
                    }`}>
                      {project.user_id === currentUserId ? <FolderOpen size={18} /> : <Users size={18} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white leading-tight">{project.name}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(project.updated_at).toLocaleDateString()} • {(project.total_distance/1000).toFixed(2)}km
                      </p>
                    </div>
                  </div>
                  
                  {/* Botão Copiar ID */}
                  <button 
                    onClick={(e) => handleCopyId(e, project.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 active:bg-cyan-500 active:text-white transition-colors"
                  >
                    {copiedId === project.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Button 
                    onClick={() => onLoadProject(project)}
                    className="flex-1 h-9 text-xs bg-slate-800 hover:bg-cyan-500 hover:text-white border border-slate-700 transition-colors"
                  >
                    <Play size={14} className="mr-2" /> Carregar
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-slate-400 hover:text-green-400 hover:bg-green-950/30 rounded-lg border border-slate-800"
                    onClick={() => onExportProject(project)}
                  >
                    <Download size={16} />
                  </Button>

                  {project.user_id === currentUserId && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg border border-slate-800"
                      onClick={() => onDeleteProject(project.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectManager;