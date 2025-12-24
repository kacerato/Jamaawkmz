import React, { useState } from 'react';
import { 
  FolderOpen, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, Edit3, 
  Activity, ClipboardList, AlertTriangle, Calendar, MapPin, Hash, FileText, Share2
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

  const calculateProjectDistance = (project) => {
    if (!project || !project.points || project.points.length < 2) {
      return project?.total_distance || project?.totalDistance || 0;
    }
    
    let totalDistance = 0;
    for (let i = 1; i < project.points.length; i++) {
      const current = project.points[i];
      const previous = project.points[i - 1];
      
      if (current && previous && current.lat && current.lng && previous.lat && previous.lng) {
        const lat1 = previous.lat * Math.PI / 180;
        const lat2 = current.lat * Math.PI / 180;
        const dLat = (current.lat - previous.lat) * Math.PI / 180;
        const dLng = (current.lng - previous.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(lat1) * Math.cos(lat2) *
                 Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const R = 6378137;
        const dist = R * c;
        
        const spans = (current.spans !== undefined && current.spans !== null && !isNaN(current.spans)) ? 
                     Math.max(1, Number(current.spans)) : 1;
        
        totalDistance += (dist * spans);
      }
    }
    
    return totalDistance;
  };

  const ProjectCard = ({ project }) => {
    const isMine = project.user_id === currentUserId;
    const projectDistance = calculateProjectDistance(project);
    
    // Contar vãos totais
    const totalSpans = project.points?.reduce((sum, point) => {
      const spans = (point.spans !== undefined && point.spans !== null && !isNaN(point.spans)) ? 
                   Math.max(1, Number(point.spans)) : 1;
      return sum + spans;
    }, 0) || 0;

    const handleOpenMembers = (e) => {
      e.stopPropagation();
      if (onOpenMembers) {
        onOpenMembers(project);
      } else {
        console.warn('onOpenMembers não está definido');
      }
    };

    const handleOpenReport = (e) => {
      e.stopPropagation();
      if (onOpenReport) {
        onOpenReport(project);
      }
    };

    return (
      <div className={`group relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md rounded-xl p-4 mb-3 transition-all duration-300 border ${
        isMine 
          ? 'border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
          : 'border-purple-500/20 hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]'
      } hover:scale-[1.02] hover:bg-slate-800/90`}>
        
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
              isMine 
                ? 'bg-cyan-950/50 border-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
                : 'bg-purple-950/50 border-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
            }`}>
              {isMine ? <FolderOpen size={20} /> : <Users size={20} />}
            </div>

            <div className="flex-1 min-w-0"> 
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={project.name}>
                  {project.name}
                </h3>
                {isMine && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setRenameData({ id: project.id, name: project.name }); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-cyan-400 transition-all"
                    title="Renomear"
                  >
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center gap-1">
                  <MapPin size={10} /> {(projectDistance/1000).toFixed(2)} km
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center gap-1">
                  <Hash size={10} /> {totalSpans} vãos
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar size={10} /> {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(project.id);
              setCopiedId(project.id);
              setTimeout(() => setCopiedId(null), 2000);
            }}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-colors flex-shrink-0"
            title="Copiar ID"
          >
            {copiedId === project.id ? (
              <div className="flex items-center gap-1">
                <Check size={14} className="text-green-400" />
                <span className="text-[10px] text-green-400">Copiado!</span>
              </div>
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-white/5">
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-8 rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-all ${
              isMine 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
            }`}
          >
            <Play size={10} className="mr-1.5 fill-current" /> Abrir
          </Button>
          
          <div className="flex bg-black/30 rounded-lg p-0.5 border border-white/5 items-center">
            <ActionButton 
              icon={Activity} 
              onClick={handleOpenMembers}
              title="Equipe" 
              color="text-slate-400 hover:text-purple-400 hover:bg-purple-500/10" 
              tooltip="Ver equipe"
            />
            <div className="w-px bg-white/5 h-4 mx-0.5"></div>
            <ActionButton 
              icon={ClipboardList} 
              onClick={handleOpenReport}
              title="Relatório" 
              color="text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10"
              tooltip="Gerar relatório"
            />
            <div className="w-px bg-white/5 h-4 mx-0.5"></div>
            <ActionButton 
              icon={Download} 
              onClick={() => onExportProject(project)} 
              title="Exportar" 
              color="text-slate-400 hover:text-green-400 hover:bg-green-500/10"
              tooltip="Exportar KML"
            />
            {isMine && (
              <>
                <div className="w-px bg-white/5 h-4 mx-0.5"></div>
                <ActionButton 
                  icon={Trash2} 
                  onClick={() => setProjectToDelete(project)} 
                  title="Excluir" 
                  color="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                  tooltip="Excluir projeto"
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ActionButton = ({ icon: Icon, onClick, title, color, tooltip }) => (
    <button 
      onClick={onClick} 
      className={`p-1.5 rounded-md transition-all active:scale-90 ${color} relative group/btn`}
      title={tooltip || title}
    >
      <Icon size={14} />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/5">
        {title}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-b border-r border-white/5"></div>
      </div>
    </button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
          <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-2xl rounded-[24px] overflow-hidden border border-white/10 shadow-2xl">
            
            <div className="flex-none p-5 pb-3 bg-gradient-to-b from-slate-900 to-transparent border-b border-white/5">
              <div className="flex justify-between items-center mb-4">
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <FolderOpen className="text-cyan-400" size={18}/>
                  </div>
                  <span>Gerenciador de Projetos</span>
                </DialogTitle>
                <button 
                  onClick={onClose} 
                  className="bg-slate-800/50 hover:bg-white/10 p-1.5 rounded-full text-slate-400 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-black/30 p-1 rounded-xl flex mb-4 border border-white/5">
                {['mine', 'shared'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    className={`flex-1 py-2 text-xs uppercase font-bold rounded-lg transition-all relative ${
                      activeTab === tab 
                        ? 'bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-md' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'mine' ? 'Meus Projetos' : 'Compartilhados'}
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full transition-all ${
                      activeTab === tab ? 'bg-cyan-500' : 'bg-transparent'
                    }`}></div>
                  </button>
                ))}
              </div>

              <div className="relative group mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Buscar projetos..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:bg-slate-900 transition-all outline-none placeholder:text-slate-500"
                />
              </div>
              
              {activeTab === 'shared' && (
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Share2 className="absolute left-3 top-2.5 w-4 h-4 text-purple-500" />
                    <input 
                      value={joinId} 
                      onChange={(e) => setJoinId(e.target.value)} 
                      placeholder="Cole o ID do projeto..." 
                      className="w-full bg-purple-500/10 border border-purple-500/20 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-purple-500/50 outline-none placeholder:text-purple-400/50"
                    />
                  </div>
                  <Button 
                    onClick={() => joinId && onJoinProject(joinId)} 
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 h-auto rounded-xl aspect-square p-0 w-10"
                  >
                    <Plus size={18} />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 custom-scrollbar space-y-2">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                  <FolderOpen size={40} className="mb-3 opacity-50" />
                  <p className="text-sm font-medium text-slate-400">Nenhum projeto encontrado</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchTerm ? 'Tente outra busca' : activeTab === 'mine' ? 'Crie seu primeiro projeto!' : 'Nenhum projeto compartilhado'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-slate-500 mb-2 px-1">
                    {displayedProjects.length} projeto{displayedProjects.length !== 1 ? 's' : ''} encontrado{displayedProjects.length !== 1 ? 's' : ''}
                  </div>
                  {displayedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </>
              )}
            </div>

            <div className="flex-none p-3 border-t border-white/5 bg-slate-900/50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>{myProjects.length} meus projetos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span>{sharedProjects.length} compartilhados</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-xs backdrop-blur-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="text-red-400" size={20}/>
              </div>
              <div>
                <AlertDialogTitle className="text-red-400 text-sm font-bold">Excluir Projeto?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400 text-xs">
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="bg-transparent border-slate-700 hover:bg-slate-800 h-9 text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 border-none h-9 text-xs font-bold"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameData} onOpenChange={() => setRenameData(null)}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-xs backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-sm font-bold flex items-center gap-2">
              <Edit3 size={16} />
              Renomear Projeto
            </DialogTitle>
          </DialogHeader>
          <Input 
            value={renameData?.name || ''} 
            onChange={(e) => setRenameData({...renameData, name: e.target.value})} 
            className="bg-slate-950 border-slate-700 text-white h-10 text-sm focus:border-cyan-500"
            autoFocus 
            placeholder="Digite o novo nome"
          />
          <DialogFooter className="gap-2 mt-4">
            <Button 
              variant="ghost" 
              onClick={() => setRenameData(null)} 
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if(renameData) onRenameProject(renameData.id, renameData.name); 
                setRenameData(null);
              }} 
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 h-9 text-xs font-bold"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectManager;