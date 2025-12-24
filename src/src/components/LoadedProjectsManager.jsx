import React from 'react';
import { Layers, X, MapPin, Info, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const LoadedProjectsManager = ({
  isOpen,
  onClose,
  loadedProjects,
  onRemoveProject,
  onFocusProject, // Nova prop para focar a câmera no projeto
  onShowDetails,
  totalDistanceAll
}) => {
  
  const formatDistance = (meters) => {
    if (!meters) return "0 m";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw] max-w-sm max-h-[80vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="flex flex-col h-full liquid-glass rounded-[32px] overflow-hidden relative shadow-2xl">
          
          {/* Header */}
          <div className="flex-none p-5 pb-3 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  Projetos Ativos
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-1">
                  {loadedProjects.length} camadas visíveis no mapa
                </DialogDescription>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={onClose}
                className="rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                <X size={20} />
              </Button>
            </DialogHeader>
          </div>

          {/* Lista de Projetos */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
            {loadedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <Layers className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">Nenhum projeto carregado</p>
              </div>
            ) : (
              loadedProjects.map((project) => (
                <div 
                  key={project.id}
                  className="group relative bg-slate-900/40 border border-white/5 rounded-2xl p-3 transition-all hover:bg-slate-900/60 hover:border-cyan-500/30 active:scale-[0.98]"
                >
                  {/* Barra de Cor Lateral */}
                  <div 
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full shadow-[0_0_10px_currentColor]"
                    style={{ backgroundColor: project.color || '#fff', color: project.color || '#fff' }}
                  />

                  <div className="pl-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{project.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-white/5">
                            {formatDistance(project.totalDistance || project.total_distance)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {project.points.length} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                      <Button
                        size="sm"
                        onClick={() => onFocusProject(project)}
                        className="flex-1 h-7 text-[10px] bg-cyan-950/30 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg"
                      >
                        <Eye className="w-3 h-3 mr-1.5" /> Focar
                      </Button>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onShowDetails(project)}
                        className="h-7 w-7 text-slate-400 hover:text-white rounded-lg"
                        title="Detalhes"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemoveProject(project.id)}
                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg"
                        title="Remover do Mapa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer - Total Geral */}
          {loadedProjects.length > 0 && (
            <div className="flex-none p-4 bg-slate-900 border-t border-white/10">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total em Tela</span>
                <span className="text-lg font-bold text-cyan-400 font-mono text-shadow-glow">
                  {formatDistance(totalDistanceAll)}
                </span>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoadedProjectsManager;