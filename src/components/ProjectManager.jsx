import React, { useState } from 'react';
import { 
  FolderOpen, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, FileText, Edit3, 
  AlertTriangle, Activity, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';

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
  onOpenReport, // <--- A FUNÇÃO DO RELATÓRIO
  onOpenMembers 
}) => {
  const [activeTab, setActiveTab] = useState('mine');
  const [joinId, setJoinId] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [renameData, setRenameData] = useState(null);
  
  // Estado para confirmação de exclusão (Segurança)
  const [projectToDelete, setProjectToDelete] = useState(null);

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

  const handleRenameSubmit = () => {
    if (renameData && renameData.name.trim()) {
      onRenameProject(renameData.id, renameData.name.trim());
      setRenameData(null);
    }
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  // --- SUB-COMPONENTE DO CARD ---
  const ProjectCard = ({ project }) => {
    const isMine = project.user_id === currentUserId;
    const accentColor = isMine ? 'text-cyan-400' : 'text-purple-400';
    const glowColor = isMine ? 'bg-cyan-500' : 'bg-purple-500';

    return (
      <div className="group relative liquid-glass rounded-2xl p-4 mb-3 transition-all duration-300 active:scale-[0.98] overflow-hidden border border-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-cyan-900/20">
        
        {/* Cabeçalho do Card */}
        <div className="flex justify-between items-start relative z-10 gap-3">
          <div className="flex gap-3 items-center flex-1 min-w-0">
            {/* Ícone com Glow */}
            <div className="w-10 h-10 flex-shrink-0 icon-glow-container relative">
              <div className={`absolute inset-0 blur-lg opacity-20 ${glowColor}`}></div>
              <div className={`relative z-10 bg-slate-950/60 p-2 rounded-xl border border-white/10 ${accentColor} shadow-sm backdrop-blur-md flex items-center justify-center`}>
                {isMine ? <FolderOpen size={18} /> : <Users size={18} />}
              </div>
            </div>

            {/* Textos */}
            <div className="flex-1 min-w-0 pr-1"> 
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate" title={project.name}>
                  {project.name}
                </h3>
                {isMine && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setRenameData({ id: project.id, name: project.name }); }}
                    className="flex-shrink-0 text-slate-600 hover:text-cyan-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
                    title="Renomear"
                  >
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-medium text-slate-400 bg-slate-900/40 px-2 py-0.5 rounded-full border border-white/5 whitespace-nowrap font-mono">
                  {((project.total_distance || project.totalDistance || 0)/1000).toFixed(2)}km
                </span>
                <span className="text-[9px] text-slate-600 truncate">
                  {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Botão Copiar ID */}
          <button 
            onClick={(e) => handleCopyId(e, project.id)}
            className="flex-shrink-0 p-2 rounded-full hover:bg-white/10 text-slate-600 hover:text-white transition-colors"
            title="Copiar ID do Projeto"
          >
            {copiedId === project.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Footer de Ações */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
          {/* Botão Principal: CARREGAR */}
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-wide border-0 shadow-lg active:scale-95 transition-all ${
              isMine 
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white'
            }`}
          >
            <Play size={12} className="mr-2 fill-current" /> Abrir
          </Button>
          
          {/* Botões Secundários (Ferramentas) */}
          <div className="flex gap-1 flex-shrink-0 bg-slate-950/30 p-0.5 rounded-lg border border-white/5">
            
            {/* 1. DASHBOARD / EQUIPE */}
            <Button size="icon" variant="ghost" onClick={() => onOpenMembers(project)} className="h-8 w-8 rounded-md text-slate-400 hover:text-purple-400 hover:bg-purple-500/10" title="Hub & Equipe">
              <Activity size={16} />
            </Button>

            {/* 2. RELATÓRIO PDF (Aqui está ele!) */}
            <Button size="icon" variant="ghost" onClick={() => onOpenReport(project)} className="h-8 w-8 rounded-md text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10" title="Gerar Relatório">
              <ClipboardList size={16} />
            </Button>

            {/* 3. EXPORTAR KML */}
            <Button size="icon" variant="ghost" onClick={() => onExportProject(project)} className="h-8 w-8 rounded-md text-slate-400 hover:text-green-400 hover:bg-green-500/10" title="Baixar KML">
              <Download size={16} />
            </Button>

            {/* 4. EXCLUIR (Apenas Dono) */}
            {isMine && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setProjectToDelete(project)} // Abre confirmação
                className="h-8 w-8 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                title="Excluir Projeto"
              >
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
      {/* DIALOG PRINCIPAL DA LISTA */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
          <div className="flex flex-col h-full liquid-glass rounded-[32px] overflow-hidden relative shadow-2xl backdrop-blur-xl bg-slate-950/80 border border-white/10">
            
            {/* Header Fixo */}
            <div className="flex-none p-5 pb-2 bg-gradient-to-b from-white/5 to-transparent">
              <div className="flex flex-row items-center justify-between mb-4">
                <DialogTitle className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <FolderOpen className="text-cyan-400" size={24}/> Gerenciador
                </DialogTitle>
                <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full bg-slate-800/50 text-slate-400 hover:text-white -mr-2">
                  <X size={20} />
                </Button>
              </div>

              {/* Abas */}
              <div className="bg-slate-950/60 p-1 rounded-xl flex relative mb-4 border border-white/5 shadow-inner">
                <button 
                  onClick={() => setActiveTab('mine')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'mine' ? 'bg-slate-800 text-cyan-400 shadow-lg border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  MEUS PROJETOS
                </button>
                <button 
                  onClick={() => setActiveTab('shared')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'shared' ? 'bg-slate-800 text-purple-400 shadow-lg border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  COMPARTILHADOS
                </button>
              </div>

              {/* Barra de Busca / Input de Join */}
              <div className="relative h-12">
                {activeTab === 'mine' ? (
                  <div className="relative animate-in fade-in slide-in-from-left-2 duration-300">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Filtrar meus projetos..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-950/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-slate-900/60 transition-all placeholder:text-slate-600"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="relative flex-1">
                      <input 
                        value={joinId} 
                        onChange={(e) => setJoinId(e.target.value)} 
                        placeholder="Cole o ID do projeto..." 
                        className="w-full bg-purple-900/10 border border-purple-500/30 rounded-xl pl-4 pr-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none placeholder:text-purple-300/30" 
                      />
                    </div>
                    <Button 
                      size="icon" 
                      onClick={() => { if(joinId) onJoinProject(joinId); }} 
                      className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white w-12 h-11 shadow-lg shadow-purple-900/20 flex-shrink-0"
                      title="Entrar no Projeto"
                    >
                      <Plus size={20} />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Lista Scrollável */}
            <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar space-y-1 pb-20">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 mt-10">
                  <div className="w-16 h-16 bg-slate-900/50 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen size={24} className="opacity-30" />
                  </div>
                  <p className="text-sm font-medium opacity-50">Nenhum projeto encontrado</p>
                  {activeTab === 'shared' && <p className="text-xs opacity-30 mt-1">Cole um ID acima para entrar</p>}
                </div>
              ) : (
                displayedProjects.map(project => <ProjectCard key={project.id} project={project} />)
              )}
            </div>
            
            {/* Gradiente inferior para suavizar o scroll */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none"></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- MODAL DE SEGURANÇA (CONFIRMAR EXCLUSÃO) --- */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-xs shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-red-400 text-lg">
              <div className="p-2 bg-red-500/10 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
              Excluir Projeto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm mt-2">
              Você está prestes a apagar <b>{projectToDelete?.name}</b> permanentemente. <br/><br/>
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-slate-800 border-none text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-500 text-white border-none rounded-xl shadow-lg shadow-red-900/20"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- MODAL DE RENOMEAR --- */}
      <Dialog open={!!renameData} onOpenChange={() => setRenameData(null)}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-white max-w-sm rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Renomear Projeto</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={renameData?.name || ''} 
              onChange={(e) => setRenameData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-slate-950 border-slate-700 text-white focus:border-cyan-500"
              autoFocus
              placeholder="Novo nome..."
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRenameData(null)} className="text-slate-400 hover:text-white">Cancelar</Button>
            <Button onClick={handleRenameSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectManager;