import React, { useState } from 'react';
import { 
  FolderOpen, Share2, Download, Trash2, Play, Users, 
  Copy, Plus, ArrowRight, Layers, Check, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '../lib/supabase';

const ProjectManager = ({ 
  isOpen, 
  onClose, 
  projects, 
  currentUserId,
  onLoadProject, 
  onDeleteProject, 
  onExportProject,
  onJoinProject // Função que vamos criar no App.jsx
}) => {
  const [activeTab, setActiveTab] = useState('mine'); // 'mine' | 'shared'
  const [joinId, setJoinId] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingJoin, setLoadingJoin] = useState(false);

  // Filtragem
  const myProjects = projects.filter(p => p.user_id === currentUserId);
  const sharedProjects = projects.filter(p => p.user_id !== currentUserId);
  
  const displayedProjects = (activeTab === 'mine' ? myProjects : sharedProjects)
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleJoin = async () => {
    if (!joinId.trim()) return;
    setLoadingJoin(true);
    await onJoinProject(joinId.trim());
    setLoadingJoin(false);
    setJoinId('');
  };

  const ProjectCard = ({ project }) => (
    <div className="group relative bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:-translate-y-1">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            project.user_id === currentUserId 
              ? 'bg-cyan-500/10 text-cyan-400' 
              : 'bg-purple-500/10 text-purple-400'
          }`}>
            {project.user_id === currentUserId ? <FolderOpen size={20} /> : <Users size={20} />}
          </div>
          <div>
            <h3 className="text-white font-bold text-sm truncate max-w-[150px]">{project.name}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              {project.points?.length || 0} pontos • {(project.total_distance/1000).toFixed(2)}km
            </p>
          </div>
        </div>
        
        {/* Botão de Cópia Rápida de ID */}
        <button 
          onClick={() => handleCopyId(project.id)}
          className="text-xs flex items-center gap-1 text-slate-500 hover:text-cyan-400 transition-colors bg-slate-900/50 px-2 py-1 rounded-md border border-slate-800"
        >
          {copiedId === project.id ? <Check size={12} /> : <Copy size={12} />}
          <span className="font-mono">ID</span>
        </button>
      </div>

      {/* Info extra */}
      <div className="flex gap-2 mb-4">
        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/30">
          {project.bairro || 'Vários'}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/30">
          {new Date(project.updated_at).toLocaleDateString()}
        </span>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-3 gap-2">
        <Button 
          onClick={() => onLoadProject(project)}
          className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 h-8 text-xs font-semibold"
        >
          <Play size={14} className="mr-1.5" /> Carregar
        </Button>
        <Button 
          onClick={() => onExportProject(project)}
          variant="ghost" 
          className="hover:bg-green-500/10 hover:text-green-400 text-slate-400 h-8 text-xs"
        >
          <Download size={14} />
        </Button>
        {project.user_id === currentUserId ? (
          <Button 
            onClick={() => onDeleteProject(project.id)}
            variant="ghost" 
            className="hover:bg-red-500/10 hover:text-red-400 text-slate-400 h-8 text-xs"
          >
            <Trash2 size={14} />
          </Button>
        ) : (
          <div className="flex items-center justify-center text-[10px] text-purple-400 opacity-50">
            <Users size={12} className="mr-1" /> Compartilhado
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f172a]/95 backdrop-blur-xl border-slate-700 text-white w-[95vw] max-w-4xl h-[85vh] p-0 gap-0 overflow-hidden shadow-2xl">
        
        {/* Header Glass */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              <Layers className="text-cyan-400" /> Gerenciador de Projetos
            </DialogTitle>
          </div>

          {/* Tabs & Search */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('mine')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'mine' 
                    ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Meus ({myProjects.length})
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'shared' 
                    ? 'bg-purple-500/10 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Compartilhados ({sharedProjects.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar projetos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/30 custom-scrollbar">
          
          {/* Área de Importar (Só aparece na aba Compartilhados) */}
          {activeTab === 'shared' && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20">
              <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <Share2 size={16} /> Importar Projeto Remoto
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Cole o ID do projeto aqui..."
                  className="flex-1 bg-slate-900/80 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none placeholder:text-slate-600 font-mono"
                />
                <Button 
                  onClick={handleJoin} 
                  disabled={loadingJoin || !joinId}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loadingJoin ? 'Buscando...' : <Plus size={18} />}
                </Button>
              </div>
            </div>
          )}

          {/* Grid de Projetos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProjects.length > 0 ? (
              displayedProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500 opacity-60">
                <FolderOpen size={48} className="mb-4 stroke-1" />
                <p>Nenhum projeto encontrado nesta aba.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <Button onClick={onClose} variant="ghost" className="text-slate-400 hover:text-white">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectManager;