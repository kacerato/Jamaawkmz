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

const ProjectManager = ({ 
  isOpen, onClose, projects, currentUserId,
  onLoadProject, onDeleteProject, onExportProject,
  onJoinProject, onRenameProject, onOpenReport, onOpenMembers 
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

  const ProjectCard = ({ project }) => {
    const isMine = project.user_id === currentUserId;
    // Design limpo, sem firulas natalinas
    const glowClass = isMine 
      ? 'border-cyan-500/20 hover:border-cyan-500/40' 
      : 'border-purple-500/20 hover:border-purple-500/40';

    return (
      <div className={`group relative bg-slate-900/80 backdrop-blur-md rounded-xl p-4 mb-3 transition-all duration-200 border ${glowClass} hover:bg-slate-800`}>
        <div className="flex justify-between items-start gap-4">
          <div className="relative">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 ${isMine ? 'bg-cyan-950/50 text-cyan-400' : 'bg-purple-950/50 text-purple-400'}`}>
              {isMine ? <FolderOpen size={20} /> : <Users size={20} />}
            </div>
          </div>

          <div className="flex-1 min-w-0 pt-0.5"> 
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={project.name}>
                {project.name}
              </h3>
              {isMine && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setRenameData({ id: project.id, name: project.name }); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-cyan-400 transition-all"
                >
                  <Edit3 size={12} />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-[10px] font-mono text-cyan-200/70 bg-cyan-500/5 px-1.5 py-0.5 rounded border border-cyan-500/10 flex items-center gap-1">
                 <MapPin size={10} /> {((project.total_distance || project.totalDistance || 0)/1000).toFixed(2)} km
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
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
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
            title="Copiar ID"
          >
            {copiedId === project.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-8 rounded-lg text-xs font-bold uppercase tracking-wider border-0 shadow-lg active:scale-95 transition-all ${
              isMine 
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white' 
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            <Play size={10} className="mr-1.5 fill-current" /> Abrir
          </Button>
          
          <div className="flex bg-black/20 rounded-lg p-0.5 border border-white/5">
            <ActionButton icon={Activity} onClick={() => onOpenMembers(project)} title="Equipe" color="text-slate-400 hover:text-purple-400" />
            <div className="w-px bg-white/5 my-1"></div>
            <ActionButton icon={ClipboardList} onClick={() => onOpenReport(project)} title="Relatório" color="text-slate-400 hover:text-yellow-400" />
            <div className="w-px bg-white/5 my-1"></div>
            <ActionButton icon={Download} onClick={() => onExportProject(project)} title="Exportar" color="text-slate-400 hover:text-green-400" />
            {isMine && (
              <>
                <div className="w-px bg-white/5 my-1"></div>
                <ActionButton icon={Trash2} onClick={() => setProjectToDelete(project)} title="Excluir" color="text-slate-500 hover:text-red-400" />
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ActionButton = ({ icon: Icon, onClick, title, color }) => (
    <button onClick={onClick} className={`p-1.5 rounded-md transition-all active:scale-90 ${color}`} title={title}>
      <Icon size={14} />
    </button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
          <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-2xl rounded-[24px] overflow-hidden border border-white/10 shadow-2xl">
            <div className="flex-none p-5 pb-2 bg-gradient-to-b from-slate-900 to-transparent">
              <div className="flex justify-between items-center mb-4">
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                   <FolderOpen className="text-cyan-400" size={20}/> Gerenciador
                </DialogTitle>
                <button onClick={onClose} className="bg-slate-800/50 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="bg-black/30 p-1 rounded-xl flex mb-4 border border-white/5">
                {['mine', 'shared'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} 
                    className={`flex-1 py-2 text-[10px] uppercase font-bold rounded-lg transition-all ${
                      activeTab === tab ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'mine' ? 'Meus Projetos' : 'Compartilhados'}
                  </button>
                ))}
              </div>

              <div className="relative group">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input type="text" placeholder="Filtrar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:bg-slate-900 transition-all outline-none"
                />
              </div>
              
              {activeTab === 'shared' && (
                 <div className="flex gap-2 mt-2">
                    <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Cole o ID..." className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-xl pl-3 py-2 text-sm text-white focus:border-purple-500/50 outline-none" />
                    <Button onClick={() => joinId && onJoinProject(joinId)} className="bg-purple-600 hover:bg-purple-500 h-auto rounded-xl aspect-square p-0 w-10"><Plus size={18} /></Button>
                 </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar space-y-2 pb-10">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500 opacity-60">
                  <FolderOpen size={32} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">Nada encontrado</p>
                </div>
              ) : (
                displayedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-xs">
            <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2"><AlertTriangle size={18}/> Excluir?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-xs">Ação irreversível.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-transparent border-slate-700 h-8 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 border-none h-8 text-xs">Sim, Excluir</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameData} onOpenChange={() => setRenameData(null)}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-xs">
            <DialogHeader><DialogTitle className="text-cyan-400 text-sm">Renomear</DialogTitle></DialogHeader>
            <Input value={renameData?.name || ''} onChange={(e) => setRenameData({...renameData, name: e.target.value})} className="bg-slate-950 border-slate-700 text-white h-9 text-sm" autoFocus />
            <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setRenameData(null)} className="text-slate-400 h-8 text-xs">Cancelar</Button>
                <Button onClick={() => {if(renameData) onRenameProject(renameData.id, renameData.name); setRenameData(null);}} className="bg-cyan-600 h-8 text-xs">Salvar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectManager;