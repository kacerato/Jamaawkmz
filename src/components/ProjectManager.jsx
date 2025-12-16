import React, { useState } from 'react';
import { 
  FolderOpen, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, MapPin, FileText, Edit3, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

const ProjectManager = ({ 
  isOpen, 
  onClose, 
  projects, 
  currentUserId,
  onLoadProject, 
  onDeleteProject, 
  onExportProject,
  onJoinProject,
  onRenameProject, 
  onOpenReport 
}) => {
  const [activeTab, setActiveTab] = useState('mine');
  const [joinId, setJoinId] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para controlar o Dialog de Renomear
  const [renameData, setRenameData] = useState(null); // { id: string, name: string }

  // Filtra projetos (Meus vs Compartilhados)
  const myProjects = projects.filter(p => p.user_id === currentUserId);
  const sharedProjects = projects.filter(p => p.user_id !== currentUserId);
  
  // Filtra pela busca
  const displayedProjects = (activeTab === 'mine' ? myProjects : sharedProjects)
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleCopyId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRenameSubmit = () => {
    if (renameData && renameData.name.trim()) {
      onRenameProject(renameData.id, renameData.name.trim());
      setRenameData(null);
    }
  };

  // Componente interno do Card
  const ProjectCard = ({ project }) => {
    const isMine = project.user_id === currentUserId;
    const accentColor = isMine ? 'text-cyan-400' : 'text-purple-400';
    const glowColor = isMine ? 'bg-cyan-500' : 'bg-purple-500';

    return (
      <div className="group relative liquid-glass rounded-2xl p-4 mb-3 transition-all duration-300 active:scale-[0.98] overflow-hidden">
        {/* Header do Card */}
        <div className="flex justify-between items-start relative z-10 gap-3">
          
          {/* LADO ESQUERDO: Ícone + Textos (Com flex-1 e min-w-0 para permitir truncate) */}
          <div className="flex gap-3 items-center flex-1 min-w-0">
            <div className="w-10 h-10 flex-shrink-0 icon-glow-container">
              <div className={`icon-glow-bg ${glowColor}`}></div>
              <div className={`relative z-10 bg-slate-950/60 p-2 rounded-xl border border-white/10 ${accentColor} shadow-sm backdrop-blur-md`}>
                {isMine ? <FolderOpen size={18} /> : <Users size={18} />}
              </div>
            </div>

            <div className="flex-1 min-w-0 pr-1"> 
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate" title={project.name}>
                  {project.name}
                </h3>
                {/* Botão de Editar Nome */}
                {isMine && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setRenameData({ id: project.id, name: project.name }); 
                    }}
                    className="flex-shrink-0 text-slate-600 hover:text-cyan-400 p-1 transition-colors"
                    title="Renomear projeto"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-medium text-slate-400 bg-slate-900/40 px-2 py-0.5 rounded-full border border-white/5 whitespace-nowrap">
                  {((project.total_distance || project.totalDistance || 0)/1000).toFixed(2)}km
                </span>
                <span className="text-[9px] text-slate-600 truncate">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: Botão Copiar ID (Com flex-shrink-0 para nunca sumir) */}
          <button 
            onClick={(e) => handleCopyId(e, project.id)}
            className="flex-shrink-0 p-2 rounded-full hover:bg-white/10 text-slate-600 hover:text-white transition-colors active:bg-cyan-500/20"
            title="Copiar ID do Projeto"
          >
            {copiedId === project.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>

        {/* Footer de Ações */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-wide border-0 shadow-lg active:scale-95 ${
              isMine 
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
            }`}
          >
            <Play size={12} className="mr-2 fill-current" /> Carregar
          </Button>
          
          <div className="flex gap-1 flex-shrink-0">
            <Button size="icon" variant="ghost" onClick={() => onOpenReport(project)} className="h-9 w-9 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30">
              <FileText size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onExportProject(project)} className="h-9 w-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
              <Download size={16} />
            </Button>
            {isMine && (
              <Button size="icon" variant="ghost" onClick={() => onDeleteProject(project.id)} className="h-9 w-9 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
          <div className="flex flex-col h-full liquid-glass rounded-[32px] overflow-hidden relative shadow-2xl">
            
            {/* Header Fixo */}
            <div className="flex-none p-5 pb-2 bg-gradient-to-b from-white/5 to-transparent">
              <DialogHeader className="flex flex-row items-center justify-between mb-4 space-y-0 text-left">
                <DialogTitle className="text-xl font-bold text-white tracking-tight">Meus Projetos</DialogTitle>
                <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full bg-slate-800/50 text-slate-400 hover:text-white -mr-2">
                  <X size={20} />
                </Button>
              </DialogHeader>

              {/* Botões de Abas */}
              <div className="bg-slate-950/40 p-1 rounded-full flex relative mb-4 border border-white/5">
                <button 
                  onClick={() => setActiveTab('mine')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${activeTab === 'mine' ? 'bg-slate-800 text-cyan-400 shadow-lg' : 'text-slate-500'}`}
                >
                  MEUS
                </button>
                <button 
                  onClick={() => setActiveTab('shared')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${activeTab === 'shared' ? 'bg-slate-800 text-purple-400 shadow-lg' : 'text-slate-500'}`}
                >
                  COMPARTILHADOS
                </button>
              </div>

              {/* LÓGICA CONDICIONAL DE INPUTS */}
              
              {/* 1. Barra de Busca (Aparece apenas na aba MEUS) */}
              {activeTab === 'mine' && (
                <div className="relative animate-in fade-in zoom-in-95 duration-200">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Buscar meus projetos..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950/30 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/30"
                  />
                </div>
              )}

              {/* 2. Campo de Adicionar Projeto (Aparece apenas na aba COMPARTILHADOS) */}
              {activeTab === 'shared' && (
                <div className="mb-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        value={joinId} 
                        onChange={(e) => setJoinId(e.target.value)} 
                        placeholder="Cole o ID do projeto aqui..." 
                        className="w-full bg-purple-900/10 border border-purple-500/30 rounded-xl pl-4 pr-4 py-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-slate-600" 
                      />
                    </div>
                    <Button 
                      size="icon" 
                      onClick={() => { if(joinId) onJoinProject(joinId); }} 
                      className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white w-12 h-11 shadow-lg shadow-purple-900/20 flex-shrink-0"
                      title="Adicionar Projeto"
                    >
                      <Plus size={20} />
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 ml-1">
                    Peça o ID para o criador do projeto e cole acima para entrar.
                  </p>
                </div>
              )}
            </div>

            {/* Lista com Scroll */}
            <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar space-y-1 pb-20">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <FolderOpen size={32} className="opacity-20 mb-2" />
                  <p className="text-sm font-medium opacity-50">
                    {activeTab === 'mine' ? 'Nenhum projeto encontrado' : 'Nenhum projeto compartilhado'}
                  </p>
                </div>
              ) : (
                displayedProjects.map(project => <ProjectCard key={project.id} project={project} />)
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE RENOMEAR */}
      <Dialog open={!!renameData} onOpenChange={() => setRenameData(null)}>
        <DialogContent className="fixed z-[10010] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-slate-900 border border-slate-700 text-white w-[90vw] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Renomear Projeto</DialogTitle>
            <DialogDescription className="text-slate-400">
              Digite o novo nome para o projeto.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input 
              value={renameData?.name || ''} 
              onChange={(e) => setRenameData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-slate-950 border-slate-700 text-white"
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRenameData(null)}>Cancelar</Button>
            <Button onClick={handleRenameSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectManager;