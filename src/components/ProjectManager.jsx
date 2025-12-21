import React, { useState } from 'react';
import { 
  FolderOpen, Download, Trash2, Play, Users, 
  Copy, Plus, Check, Search, X, FileText, Edit3, 
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

// --- DECORAÇÃO: CHAPÉU DE NATAL (SVG OTIMIZADO) ---
const SantaHat = () => (
  <svg viewBox="0 0 512 512" className="w-8 h-8 absolute -top-3 -right-2 z-20 drop-shadow-lg rotate-12 pointer-events-none filter saturate-150">
    <path d="M407.5 130.6c-4.8-.8-9.8.5-13.8 3.8-30.7 25.1-66.2 43.4-103.9 54.2-22.7 6.5-46.1 9.8-69.7 9.8-30.5 0-60.6-5.5-89.2-16.1-5.6-2.1-11.8-1.5-16.9 1.9-5.1 3.3-8.3 8.7-8.8 14.8-1.3 14.7-3.6 29.3-7.1 43.6l-21.6 86.3h288.5l-19.7-81.1c-1.3-5.3-3.6-10.4-6.9-14.8-16.9-23.9-22.3-64.4-15.1-92.4 1.3-5.1-.2-10.5-3.8-14.4-3.6-3.9-8.8-5.7-14-4.8z" fill="#ef4444"/>
    <path d="M106 359.1l22.2-88.9c3.2-12.9 5.3-26 6.5-39.2 27.5 10.2 56.4 15.5 85.8 15.5 22.2 0 44.2-3.1 65.6-9.2 35.5-10.2 69-27.4 97.9-51.1-5.2 26.9.1 63.8 14.6 85.5 3.5 5.2 6.1 11 7.6 17.1l20.2 83.2H106.8l-.8 7.1h320.6l3.4-13.8-20.2-83.2c-1.6-6.6-4.4-12.7-8.2-18.3-19-28.5-22.4-74.8-11.2-106.8l17.2-49.3c3.4-9.8-1.9-20.5-11.7-23.9-9.8-3.4-20.5 1.9-23.9 11.7l-9.2 26.5c-35.1 27.2-76 46.9-119.2 59.2-24.8 7.1-50.4 10.7-76 10.7-31.1 0-61.9-5.3-91.1-15.8l-1.6 2.3-7.2-2.7c-9.7-3.6-20.4 1.3-24 11s1.3 20.4 11 24l9.7 3.6c-1.5 15.1-3.9 30-7.3 44.8l-22.3 89-3.4 13.8h36.7l-3.3-13.8z" fill="#f1f5f9"/>
    <circle cx="445" cy="69" r="35" fill="#f1f5f9"/>
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
  onOpenReport,   // <--- Função de Relatório (CONFIRMADA)
  onOpenMembers   // <--- Função de Equipe/Hub (CONFIRMADA)
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

  // --- SUB-COMPONENTE DO CARD (DESIGN SÊNIOR) ---
  const ProjectCard = ({ project, index }) => {
    const isMine = project.user_id === currentUserId;
    
    // GRADIENTE RADIAL (Resolve o problema da "sombra quadrada")
    // Cria um brilho suave e redondo atrás do ícone, não uma caixa dura.
    const glowGradient = isMine 
      ? 'radial-gradient(circle at center, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0) 70%)' 
      : 'radial-gradient(circle at center, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0) 70%)';
    
    const iconColor = isMine ? 'text-cyan-400' : 'text-purple-400';
    const borderColor = isMine ? 'group-hover:border-cyan-500/30' : 'group-hover:border-purple-500/30';

    return (
      <div className={`group relative bg-slate-900/40 rounded-2xl p-4 mb-3 transition-all duration-300 border border-white/5 ${borderColor} hover:bg-slate-900/60 hover:shadow-xl`}>
        
        {/* DECORAÇÃO: Chapéu de Natal apenas no primeiro item da lista */}
        {index === 0 && <SantaHat />}

        {/* Highlight de Hover Sutil */}
        <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/[0.02] transition-colors pointer-events-none" />

        <div className="flex justify-between items-start relative z-10 gap-3">
          <div className="flex gap-3 items-center flex-1 min-w-0">
            
            {/* Ícone Container com Glow Radial Perfeito */}
            <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
              <div 
                className="absolute inset-0 w-full h-full" 
                style={{ background: glowGradient }}
              ></div>
              <div className={`relative z-10 bg-slate-950 p-2.5 rounded-xl border border-white/10 ${iconColor} shadow-sm backdrop-blur-md`}>
                {isMine ? <FolderOpen size={20} /> : <Users size={20} />}
              </div>
            </div>

            <div className="flex-1 min-w-0"> 
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate leading-tight group-hover:text-cyan-50 transition-colors" title={project.name}>
                  {project.name}
                </h3>
                {isMine && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setRenameData({ id: project.id, name: project.name }); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-cyan-400 transition-all transform hover:scale-110"
                    title="Renomear Projeto"
                  >
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
              
              {/* Metadados (Data, Distância, Bairro) */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono text-cyan-200/80 bg-cyan-950/30 px-2 py-0.5 rounded-md border border-cyan-500/10 flex items-center gap-1">
                   <MapPin size={8} /> {((project.total_distance || project.totalDistance || 0)/1000).toFixed(2)}km
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar size={8} /> {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Botão Copiar ID */}
          <button 
            onClick={(e) => {
               e.stopPropagation();
               navigator.clipboard.writeText(project.id);
               setCopiedId(project.id);
               setTimeout(() => setCopiedId(null), 2000);
            }}
            className="p-2 rounded-full hover:bg-white/5 text-slate-600 hover:text-white transition-colors"
            title="Copiar ID para Compartilhar"
          >
            {copiedId === project.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>

        {/* --- BARRA DE AÇÕES (TOOLBAR) --- */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5">
          
          {/* Botão Principal: CARREGAR */}
          <Button 
            onClick={() => onLoadProject(project)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-wide border-0 shadow-lg active:scale-95 transition-all ${
              isMine 
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:shadow-cyan-500/20 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:shadow-purple-500/20 text-white'
            }`}
          >
            <Play size={12} className="mr-2 fill-current" /> Abrir
          </Button>
          
          {/* Barra de Ferramentas Secundária */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-white/5 backdrop-blur-sm">
            
            {/* 1. HUB / EQUIPE (Activity Icon) */}
            <ActionButton 
                icon={Activity} 
                onClick={() => onOpenMembers(project)} 
                title="Gestão de Equipe & Hub" 
                color="text-slate-400 hover:text-purple-400 hover:bg-purple-500/10" 
            />
            
            <div className="w-px bg-white/10 my-1 mx-0.5"></div>
            
            {/* 2. RELATÓRIO (ClipboardList Icon) */}
            <ActionButton 
                icon={ClipboardList} 
                onClick={() => onOpenReport(project)} 
                title="Gerar Relatório Técnico" 
                color="text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10" 
            />
            
            <div className="w-px bg-white/10 my-1 mx-0.5"></div>
            
            {/* 3. EXPORTAR (Download Icon) */}
            <ActionButton 
                icon={Download} 
                onClick={() => onExportProject(project)} 
                title="Exportar KML/KMZ" 
                color="text-slate-400 hover:text-green-400 hover:bg-green-500/10" 
            />

            {/* 4. EXCLUIR (Lixeira - Apenas Dono) */}
            {isMine && (
              <>
                <div className="w-px bg-white/10 my-1 mx-0.5"></div>
                <ActionButton 
                    icon={Trash2} 
                    onClick={() => setProjectToDelete(project)} 
                    title="Excluir Projeto" 
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
      className={`p-1.5 rounded-md transition-all active:scale-90 ${color}`}
      title={title}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <>
      {/* DIALOG PRINCIPAL */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md h-[85vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
          
          <div className="flex flex-col h-full bg-slate-950/90 backdrop-blur-2xl rounded-[32px] overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5">
            
            {/* Header Fixo */}
            <div className="flex-none p-6 pb-2 bg-gradient-to-b from-slate-900 to-slate-950/0">
              <div className="flex justify-between items-center mb-6">
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                     <FolderOpen className="text-cyan-400" size={18}/> 
                   </div>
                   Gerenciador
                </DialogTitle>
                <button onClick={onClose} className="bg-slate-800/50 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Tabs Modernas */}
              <div className="bg-black/40 p-1 rounded-xl flex mb-4 border border-white/5 shadow-inner">
                {['mine', 'shared'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                      activeTab === tab 
                      ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10 translate-y-0' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {tab === 'mine' ? 'MEUS PROJETOS' : 'COMPARTILHADOS'}
                  </button>
                ))}
              </div>

              {/* Barra de Busca / Join Input */}
              <div className="relative animate-in fade-in duration-300">
                {activeTab === 'mine' ? (
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Filtrar projetos..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:bg-slate-900/80 transition-all placeholder:text-slate-600 outline-none"
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
            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-1 pb-20 scroll-smooth">
              {displayedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
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
            
            {/* Gradiente de fundo no final da lista */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none"></div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* ALERT DE SEGURANÇA (EXCLUIR) */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-xs shadow-2xl">
            <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-3 text-lg">
                <div className="p-2 bg-red-500/10 rounded-full"><AlertTriangle size={20}/></div>
                Excluir Projeto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 mt-2">
                Você está prestes a apagar <b>{projectToDelete?.name}</b> permanentemente. <br/><br/>
                Isso não pode ser desfeito.
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

      {/* DIALOG DE RENOMEAR */}
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