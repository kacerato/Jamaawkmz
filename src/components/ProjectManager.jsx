import React, { useState } from 'react';
import { 
  FolderOpen, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, Edit3, 
  Activity, ClipboardList, AlertTriangle, Calendar, MapPin
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

// --- DECORAÇÃO: GORRO DE NATAL REALISTA (SVG) ---
const RealisticSantaHat = () => (
  <svg viewBox="0 0 200 200" className="w-10 h-10 absolute -top-4 -right-3 z-20 drop-shadow-2xl filter saturate-150 pointer-events-none transform -rotate-12">
    {/* Pom Pom (Bolinha Branca) */}
    <circle cx="160" cy="40" r="12" fill="#f8fafc" filter="url(#glow)" />
    
    {/* Gorro Vermelho (Corpo) */}
    <path 
      d="M40 140 Q 90 20 160 40 L 140 140 Z" 
      fill="#dc2626" 
      stroke="#b91c1c" 
      strokeWidth="2"
    />
    
    {/* Faixa Branca (Base) */}
    <path 
      d="M30 140 Q 90 150 150 140 L 150 160 Q 90 170 30 160 Z" 
      fill="#f1f5f9" 
      stroke="#e2e8f0" 
      strokeWidth="1"
    />
    
    {/* Definição de Brilho */}
    <defs>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  </svg>
);

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
  onOpenReport,   
  onOpenMembers   
}) => {
  const [activeTab, setActiveTab] = useState('mine');
  const [joinId, setJoinId] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [renameData, setRenameData] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const myProjects = projects.filter(p => p.user_id === currentUserId);
  const sharedProjects = projects.filter(p => p.user_id !== currentUserId);
  
  const displayedProjects = (activeTab === 'mine' ? myProjects : sharedProjects)
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  // --- CARD COM DESIGN PREMIUM ---
  const ProjectCard = ({ project, index }) => {
    const isMine = project.user_id === currentUserId;
    
    // Efeito de Glow Baseado no Tipo (Meu vs Compartilhado)
    const glowClass = isMine 
      ? 'shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)] border-cyan-500/20' 
      : 'shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)] border-purple-500/20';

    return (
      <div className={`group relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 mb-3 transition-all duration-300 border ${glowClass} hover:border-white/20 hover:bg-slate-800/80 hover:scale-[1.01]`}>
        
        {/* Decoração apenas no primeiro item */}
        {index === 0 && <RealisticSantaHat />}

        <div className="flex justify-between items-start relative z-10 gap-4">
          {/* Ícone Container */}
          <div className="relative">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 shadow-inner ${isMine ? 'bg-cyan-950/30 text-cyan-400' : 'bg-purple-950/30 text-purple-400'}`}>
              {isMine ? <FolderOpen size={22} /> : <Users size={22} />}
            </div>
          </div>

          <div className="flex-1 min-w-0 pt-0.5"> 
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={project.name}>
                {project.name}
              </h3>
              {isMine && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setRenameData({ id: project.id, name: project.name }); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-cyan-400 transition-all"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-[11px] font-mono text-cyan-200/70 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10 flex items-center gap-1">
                 <MapPin size={10} /> {((project.total_distance || project.totalDistance || 0)/1000).toFixed(2)} km
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Calendar size={10} /> {new Date(project.updated_at || project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <button 
            onClick={(e) => {
               e.stopPropagation();
               navigator.clipboard.writeText(project.id);
               setCopiedId(project.id);
               setTimeout(() => setCopiedId(null), 2000);
            }}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-600 hover:text-white transition-colors"
            title="Copiar ID"
          >
            {copiedId === project.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>

        {/* --- BARRA DE AÇÕES --- */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-wider border-0 shadow-lg active:scale-95 transition-all ${
              isMine 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
            }`}
          >
            <Play size={12} className="mr-2 fill-current" /> Abrir
          </Button>
          
          <div className="flex bg-black/20 rounded-lg p-0.5 border border-white/5">
            <ActionButton 
                icon={Activity} 
                onClick={() => onOpenMembers(project)} 
                title="Equipe" 
                color="text-slate-400 hover:text-purple-400 hover:bg-purple-500/10" 
            />
            <div className="w-px bg-white/5 my-1"></div>
            <ActionButton 
                icon={ClipboardList} 
                onClick={() => onOpenReport(project)} 
                title="Relatório" 
                color="text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10" 
            />
            <div className="w-px bg-white/5 my-1"></div>
            <ActionButton 
                icon={Download} 
                onClick={() => onExportProject(project)} 
                title="Exportar" 
                color="text-slate-400 hover:text-green-400 hover:bg-green-500/10" 
            />
            {isMine && (
              <>
                <div className="w-px bg-white/5 my-1"></div>
                <ActionButton 
                    icon={Trash2} 
                    onClick={() => setProjectToDelete(project)} 
                    title="Excluir" 
                    color="text-slate-500 hover:text-red-400 hover:bg-red-500/10" 
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ActionButton = ({ icon: Icon, onClick, title, color }) => (
    <button 
      onClick={onClick}
      className={`p-2 rounded-md transition-all active:scale-90 ${color}`}
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed z-[9999] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
          
          <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-3xl rounded-[32px] overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5">
            
            {/* Header */}
            <div className="flex-none p-6 pb-2 bg-gradient-to-b from-slate-900 to-transparent">
              <div className="flex justify-between items-center mb-6">
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                     <FolderOpen className="text-cyan-400" size={20}/> 
                   </div>
                   Gerenciador
                </DialogTitle>
                <button onClick={onClose} className="bg-slate-800/50 p-2 rounded-full text-slate-400 hover:text-white hover:bg-red-500/20 transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="bg-black/40 p-1.5 rounded-2xl flex mb-4 border border-white/5 shadow-inner">
                {['mine', 'shared'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                      activeTab === tab 
                      ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {tab === 'mine' ? 'MEUS PROJETOS' : 'COMPARTILHADOS'}
                  </button>
                ))}
              </div>

              {/* Busca / Join */}
              <div className="relative animate-in fade-in duration-300">
                {activeTab === 'mine' ? (
                  <div className="relative group">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Filtrar projetos..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:bg-slate-900/80 transition-all placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input 
                      value={joinId} 
                      onChange={(e) => setJoinId(e.target.value)} 
                      placeholder="Cole o ID para entrar..." 
                      className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-xl pl-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none placeholder:text-purple-300/30" 
                    />
                    <Button onClick={() => joinId && onJoinProject(joinId)} className="bg-purple-600 hover:bg-purple-500 h-auto rounded-xl shadow-lg shadow-purple-900/20 aspect-square p-0 w-12 flex items-center justify-center">
                      <Plus size={24} />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Lista Scrollável */}
            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-2 pb-20 scroll-smooth">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-700">
                     <FolderOpen size={32} className="opacity-50" />
                  </div>
                  <p className="text-sm font-medium">Nenhum projeto encontrado</p>
                </div>
              ) : (
                displayedProjects.map((project, idx) => (
                  <ProjectCard key={project.id} project={project} index={idx} />
                ))
              )}
            </div>
            
            {/* Gradiente Inferior */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none"></div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Alerta de Exclusão */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-xs shadow-2xl">
            <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-3 text-lg">
                <div className="p-2 bg-red-500/10 rounded-full"><AlertTriangle size={20}/></div>
                Excluir Projeto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 mt-2">
                Você está prestes a apagar <b>{projectToDelete?.name}</b> permanentemente.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={confirmDelete} 
                className="bg-red-600 hover:bg-red-500 border-none rounded-xl h-11 text-white shadow-lg shadow-red-900/20"
            >
                Sim, Excluir
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renomear */}
      <Dialog open={!!renameData} onOpenChange={() => setRenameData(null)}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl">
            <DialogHeader><DialogTitle className="text-cyan-400">Renomear Projeto</DialogTitle></DialogHeader>
            <div className="py-2">
                <Input 
                    value={renameData?.name || ''} 
                    onChange={(e) => setRenameData({...renameData, name: e.target.value})} 
                    className="bg-slate-950 border-slate-700 text-white focus:border-cyan-500" 
                    placeholder="Novo nome..."
                    autoFocus
                />
            </div>
            <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setRenameData(null)} className="text-slate-400 hover:text-white">Cancelar</Button>
                <Button onClick={() => {if(renameData) onRenameProject(renameData.id, renameData.name); setRenameData(null);}} className="bg-cyan-600 hover:bg-cyan-500 text-white">Salvar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectManager;