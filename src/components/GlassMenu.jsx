// components/GlassMenu.jsx
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Ruler,
  FolderOpen,
  Share2,
  Camera,
  Upload,
  Download,
  Users,
  Zap,
  Settings
} from 'lucide-react';

const GlassMenu = ({
  onShowTools,
  onShowProjects,
  onShowShare,
  onARMode,
  onImport,
  onExport,
  tracking,
  projectsCount,
  sharedProjectsCount
}) => {
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-3 border border-cyan-500/20 shadow-2xl shadow-cyan-500/10">
        <div className="flex items-center gap-2">
          {/* Botão Ferramentas */}
          <Button
            size="icon"
            onClick={onShowTools}
            className="w-12 h-12 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 transition-all hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/20"
          >
            <Ruler className="w-5 h-5" />
          </Button>

          {/* Botão Projetos */}
          <Button
            size="icon"
            onClick={onShowProjects}
            disabled={tracking}
            className="w-12 h-12 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all hover:scale-110 hover:shadow-lg hover:shadow-blue-500/20 relative"
          >
            <FolderOpen className="w-5 h-5" />
            {projectsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {projectsCount}
              </span>
            )}
          </Button>

          {/* Botão Compartilhar */}
          <Button
            size="icon"
            onClick={onShowShare}
            className="w-12 h-12 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 hover:text-green-300 transition-all hover:scale-110 hover:shadow-lg hover:shadow-green-500/20 relative"
          >
            <Share2 className="w-5 h-5" />
            {sharedProjectsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {sharedProjectsCount}
              </span>
            )}
          </Button>

          {/* Botão AR */}
          <Button
            size="icon"
            onClick={onARMode}
            className="w-12 h-12 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 hover:text-purple-300 transition-all hover:scale-110 hover:shadow-lg hover:shadow-purple-500/20"
          >
            <Camera className="w-5 h-5" />
          </Button>

          {/* Botão Ações Rápidas */}
          <div className="relative group">
            <Button
              size="icon"
              className="w-12 h-12 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 hover:text-orange-300 transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-orange-500/20"
            >
              <Zap className="w-5 h-5" />
            </Button>
            
            {/* Submenu */}
            <div className="absolute bottom-14 left-1/2 transform -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:bottom-16 transition-all duration-300">
              <div className="bg-slate-900/95 backdrop-blur-xl rounded-xl p-2 border border-orange-500/20 shadow-2xl shadow-orange-500/10 space-y-2">
                <Button
                  size="sm"
                  onClick={onImport}
                  className="w-full bg-slate-800/50 hover:bg-slate-700/50 text-white border-0 justify-start"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <Button
                  size="sm"
                  onClick={onExport}
                  className="w-full bg-slate-800/50 hover:bg-slate-700/50 text-white border-0 justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlassMenu;