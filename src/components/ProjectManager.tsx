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
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '@/types';

// --- DECORAÇÃO: GORRO DE NATAL REALISTA (IMAGEM BASE64) ---
const RealisticSantaHat = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
    animate={{ opacity: 1, scale: 1, rotate: -12 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className="absolute -top-7 -right-6 z-20 pointer-events-none drop-shadow-2xl"
  >
    {/* Usando uma imagem base64 de um gorro realista para garantir que sempre carregue */}
    <img
      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAllBMVEUAAAD///+FhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWIiIiFhYWd0Z0nAAAALXRSTlMAAAgNEB4gIiYvMDI2OzxDRkdJSktMTk9QUlVWV1hhYmRlaGpub3Byc3R1eH2Awq5nAAAAAXRSTlMAQObYZgAAAhpJREFUWMPtl1tXwjAQhS8qKCh4QcSrFxERr1e9//+v2k5S2qS0hzz0wTp7z8w22Zk002Qy/6+f4/W+Xq/f70c/J5PpdD6fL+bzhdPp+Pl4PE6n0+l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fz+Xw+n8/n8/l8Pp/P5/P5fD6fz+fzuW2/A+5/f79f0B8/AAAAAElFTkSuQmCC"
      alt="Santa Hat"
      className="w-16 h-16 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
    />
  </motion.div>
);

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentUserId: string;
  onLoadProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onExportProject: (project: Project) => void;
  onJoinProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onOpenReport: (project: Project) => void;
  onOpenMembers: (project: Project) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({
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
  const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');
  const [joinId, setJoinId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [renameData, setRenameData] = useState<{id: string, name: string} | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

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

  // --- CARD COM DESIGN LIQUID GLASS ---
  const ProjectCard = ({ project, index }: { project: Project, index: number }) => {
    const isMine = project.user_id === currentUserId;

    // Efeito de Glow Baseado no Tipo (Meu vs Compartilhado)
    // Cores vibrantes com alta saturação para o conceito "Liquid Glass"
    const containerClasses = isMine
      ? 'bg-gradient-to-br from-cyan-900/30 to-slate-900/60 border-cyan-500/20 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)]'
      : 'bg-gradient-to-br from-purple-900/30 to-slate-900/60 border-purple-500/20 shadow-[0_0_20px_-5px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_-5px_rgba(168,85,247,0.3)]';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`group relative backdrop-blur-xl rounded-3xl p-5 mb-4 transition-all duration-300 border ${containerClasses} hover:scale-[1.01] overflow-visible`}
      >

        {/* Decoração apenas no primeiro item */}
        {index === 0 && <RealisticSantaHat />}

        <div className="flex justify-between items-start relative z-10 gap-4">
          {/* Ícone Container com efeito "Gummy/Liquid" */}
          <div className="relative">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner backdrop-blur-md ${isMine ? 'bg-cyan-500/10 text-cyan-300' : 'bg-purple-500/10 text-purple-300'}`}>
              {isMine ? <FolderOpen size={24} className="drop-shadow-lg" /> : <Users size={24} className="drop-shadow-lg" />}
            </div>
            {/* Liquid blobs decoration */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full blur-sm opacity-50 ${isMine ? 'bg-cyan-400' : 'bg-purple-400'}`}></div>
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white/90 truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-cyan-200 transition-all duration-300" title={project.name}>
                {project.name}
              </h3>
              {isMine && (
                <button
                  onClick={(e) => { e.stopPropagation(); setRenameData({ id: project.id, name: project.name }); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-full transition-all"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-[11px] font-bold tracking-wide text-cyan-200/80 bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-500/20 flex items-center gap-1.5 shadow-sm">
                 <MapPin size={10} className="text-cyan-400" /> {((project.total_distance || project.totalDistance || 0)/1000).toFixed(2)} km
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Calendar size={10} /> {new Date(project.updated_at || project.created_at || Date.now()).toLocaleDateString()}
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
            className="p-2.5 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-colors border border-transparent hover:border-white/5"
            title="Copiar ID"
          >
            {copiedId === project.id ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
          </button>
        </div>

        {/* --- BARRA DE AÇÕES FLUIDA --- */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
          <Button
            onClick={() => onLoadProject(project)}
            className={`flex-grow h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border-0 shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap min-w-[140px] ${
              isMine
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/20 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:shadow-purple-500/20 text-white'
            }`}
          >
            <Play size={16} className="fill-current shrink-0" />
            <span>Abrir Projeto</span>
          </Button>

          <div className="flex bg-slate-950/40 backdrop-blur-sm rounded-xl p-1 border border-white/5 shadow-inner shrink-0">
            <ActionButton
                icon={Activity}
                onClick={() => onOpenMembers(project)}
                title="Equipe"
                color="text-slate-400 hover:text-purple-300 hover:bg-purple-500/20"
            />
            <div className="w-px bg-white/5 my-1 mx-0.5"></div>
            <ActionButton
                icon={ClipboardList}
                onClick={() => onOpenReport(project)}
                title="Relatório"
                color="text-slate-400 hover:text-yellow-300 hover:bg-yellow-500/20"
            />
            <div className="w-px bg-white/5 my-1 mx-0.5"></div>
            <ActionButton
                icon={Download}
                onClick={() => onExportProject(project)}
                title="Exportar"
                color="text-slate-400 hover:text-green-300 hover:bg-green-500/20"
            />
            {isMine && (
              <>
                <div className="w-px bg-white/5 my-1 mx-0.5"></div>
                <ActionButton
                    icon={Trash2}
                    onClick={() => setProjectToDelete(project)}
                    title="Excluir"
                    color="text-slate-500 hover:text-red-300 hover:bg-red-500/20"
                />
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const ActionButton = ({ icon: Icon, onClick, title, color }: any) => (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all active:scale-90 ${color}`}
      title={title}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed z-[9999] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">

          <motion.div
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.9 }}
             className="flex flex-col h-full bg-slate-950/80 backdrop-blur-[40px] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5 relative"
          >
            {/* Background Gradients (Liquid effects) */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none"></div>
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/20 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute top-40 -left-20 w-48 h-48 bg-blue-600/10 rounded-full blur-[60px] pointer-events-none"></div>

            {/* Header */}
            <div className="flex-none p-6 pb-2 relative z-10">
              <div className="flex justify-between items-center mb-6">
                <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
                   <div className="relative group">
                     <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                     <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-900/80 to-slate-900 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                       <FolderOpen className="text-cyan-400 drop-shadow-md" size={22}/>
                     </div>
                   </div>
                   <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Gerenciador</span>
                </DialogTitle>
                <button
                  onClick={onClose}
                  className="bg-white/5 hover:bg-red-500/20 p-2.5 rounded-full text-slate-400 hover:text-white transition-all backdrop-blur-md border border-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs com estilo "Pill" flutuante */}
              <div className="bg-black/20 backdrop-blur-md p-1.5 rounded-2xl flex mb-5 border border-white/5 shadow-inner relative overflow-hidden">
                {['mine', 'shared'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`relative z-10 flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 tracking-wide ${
                      activeTab === tab
                      ? 'text-white shadow-lg'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-slate-800 rounded-xl shadow-sm border border-white/10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {tab === 'mine' ? <FolderOpen size={14}/> : <Users size={14}/>}
                      {tab === 'mine' ? 'MEUS PROJETOS' : 'COMPARTILHADOS'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Busca / Join */}
              <div className="relative">
                <AnimatePresence mode="wait">
                {activeTab === 'mine' ? (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative group"
                  >
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="Filtrar projetos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:border-cyan-500/50 focus:bg-slate-900/60 transition-all placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-cyan-500/20 backdrop-blur-sm"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="join"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex gap-3"
                  >
                    <input
                      value={joinId}
                      onChange={(e) => setJoinId(e.target.value)}
                      placeholder="Cole o ID para entrar..."
                      className="flex-1 bg-purple-900/20 border border-purple-500/20 rounded-2xl pl-5 py-3.5 text-sm text-white focus:border-purple-500/50 outline-none placeholder:text-purple-300/30 backdrop-blur-sm focus:bg-purple-900/30 transition-all"
                    />
                    <Button onClick={() => joinId && onJoinProject(joinId)} className="bg-purple-600 hover:bg-purple-500 h-auto rounded-2xl shadow-lg shadow-purple-900/30 aspect-square p-0 w-12 flex items-center justify-center hover:scale-105 transition-transform">
                      <Plus size={24} />
                    </Button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>

            {/* Lista Scrollável */}
            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-1 pb-24 scroll-smooth z-10">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                  <div className="w-20 h-20 bg-slate-800/30 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-700 backdrop-blur-sm">
                     <FolderOpen size={32} className="opacity-50" />
                  </div>
                  <p className="text-base font-medium">Nenhum projeto encontrado</p>
                </div>
              ) : (
                displayedProjects.map((project, idx) => (
                  <ProjectCard key={project.id} project={project} index={idx} />
                ))
              )}
            </div>

            {/* Gradiente Inferior para suavizar o scroll */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none z-20"></div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Alerta de Exclusão */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700 text-white rounded-[32px] max-w-xs shadow-2xl">
            <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-3 text-xl">
                <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20"><AlertTriangle size={24}/></div>
                Excluir?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 mt-2 text-base">
                Você vai apagar <b>{projectToDelete?.name}</b> para sempre. Tem certeza?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 flex-col sm:flex-row">
            <AlertDialogCancel className="w-full bg-slate-800/50 border-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-12 text-sm font-bold">CANCELAR</AlertDialogCancel>
            <AlertDialogAction
                onClick={confirmDelete}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-none rounded-xl h-12 text-white shadow-lg shadow-red-900/30 text-sm font-bold"
            >
                SIM, EXCLUIR
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renomear */}
      <Dialog open={!!renameData} onOpenChange={() => setRenameData(null)}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700 text-white rounded-3xl shadow-2xl">
            <DialogHeader><DialogTitle className="text-cyan-400 text-xl">Renomear Projeto</DialogTitle></DialogHeader>
            <div className="py-4">
                <Input
                    value={renameData?.name || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameData(prev => prev ? {...prev, name: e.target.value} : null)}
                    className="bg-slate-950/50 border-slate-700 text-white focus:border-cyan-500 h-12 rounded-xl text-lg px-4"
                    placeholder="Novo nome..."
                    autoFocus
                />
            </div>
            <DialogFooter className="gap-3">
                <Button variant="ghost" onClick={() => setRenameData(null)} className="text-slate-400 hover:text-white rounded-xl h-11">Cancelar</Button>
                <Button onClick={() => {if(renameData) onRenameProject(renameData.id, renameData.name); setRenameData(null);}} className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl h-11 px-6 font-bold shadow-lg shadow-cyan-900/20">Salvar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectManager;
