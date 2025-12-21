import React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl'
import {
  Upload,
  MapPin,
  Ruler,
  X,
  Download,
  Share2,
  Edit2,
  Menu,
  LogOut,
  Heart,
  MapPinned,
  Layers,
  Play,
  Pause,
  Square,
  FolderOpen,
  Save,
  Navigation,
  Clock,
  Cloud,
  CloudOff,
  Archive,
  Camera,
  Plus,
  Star,
  LocateFixed,
  Info,
  Undo,
  FileText,
  MousePointerClick,
  CheckCircle,
  Users,
  Hash,
  ArrowRight,
  Trash2,
  Globe,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import GlowNotification from './components/GlowNotification';
import ToolsDock from './components/ToolsDock';
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import LoadedProjectsManager from './components/LoadedProjectsManager';
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import ProjectManager from './components/ProjectManager';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { supabase } from './lib/supabase'
import electricPoleIcon from './assets/electric-pole.png';
import Auth from './components/Auth'
import SpanSelector, { SPAN_COLORS } from './components/SpanSelector';
import JSZip from 'jszip'
import { Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'
import { Capacitor } from '@capacitor/core'
import axios from 'axios'
import ARCamera from './components/ARCamera'
import ResumoProjeto from './components/ResumoProjeto'
import ControlesRastreamento from './components/ControlesRastreamento'
import ModernPopup from './components/ModernPopup'
import ImportProgressPopup from './components/ImportProgressPopup'
import MultipleSelectionPopup from './components/MultipleSelectionPopup'
import BairroDetectionService from './components/BairroDetectionService'
import ProjectLockService from './services/ProjectLockService'
import { useProjects } from './hooks/useProjects';

// 1. NOVOS IMPORTS (UTILITÁRIOS E SERVIÇOS)
import {
  calculateDistance,
  generateUUID,
  generateRandomColor,
  safeToFixed,
  formatDistanceDetailed,
  calculateTotalProjectDistance,
  KalmanFilter,
  RoadSnappingService
} from './utils/geoUtils';
import { RoutingService } from './services/RoutingService';

// 2. NOVOS COMPONENTES VISUAIS
import MapControls from './components/MapControls';
import ProjectMembersDialog from './components/ProjectMembersDialog';

import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import ProjectReport from './components/ProjectReport';

const DEFAULT_BAIRROS = [
  'Ponta Verde',
  'Pajuçara',
  'Jatiúca',
  'Mangabeiras',
  'Farol',
  'Prado',
  'Centro',
  'Jaraguá',
  'Poço',
  'Levada'
]

const mapStyles = {
  streets: { name: 'Ruas', url: 'mapbox://styles/mapbox/streets-v11' },
  satellite: { name: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v11' },
  dark: { name: 'Escuro', url: 'mapbox://styles/mapbox/dark-v10' },
};

// Função para garantir lista única (remove duplicatas por ID)
const deduplicateProjects = (projectsList) => {
  const uniqueMap = new Map();
  projectsList.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  
  projectsList.forEach(p => {
    if (!uniqueMap.has(p.id)) {
      uniqueMap.set(p.id, p);
    }
  });
  return Array.from(uniqueMap.values());
};

const isValidProject = (project) => {
  try {
    return project &&
      project.id &&
      project.name &&
      typeof project.name === 'string' &&
      project.name.trim().length > 0 &&
      Array.isArray(project.points) &&
      project.points.length > 0 &&
      project.points.every(point =>
        point &&
        typeof point.lat === 'number' &&
        !isNaN(point.lat) &&
        typeof point.lng === 'number' &&
        !isNaN(point.lng) &&
        point.lat >= -90 && point.lat <= 90 &&
        point.lng >= -180 && point.lng <= 180
      );
  } catch (error) {
    console.warn('Projeto inválido detectado:', project, error);
    return false;
  }
};

const getUniqueProjectName = (baseName, existingProjects) => {
  let newName = baseName;
  let counter = 1;
  
  while (existingProjects.some(project => project.name === newName)) {
    newName = `${baseName} (${counter})`;
    counter++;
  }
  
  return newName;
};

const calculateTotalDistanceAllProjects = (projects) => {
  if (!projects || projects.length === 0) return 0;
  
  let total = 0;
  projects.forEach(project => {
    total += project.totalDistance || project.total_distance || 0;
  });
  
  return total;
};

// Funções de localStorage
const storage = {
  // Projetos
  saveProjects: (userId, projects) => {
    localStorage.setItem(`jamaaw_projects_${userId}`, JSON.stringify(projects));
  },
  loadProjects: (userId) => {
    const data = localStorage.getItem(`jamaaw_projects_${userId}`);
    return data ? JSON.parse(data) : [];
  },
  
  // Bairros
  saveBairros: (bairros) => {
    localStorage.setItem('jamaaw_bairros', JSON.stringify(bairros));
  },
  loadBairros: () => {
    const data = localStorage.getItem('jamaaw_bairros');
    return data ? JSON.parse(data) : null;
  },
  
  // Favoritos
  saveFavorites: (userId, favorites) => {
    localStorage.setItem(`jamaaw_favorites_${userId}`, JSON.stringify(favorites));
  },
  loadFavorites: (userId) => {
    const data = localStorage.getItem(`jamaaw_favorites_${userId}`);
    return data ? JSON.parse(data) : null;
  },
  
  // Marcadores
  saveMarkers: (userId, markers) => {
    localStorage.setItem(`jamaaw_markers_${userId}`, JSON.stringify(markers));
  },
  loadMarkers: (userId) => {
    const data = localStorage.getItem(`jamaaw_markers_${userId}`);
    return data ? JSON.parse(data) : null;
  },
  
  // Remover projeto
  deleteProject: (userId, projectId) => {
    const projects = storage.loadProjects(userId);
    const updatedProjects = projects.filter(p => p.id !== projectId);
    storage.saveProjects(userId, updatedProjects);
  },
  
  // Limpar dados do usuário
  clearUserData: (userId) => {
    localStorage.removeItem(`jamaaw_projects_${userId}`);
    localStorage.removeItem(`jamaaw_favorites_${userId}`);
    localStorage.removeItem(`jamaaw_markers_${userId}`);
  },
};

// Componente Memoizado do Poste
const PoleMarker = React.memo(({ point, index, color, onClick, isActive }) => {
  return (
    <Marker 
      longitude={point.lng} 
      latitude={point.lat}
      anchor="bottom"
      onClick={onClick}
    >
      <div className="pole-marker-container" style={{ willChange: 'transform' }}>
        <img 
          src={electricPoleIcon} 
          alt={`Ponto ${index}`} 
          className="pole-image"
          loading="lazy"
          style={{ pointerEvents: 'none' }}
        />
        
        <div 
          className={`pole-number-plate ${isActive ? 'pole-active' : ''}`}
          style={{ 
            borderColor: color, 
            color: color
          }}
        >
          {index}
        </div>
      </div>
    </Marker>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.point.id === nextProps.point.id &&
    prevProps.color === nextProps.color &&
    prevProps.isActive === nextProps.isActive
  );
});

// Componente do Card do Projeto
const ProjectCard = React.memo(({ project, isSelected, onToggle, onLoad, onEdit, onExport, onDelete, tracking }) => {
  const distance = safeToFixed(((project.totalDistance || project.total_distance) || 0) / 1000, 2);
  const date = new Date(project.created_at || project.createdAt || Date.now()).toLocaleDateString('pt-BR');
  
  return (
    <div className={`modern-project-card ${isSelected ? 'selected' : ''}`}>
      <div className="card-header-row">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(project)}
          className="mt-1 w-4 h-4 text-cyan-500 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm leading-tight truncate mb-1" title={project.name}>
            {project.name}
          </h3>
          <p className="text-[10px] text-slate-500">
            Criado em {date}
          </p>
        </div>
      </div>

      <div className="card-stats-row">
        <span className="stat-pill distance" title="Distância Total">
          {distance} km
        </span>
        <span className="stat-pill points" title="Quantidade de Pontos">
          {project.points.length} pts
        </span>
        <span className="stat-pill bairro" title="Bairro">
          {project.bairro || 'Vários'}
        </span>
      </div>

      <div className="card-actions-footer">
        <Button
          size="sm"
          onClick={() => {
            if (tracking) {
              showFeedback('Erro', 'Pare o rastreamento atual primeiro.', 'error');
              return;
            }
            onLoad(project);
          }}
          disabled={tracking}
          className="flex-1 action-btn-mini bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 border-0"
        >
          <Play className="w-3 h-3 mr-1.5 fill-current" />
          Carregar
        </Button>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
            className="action-btn-mini w-8 px-0 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onExport(project)}
            className="action-btn-mini w-8 px-0 text-green-400 hover:bg-green-500/10 hover:text-green-300"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(project.id)}
            className="action-btn-mini w-8 px-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.name === nextProps.project.name &&
    prevProps.tracking === nextProps.tracking
  );
});

// Sub-componente para o conteúdo do popup de ponto de rastreamento
const TrackingPointPopupContent = ({ pointInfo, onClose, onSelectStart, selectedStartPoint, manualPoints }) => {
  const cardRef = useRef(null);
  
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };
  
  const pointIndex = manualPoints.findIndex(p => p.id === pointInfo.point.id) + 1;
  
  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="group relative rounded-2xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl w-[280px]"
      style={{
        '--mouse-x': '50%',
        '--mouse-y': '50%',
      }}
    >
      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.15), transparent 40%)`,
        }}
      />

      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.6), transparent 40%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          WebkitMaskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1.5px'
        }}
      />

      <div className="relative p-4 bg-slate-900/80 backdrop-blur-xl h-full rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <span className="text-cyan-400 font-bold text-sm">{pointIndex}</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm leading-none">
                Ponto de Rastreio
              </h3>
              <p className="text-[10px] text-cyan-400/80 font-mono mt-0.5">
                ID: {pointInfo.point.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 flex flex-col">
            <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Latitude
            </span>
            <span className="font-mono text-xs text-cyan-50 font-medium truncate">
              {pointInfo.point.lat?.toFixed(6)}
            </span>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 flex flex-col">
            <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Longitude
            </span>
            <span className="font-mono text-xs text-cyan-50 font-medium truncate">
              {pointInfo.point.lng?.toFixed(6)}
            </span>
          </div>
        </div>

        <Button
          onClick={() => {
            onSelectStart(pointInfo.point);
            onClose();
          }}
          className={`w-full h-10 text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
            selectedStartPoint && selectedStartPoint.id === pointInfo.point.id
            ? 'bg-green-500/20 border-green-500/50 text-green-400 cursor-default shadow-[0_0_15px_rgba(34,197,94,0.15)]'
            : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
          }`}
          disabled={selectedStartPoint && selectedStartPoint.id === pointInfo.point.id}
        >
          {selectedStartPoint && selectedStartPoint.id === pointInfo.point.id ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" /> Ponto Inicial Atual
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 mr-2 fill-current" /> Usar como Início
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

function App() {
  
  const mapboxToken = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';
  const mapRef = useRef();
  const fileInputRef = useRef(null);
  const projectInputRef = useRef(null);
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [markers, setMarkers] = useState([])
  const [filteredMarkers, setFilteredMarkers] = useState([])
  const [selectedBairro, setSelectedBairro] = useState('todos')
  const [editingMarker, setEditingMarker] = useState(null)
  const [popupInfo, setPopupInfo] = useState(null);
  const [selectedForDistance, setSelectedForDistance] = useState([])
  const [distanceResult, setDistanceResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bairros, setBairros] = useState(DEFAULT_BAIRROS)
  const [showAddBairro, setShowAddBairro] = useState(false)
  const [showBairroManager, setShowBairroManager] = useState(false)
  const [newBairro, setNewBairro] = useState('')
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [spanSelectorInfo, setSpanSelectorInfo] = useState(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncPending, setSyncPending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showTrackingControls, setShowTrackingControls] = useState(false);
  const [positionHistory, setPositionHistory] = useState([]);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [speed, setSpeed] = useState(0);
  
  const [tracking, setTracking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [manualPoints, setManualPoints] = useState([])
  const [totalDistance, setTotalDistance] = useState(0)
  const [currentProject, setCurrentProject] = useState(null)
  
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [showProjectsList, setShowProjectsList] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [showRulerPopup, setShowRulerPopup] = useState(false)
  const [editingProject, setEditingProject] = useState(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [newMarkerData, setNewMarkerData] = useState(null);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [snappingPoints, setSnappingPoints] = useState([]);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [mapStyle, setMapStyle] = useState('satellite');
  
  const [loadedProjects, setLoadedProjects] = useState([]);
  const [showLoadedProjects, setShowLoadedProjects] = useState(false);
  const [pointPopupInfo, setPointPopupInfo] = useState(null);
  
  const [notification, setNotification] = useState(null);
  
  const [popupMarker, setPopupMarker] = useState(null);
  const [adjustBoundsForMarkers, setAdjustBoundsForMarkers] = useState(false);
  const [adjustBoundsForProject, setAdjustBoundsForProject] = useState(false);
  const [backupStatus, setBackupStatus] = useState('idle');
  const [arMode, setArMode] = useState(false);
  const [arPermission, setArPermission] = useState(null);
  
  const [importProgress, setImportProgress] = useState(0);
  const [showImportProgress, setShowImportProgress] = useState(false);
 
const [inspectingProject, setInspectingProject] = useState(null);
  const [importCurrentStep, setImportCurrentStep] = useState(1);
  const [importTotalSteps, setImportTotalSteps] = useState(5);
  const [importCurrentAction, setImportCurrentAction] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState(null);
  
  // REMOVIDO: const [selectedMarkers, setSelectedMarkers] = useState([]);
  
  const [selectedProjects, setSelectedProjects] = useState([]);
  // REMOVIDO: const [showMultipleSelection, setShowMultipleSelection] = useState(false);
  
  const [selectedStartPoint, setSelectedStartPoint] = useState(null);
  
  const [mapScreenshot, setMapScreenshot] = useState(null);
  
  const [reportData, setReportData] = useState(null);
  
  const [trackingInputMode, setTrackingInputMode] = useState('gps');
  
  const [projectLock, setProjectLock] = useState(null);
  
  // NOVOS STATES
  const [extraConnections, setExtraConnections] = useState([]);
  
  // 4. NOVO STATE PARA GESTÃO DE MEMBROS
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  
  // ... outros hooks ...
  const {
    projects,
    setProjects,
    loadProjects,
    renameProject,
    deleteProject
  } = useProjects(user, isOnline);
  // ...
  
  const kalmanLatRef = useRef(new KalmanFilter(0.1, 0.1));
  const kalmanLngRef = useRef(new KalmanFilter(0.1, 0.1));
  
  const totalDistanceAllProjects = calculateTotalDistanceAllProjects(projects);
  
  // Função auxiliar para mostrar feedback
  const showFeedback = (title, message, type = 'success') => {
    setNotification({ title, message, type });
  };
  
  // Função para atualizar ponto do projeto
  const handleUpdateProjectPoint = async (updatedPoint) => {
    const projectId = pointPopupInfo?.projectId;
    const projectToUpdate = loadedProjects.find(p => p.id === projectId) || currentProject;
    
    if (!projectToUpdate) {
      console.error("Projeto não encontrado para atualização do ponto");
      return;
    }
    
    const updatedPoints = projectToUpdate.points.map(p =>
      p.id === updatedPoint.id ? updatedPoint : p
    );
    
    const updatedProject = { ...projectToUpdate, points: updatedPoints };
    
    setLoadedProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
    if (currentProject && currentProject.id === projectId) {
      setCurrentProject(updatedProject);
      setManualPoints(updatedPoints);
    }
    
    setPointPopupInfo(prev => ({ ...prev, point: updatedPoint }));
    
    if (isOnline && user && !projectId.toString().startsWith('offline_')) {
      try {
        const { error } = await supabase
          .from('projetos')
          .update({
            points: updatedPoints,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);
        
        if (error) throw error;
        console.log("Foto salva no projeto com sucesso!");
      } catch (err) {
        console.error("Erro ao salvar foto no projeto:", err);
        showFeedback("Erro", "Erro ao salvar foto na nuvem", "error");
      }
    } else {
      // Salva localmente no localStorage
      const userProjects = storage.loadProjects(user?.id);
      const updatedUserProjects = userProjects.map(p =>
        p.id === updatedProject.id ? updatedProject : p
      );
      storage.saveProjects(user?.id, updatedUserProjects);
      showFeedback("Salvo", "Foto salva localmente (Offline)", "warning");
    }
  };
  
  // Função para capturar imagem do mapa
  const getMapImage = () => {
    if (mapRef.current) {
      try {
        const mapCanvas = mapRef.current.getCanvas();
        return mapCanvas.toDataURL('image/png');
      } catch (e) {
        console.error("Erro ao capturar imagem do mapa:", e);
        return null;
      }
    }
    return null;
  };
  
  // GeoJSON para marcadores
  const markersGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: filteredMarkers.map(marker => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [marker.lng, marker.lat] },
      properties: {
        id: marker.id,
        name: marker.name,
        bairro: marker.bairro,
        descricao: marker.descricao,
        color: marker.color || '#ef4444'
      }
    }))
  }), [filteredMarkers]);
  
  // Efeito para manter o lock ativo
  useEffect(() => {
    let interval;
    if (tracking && currentProject && isOnline && user) {
      interval = setInterval(async () => {
        const success = await ProjectLockService.heartbeat(currentProject.id, user.id);
        if (!success) {
          showFeedback('Atenção', 'Perda de conexão com o servidor de bloqueio.', 'warning');
        }
      }, 120000);
    }
    return () => clearInterval(interval);
  }, [tracking, currentProject, isOnline, user]);
  
  // Carregar projetos do Supabase
  
  
  // Atualizar bairros dos projetos
  const refreshProjectNeighborhoods = async () => {
    if (!projects || projects.length === 0) return;
    
    const projectsToUpdate = projects.filter(p =>
      (!p.bairro || p.bairro === 'Vários') &&
      p.points &&
      p.points.length > 0
    );
    
    if (projectsToUpdate.length === 0) return;
    
    console.log(`Detectando bairros para ${projectsToUpdate.length} projetos...`);
    
    let updatedProjectsList = [...projects];
    let hasUpdates = false;
    
    for (const project of projectsToUpdate) {
      try {
        const detectedBairro = await BairroDetectionService.detectBairroForProject(project.points);
        
        if (detectedBairro && detectedBairro !== 'Vários') {
          updatedProjectsList = updatedProjectsList.map(p =>
            p.id === project.id ? { ...p, bairro: detectedBairro } : p
          );
          
          if (isOnline && user && !project.id.toString().startsWith('offline_')) {
            await supabase
              .from('projetos')
              .update({ bairro: detectedBairro })
              .eq('id', project.id);
          }
          
          hasUpdates = true;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Erro ao detectar bairro para projeto ${project.name}:`, error);
      }
    }
    
    if (hasUpdates) {
      setProjects(updatedProjectsList);
      // Atualizar localStorage
      const userProjects = storage.loadProjects(user?.id);
      const mergedProjects = [...userProjects, ...updatedProjectsList];
      const uniqueProjects = deduplicateProjects(mergedProjects);
      storage.saveProjects(user?.id, uniqueProjects);
      console.log('Lista de projetos atualizada com novos bairros.');
    }
  };
  
  // Efeito de Realtime para projeto atual
  useEffect(() => {
    if (!currentProject?.id || !isOnline) return;
    
    console.log(`📡 Conectando Realtime para projeto: ${currentProject.id}`);
    
    const channel = supabase
      .channel(`project-tracking-${currentProject.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projetos',
          filter: `id=eq.${currentProject.id}`
        },
        (payload) => {
          console.log("⚡ Atualização Realtime recebida:", payload);
          const updatedProject = payload.new;
          
          setCurrentProject(prev => ({ ...prev, ...updatedProject }));
          
          if (updatedProject.points) {
            setManualPoints(updatedProject.points);
            setTotalDistance(updatedProject.total_distance);
          }
          
          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        }
      )
      .subscribe();
    
    return () => {
      console.log(`🔌 Desconectando Realtime do projeto: ${currentProject.id}`);
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, isOnline]);
  
  useEffect(() => {
    if (showProjectsList) {
      refreshProjectNeighborhoods();
    }
  }, [showProjectsList]);
  
  const selectPointAsStart = (point) => {
    setSelectedStartPoint(point);
    showFeedback('Sucesso', 'Ponto selecionado como novo início! Novos pontos serão conectados a partir daqui.', 'success');
  };
  
  const resetStartPoint = () => {
    setSelectedStartPoint(null);
  };
  
  const deleteMultipleProjects = async () => {
    if (selectedProjects.length === 0) {
      showFeedback('Erro', 'Nenhum projeto selecionado para excluir.', 'error');
      return;
    }
    
    const projectNames = selectedProjects.map(p => p.name).join(', ');
    if (!confirm(`Tem certeza que deseja excluir ${selectedProjects.length} projeto(s) selecionado(s)?\n\n${projectNames}`)) {
      return;
    }
    
    try {
      const deletedIds = [];
      
      for (const project of selectedProjects) {
        if (isOnline && user && !project.id.toString().startsWith('offline_')) {
          const success = await deleteProjectFromSupabase(project.id);
          if (!success) {
            console.warn(`Falha ao deletar projeto ${project.name} do Supabase`);
          }
        }
        deletedIds.push(project.id);
      }
      
      const updatedProjects = projects.filter(p => !deletedIds.includes(p.id));
      setProjects(updatedProjects);
      
      // Atualizar no localStorage
      const userProjects = storage.loadProjects(user?.id);
      const updatedUserProjects = userProjects.filter(p => !deletedIds.includes(p.id));
      storage.saveProjects(user?.id, updatedUserProjects);
      
      setLoadedProjects(prev => prev.filter(p => !deletedIds.includes(p.id)));
      
      if (currentProject && deletedIds.includes(currentProject.id)) {
        setCurrentProject(null);
        setManualPoints([]);
        setTotalDistance(0);
        setSelectedStartPoint(null);
      }
      
      setSelectedProjects([]);
      
      showFeedback(
        'Sucesso',
        `${selectedProjects.length} projeto(s) excluído(s) com sucesso!`,
        'success'
      );
      
    } catch (error) {
      console.error('Erro ao excluir múltiplos projetos:', error);
      showFeedback('Erro', 'Erro ao excluir projetos. Tente novamente.', 'error');
    }
  };
  
  const handleLogout = async () => {
    try {
      if (currentProject && isOnline && user) {
        await ProjectLockService.releaseLock(currentProject.id, user.id);
      }
      
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      if (user) {
        storage.clearUserData(user.id);
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro no logout:', error);
      }
      
      setUser(null);
      setMarkers([]);
      setFilteredMarkers([]);
      setPopupInfo(null);
      setLoadedProjects([]);
      setProjects([]);
      setManualPoints([]);
      setCurrentProject(null);
      setSelectedStartPoint(null);
      
    } catch (error) {
      console.error('Erro durante logout:', error);
      setUser(null);
      setMarkers([]);
      setProjects([]);
      setSelectedStartPoint(null);
    }
  };
  
  const canLoadProjects = () => {
    return !tracking && manualPoints.length === 0;
  };
  
  const updateImportProgress = (progress, step, action) => {
    setImportProgress(progress);
    setImportCurrentStep(step);
    setImportCurrentAction(action);
  };
  
  // Efeito de Realtime OTIMIZADO
  useEffect(() => {
    if (!currentProject?.id || !isOnline) return;
    
    console.log(`📡 Conectando Realtime para projeto: ${currentProject.id}`);
    
    const channel = supabase
      .channel(`project-tracking-${currentProject.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projetos',
          filter: `id=eq.${currentProject.id}`
        },
        (payload) => {
          console.log("⚡ Atualização Realtime recebida:", payload);
          const updatedProject = payload.new;
          
          setCurrentProject(prev => ({ ...prev, ...updatedProject }));
          
          if (updatedProject.points) {
            setManualPoints(updatedProject.points);
            setTotalDistance(updatedProject.total_distance);
          }
          
          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        }
      )
      .subscribe();
    
    return () => {
      console.log(`🔌 Desconectando Realtime do projeto: ${currentProject.id}`);
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, isOnline]);
  
  // Importar arquivos KML/KMZ
  const handleProjectImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImportProgress(0);
    setImportCurrentStep(1);
    setImportTotalSteps(5);
    setImportCurrentAction('Iniciando importação...');
    setImportSuccess(false);
    setImportError(null);
    setShowImportProgress(true);
    
    try {
      setUploading(true);
      
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.kml') && !fileName.endsWith('.kmz')) {
        throw new Error('Por favor, selecione um arquivo KML ou KMZ válido.');
      }
      
      updateImportProgress(10, 1, 'Lendo arquivo...');
      
      let kmlText;
      
      if (fileName.endsWith('.kmz')) {
        updateImportProgress(20, 2, 'Extraindo KML do arquivo KMZ...');
        
        const zip = new(JSZip.default || JSZip)();
        const contents = await zip.loadAsync(file);
        const kmlFile = Object.keys(contents.files).find(name => name.toLowerCase().endsWith('.kml'));
        if (!kmlFile) {
          throw new Error('Arquivo KML não encontrado no KMZ');
        }
        kmlText = await contents.files[kmlFile].async('text');
      } else {
        updateImportProgress(30, 2, 'Lendo arquivo KML...');
        kmlText = await file.text();
      }
      
      updateImportProgress(50, 3, 'Analisando estrutura do KML...');
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        throw new Error('Arquivo KML inválido ou malformado');
      }
      
      const nameElement = xmlDoc.getElementsByTagName('name')[0];
      let projectName = nameElement?.textContent || `Projeto Importado ${new Date().toLocaleDateString('pt-BR')}`;
      
      updateImportProgress(60, 4, 'Verificando nome do projeto...');
      const existingProject = projects.find(p => p.name === projectName);
      let shouldOverwrite = false;
      
      if (existingProject) {
        setImportCurrentAction('Projeto com nome duplicado encontrado...');
        await new Promise(resolve => setTimeout(resolve, 100));
        shouldOverwrite = window.confirm(`Já existe um projeto com o nome "${projectName}". Deseja sobrescrever?`);
        
        if (!shouldOverwrite) {
          const newName = prompt('Digite um novo nome para o projeto:', `${projectName} (Cópia)`);
          if (newName && newName.trim()) {
            projectName = newName.trim();
          } else {
            throw new Error('Operação cancelada pelo usuário.');
          }
        }
      }
      
      updateImportProgress(70, 4, 'Extraindo pontos geográficos...');
      
      const points = [];
      const lineStrings = xmlDoc.getElementsByTagName('LineString');
      if (lineStrings.length > 0) {
        for (let i = 0; i < lineStrings.length; i++) {
          const coordinates = lineStrings[i].getElementsByTagName('coordinates')[0]?.textContent;
          if (coordinates) {
            const coordList = coordinates.trim().split(/\s+/);
            coordList.forEach(coord => {
              const [lng, lat] = coord.split(',').map(Number);
              if (!isNaN(lat) && !isNaN(lng)) {
                points.push({
                  lat,
                  lng,
                  id: generateUUID(),
                  timestamp: Date.now()
                });
              }
            });
          }
        }
      }
      
      if (points.length === 0) {
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        for (let i = 0; i < placemarks.length; i++) {
          const coordinates = placemarks[i].getElementsByTagName('coordinates')[0]?.textContent;
          if (coordinates) {
            const [lng, lat] = coordinates.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              points.push({ lat, lng, id: generateUUID(), timestamp: Date.now() });
            }
          }
        }
      }
      
      if (points.length === 0) {
        throw new Error('Nenhum ponto válido encontrado no arquivo KML');
      }
      
      updateImportProgress(90, 5, 'Finalizando importação...');
      
      const totalDistanceVal = calculateTotalProjectDistance(points, extraConnections);
      
      const project = {
        id: existingProject && shouldOverwrite ? existingProject.id : generateUUID(),
        name: projectName,
        points: points,
        extra_connections: extraConnections,
        total_distance: totalDistanceVal,
        totalDistance: totalDistanceVal,
        bairro: 'Importado',
        tracking_mode: 'manual',
        created_at: new Date().toISOString(),
        user_id: user?.id
      };
      
      if (isOnline && user) {
        if (existingProject && shouldOverwrite) {
          await supabase.from('projetos').update(project).eq('id', project.id);
        } else {
          await supabase.from('projetos').insert([project]);
        }
        
        await loadProjects();
      } else {
        let updatedProjects;
        if (existingProject && shouldOverwrite) {
          updatedProjects = projects.map(p => p.id === existingProject.id ? project : p);
        } else {
          updatedProjects = [...projects, project];
        }
        setProjects(updatedProjects);
        const userProjects = storage.loadProjects(user?.id);
        const mergedProjects = [...userProjects, project];
        const uniqueProjects = deduplicateProjects(mergedProjects);
        storage.saveProjects(user?.id, uniqueProjects);
      }
      
      updateImportProgress(100, 5, 'Importação concluída!');
      setImportSuccess(true);
      
      setTimeout(() => {
        loadProject(project);
        setShowImportProgress(false);
      }, 1500);
      
    } catch (error) {
      console.error('Erro ao importar projeto KML:', error);
      setImportError(error.message);
      setImportProgress(100);
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };
  
  const focusOnProject = (project) => {
    if (!project || !project.points || project.points.length === 0) {
      setShowLoadedProjects(false);
      return;
    }
    
    const firstPoint = project.points[0];
    
    setShowLoadedProjects(false);
    
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [firstPoint.lng, firstPoint.lat],
        zoom: 16,
        speed: 1.5,
        essential: true
      });
    }
  };
  
  const saveProject = async (autoSave = false, pointsToSave = manualPoints) => {
    try {
      let finalPoints = pointsToSave;
      
      if (editingProject && finalPoints.length === 0) {
        finalPoints = editingProject.points;
      }
      
      if (!finalPoints || finalPoints.length === 0) {
        if (!autoSave) showFeedback('Erro', 'Não há pontos para salvar.', 'error');
        return;
      }
      
      if (!projectName.trim() && !autoSave && !editingProject && !currentProject) {
        showFeedback('Erro', 'Digite um nome para o projeto.', 'error');
        return;
      }
      
      let projectNameToUse = projectName;
      if (editingProject && !projectName.trim()) projectNameToUse = editingProject.name;
      else if (currentProject && !projectName.trim()) projectNameToUse = currentProject.name;
      else if (autoSave && !projectName.trim()) projectNameToUse = `Rastreamento ${new Date().toLocaleString('pt-BR')}`;
      
      const sanitizedPoints = finalPoints.map(p => ({
        ...p,
        id: (p.id && typeof p.id === 'string') ? p.id : generateUUID(),
        connectedFrom: (p.connectedFrom && typeof p.connectedFrom === 'string') ? p.connectedFrom : null
      }));
      
      const calculatedTotalDistance = calculateTotalProjectDistance(sanitizedPoints, extraConnections);
      
      const nowISO = new Date().toISOString();
      
      const projectData = {
        name: projectNameToUse.trim(),
        points: sanitizedPoints,
        extra_connections: extraConnections,
        total_distance: calculatedTotalDistance,
        bairro: selectedBairro !== 'todos' ? selectedBairro : 'Vários',
        tracking_mode: 'manual',
        updated_at: nowISO
      };
      
      let savedProject;
      
      if (editingProject) {
        if (isOnline && user) {
          const { data, error } = await supabase.from('projetos').update(projectData).eq('id', editingProject.id).select();
          if (error) throw error;
          savedProject = data[0];
        } else {
          savedProject = { ...editingProject, ...projectData };
        }
        setProjects(prev => prev.map(p => p.id === editingProject.id ? savedProject : p));
        setEditingProject(null);
        
      } else if (currentProject) {
        if (isOnline && user) {
          const { data, error } = await supabase.from('projetos').update(projectData).eq('id', currentProject.id).select();
          if (error) throw error;
          savedProject = data[0];
        } else {
          savedProject = { ...currentProject, ...projectData };
        }
        setProjects(prev => prev.map(p => p.id === currentProject.id ? savedProject : p));
        setCurrentProject(savedProject);
        
      } else {
        if (isOnline && user) {
          const { data, error } = await supabase.from('projetos').insert([{ ...projectData, user_id: user.id }]).select();
          if (error) throw error;
          savedProject = data[0];
        } else {
          savedProject = {
            ...projectData,
            id: `offline_${Date.now()}`,
            created_at: nowISO,
            user_id: user?.id || 'offline'
          };
        }
        setProjects(prev => [...prev, savedProject]);
      }
      
      const userProjects = storage.loadProjects(user?.id);
      const otherProjects = userProjects.filter(p => p.id !== savedProject.id);
      storage.saveProjects(user?.id, [...otherProjects, savedProject]);
      
      if (!autoSave && currentProject && isOnline && user) {
        try {
          if (ProjectLockService && typeof ProjectLockService.releaseLock === 'function') {
            await ProjectLockService.releaseLock(currentProject.id, user.id);
          }
        } catch (lockError) {
          console.warn("Erro ao liberar lock (não crítico):", lockError);
        }
      }
      
      if (!autoSave) {
        setProjectName('');
        setShowProjectDialog(false);
        if (!editingProject) {
          setTracking(false);
          setPaused(false);
          setShowTrackingControls(false);
          setManualPoints([]);
          setTotalDistance(0);
          setSelectedStartPoint(null);
        }
        showFeedback('Sucesso', 'Projeto salvo com sucesso!', 'success');
      }
      
    } catch (error) {
      console.error('Erro CRÍTICO ao salvar projeto:', error);
      if (!autoSave) {
        showFeedback('Erro', 'Falha ao salvar. Verifique o console.', 'error');
      }
    }
  };
  
  // Função startTracking com sistema de lock
  // Função startTracking com sistema de lock
  const startTracking = async (mode = 'gps') => {
    if (loadedProjects.length > 1) {
      showFeedback('Bloqueado', 'Múltiplos projetos ativos. Deixe apenas UM projeto no mapa para continuar o traçado.', 'error');
      return;
    }
    
    if (loadedProjects.length === 1) {
      const project = loadedProjects[0];
      
      if (isOnline && user) {
        const hasLock = await ProjectLockService.acquireLock(project.id, user.id);
        if (!hasLock) {
          const status = await ProjectLockService.checkLockStatus(project.id, user.id);
          if (status.isLocked) {
            showFeedback('Projeto Travado', `Este projeto está sendo editado por ${status.lockedBy}. Modo leitura ativado.`, 'error');
            return;
          }
        }
      }
      
      setCurrentProject(project);
      setManualPoints(project.points);
      setTotalDistance(project.totalDistance || project.total_distance || 0);
      setProjectName(project.name);
      
      if (project.points && project.points.length > 0) {
        const lastPoint = project.points[project.points.length - 1];
        setSelectedStartPoint(lastPoint);
        
        showFeedback('Conectado', `Rastreamento continuado a partir do Ponto ${project.points.length}`, 'success');
      }
    }
    else if (!currentProject) {
      setManualPoints([]);
      setTotalDistance(0);
      setProjectName('');
      setSelectedStartPoint(null);
    }
    
    setTrackingInputMode(mode);
    setTracking(true);
    setPaused(false);
    setShowTrackingControls(true);
    setShowRulerPopup(false);
    
    kalmanLatRef.current = new KalmanFilter(0.1, 0.1);
    kalmanLngRef.current = new KalmanFilter(0.1, 0.1);
  };
  
  // Função loadProject com sistema de lock
  const loadProject = async (project) => {
    if (currentProject && isOnline && user) {
      await ProjectLockService.releaseLock(currentProject.id, user.id);
    }
    
    if (tracking && !paused) {
      showFeedback('Atenção', 'Pare o rastreamento atual antes de carregar um projeto.', 'warning');
      return;
    }
    
    if (manualPoints.length > 0) {
      if (currentProject && currentProject.id === project.id) {
        setShowProjectsList(false);
        return;
      }
      if (!confirm('Existem pontos não salvos no mapa. Deseja descartá-los?')) {
        return;
      }
    }
    
    setShowProjectsList(false);
    
    requestAnimationFrame(async () => {
      setManualPoints([]);
      setExtraConnections([]);
      setTotalDistance(0);
      setSelectedStartPoint(null);
      setTracking(false);
      setPaused(false);
      
      setCurrentProject(project);
      
      const exists = loadedProjects.find(p => p.id === project.id);
      
      if (!exists) {
        let bairroDetectado = project.bairro;
        if (!project.bairro || project.bairro === 'Vários') {
          BairroDetectionService.detectBairroForProject(project.points).then(b => {
            if (b) {
              console.log("Bairro detectado em background:", b);
            }
          });
        }
        
        const projectWithColor = {
          ...project,
          bairro: bairroDetectado || 'Vários',
          color: project.color || generateRandomColor(),
          points: project.points
        };
        
        setLoadedProjects(prev => [...prev, projectWithColor]);
        
        if (project.points.length > 0 && mapRef.current) {
          const firstPoint = project.points[0];
          
          setTimeout(() => {
            mapRef.current.flyTo({
              center: [firstPoint.lng, firstPoint.lat],
              zoom: 16,
              speed: 1.2,
              curve: 1,
              essential: true
            });
          }, 100);
        }
      }
    });
  };
  
  const loadMultipleProjects = async () => {
    if (!canLoadProjects()) {
      showFeedback('Erro', 'Não é possível carregar projetos durante o rastreamento ativo. Pare o rastreamento atual primeiro.', 'error');
      return;
    }
    
    if (selectedProjects.length === 0) {
      showFeedback('Erro', 'Selecione pelo menos um projeto para carregar', 'error');
      return;
    }
    
    try {
      setImportCurrentAction('Detectando bairros dos projetos...');
      
      const detectedBairro = await BairroDetectionService.detectBairroForMultipleProjects(selectedProjects);
      
      const projectsWithColors = selectedProjects.map(project => ({
        ...project,
        color: project.color || generateRandomColor(),
        bairro: detectedBairro,
        points: project.points.map(point => ({
          ...point,
          projectId: project.id,
          projectName: project.name
        }))
      }));
      
      setLoadedProjects(prev => {
        const newProjects = projectsWithColors.filter(
          newProject => !prev.some(existing => existing.id === newProject.id)
        );
        return [...prev, ...newProjects];
      });
      
      setSelectedProjects([]);
      setShowProjectsList(false);
      
    } catch (error) {
      console.error('Erro ao carregar múltiplos projetos:', error);
      const projectsWithColors = selectedProjects.map(project => ({
        ...project,
        color: project.color || generateRandomColor(),
        points: project.points.map(point => ({
          ...point,
          projectId: project.id,
          projectName: project.name
        }))
      }));
      
      setLoadedProjects(prev => {
        const newProjects = projectsWithColors.filter(
          newProject => !prev.some(existing => existing.id === newProject.id)
        );
        return [...prev, ...newProjects];
      });
      
      setSelectedProjects([]);
      setShowProjectsList(false);
    }
  };
  
  const startNewProject = () => {
    if (tracking) {
      if (!confirm('Deseja parar o rastreamento atual e iniciar um novo projeto?')) {
        return;
      }
      stopTracking();
    }
    
    if (currentProject && manualPoints.length > 0) {
      if (!confirm(`Deseja iniciar um novo projeto? O projeto atual "${currentProject.name}" será descartado.`)) {
        return;
      }
    }
    
    setCurrentProject(null);
    setProjectName('');
    setManualPoints([]);
    setExtraConnections([]);
    setTotalDistance(0);
    setSelectedStartPoint(null);
    setShowProjectDetails(false);
    setShowRulerPopup(false);
  };
  
  const calculateTotalDistance = (points) => {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += calculateDistance(
        points[i].lat,
        points[i].lng,
        points[i + 1].lat,
        points[i + 1].lng
      );
    }
    return total;
  };
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const clearStoredTokens = () => {
          try {
            localStorage.removeItem('supabase.auth.token')
            sessionStorage.removeItem('supabase.auth.token')
          } catch (e) {
            console.log('Cleanup de tokens no checkAuth')
          }
        }
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erro ao verificar sessão:', error)
          if (error.message.includes('Invalid Refresh Token')) {
            clearStoredTokens()
            await supabase.auth.signOut()
          }
        }
        
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Erro inesperado na autenticação:', error)
        setUser(null)
      } finally {
        setAuthLoading(false)
      }
    }
    
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event)
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || event === 'TOKEN_REFRESHED') {
        setUser(null)
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setMarkers([])
          setProjects([])
          setLoadedProjects([])
          setSelectedStartPoint(null)
        }
      } else if (event === 'SIGNED_IN') {
        setUser(session.user)
      } else if (event === 'INITIAL_SESSION') {
        setUser(session?.user ?? null)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  const createProjectsTable = async () => {
    try {
      const { error } = await supabase.rpc('create_projects_table_if_not_exists');
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao criar tabela de projetos:', error);
    }
  };
  
  const saveProjectToSupabase = async (project) => {
    if (!user) return null;
    
    try {
      const projectData = {
        name: project.name,
        points: project.points,
        extra_connections: project.extra_connections || [],
        total_distance: project.totalDistance || project.total_distance,
        bairro: project.bairro,
        tracking_mode: 'manual',
        user_id: user.id
      };
      
      let result;
      
      if (project.id && typeof project.id === 'number') {
        const { data, error } = await supabase
          .from('projetos')
          .insert([projectData])
          .select();
        
        if (error) throw error;
        result = data[0];
      } else {
        const { data, error } = await supabase
          .from('projetos')
          .update(projectData)
          .eq('id', project.id)
          .eq('user_id', user.id)
          .select();
        
        if (error) throw error;
        result = data[0];
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao salvar projeto no Supabase:', error);
      return null;
    }
  };
  
  const handleRenameProject = async (projectId, newName) => {
    await renameProject(projectId, newName);
    
    if (currentProject && currentProject.id === projectId) {
      setCurrentProject(prev => ({ ...prev, name: newName }));
      setProjectName(newName);
    }
    
    setLoadedProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, name: newName } : p
    ));
    
    showFeedback('Sucesso', 'Projeto renomeado', 'success');
  };
  
  const deleteProjectFromSupabase = async (projectId) => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('projetos')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao deletar projeto do Supabase:', error);
      return false;
    }
  };
  
  const syncOfflineProjects = async () => {
    if (!user || !isOnline) return;
    
    try {
      const offlineProjects = storage.loadProjects(user.id);
      
      for (const project of offlineProjects) {
        if (project.id.toString().startsWith('offline_')) {
          try {
            const { data, error } = await supabase
              .from('projetos')
              .insert([{
                name: project.name,
                points: project.points,
                extra_connections: project.extra_connections || [],
                total_distance: project.totalDistance || project.total_distance,
                bairro: project.bairro,
                tracking_mode: 'manual',
                user_id: user.id
              }])
              .select();
            
            if (error) throw error;
            
            const updatedProject = { ...project, id: data[0].id };
            const userProjects = storage.loadProjects(user.id);
            const updatedUserProjects = userProjects.map(p =>
              p.id === project.id ? updatedProject : p
            );
            storage.saveProjects(user.id, updatedUserProjects);
            
            console.log('Projeto offline sincronizado:', project.name);
            
          } catch (projectError) {
            console.error('Erro ao sincronizar projeto offline:', projectError);
          }
        }
      }
      
      await loadProjects();
      
    } catch (error) {
      console.error('Erro na sincronização offline:', error);
    }
  };
  
  // Efeito para carregar projetos
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user, isOnline]);
  
  useEffect(() => {
    if (isOnline && user) {
      syncOfflineProjects();
    }
  }, [isOnline, user]);
  
  useEffect(() => {
    const loadBairros = async () => {
      const savedBairros = storage.loadBairros();
      if (savedBairros) {
        setBairros(savedBairros);
      }
    };
    loadBairros();
  }, [])
  
  useEffect(() => {
    if (user) {
      const loadFavorites = async () => {
        const savedFavorites = storage.loadFavorites(user.id);
        if (savedFavorites) {
          setFavorites(savedFavorites);
        }
      };
      loadFavorites();
    }
  }, [user])
  
  useEffect(() => {
    let watchId = null
    
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, speed } = position.coords
          
          const smoothedLat = kalmanLatRef.current.filter(latitude);
          const smoothedLng = kalmanLngRef.current.filter(longitude);
          
          const smoothedPosition = {
            lat: smoothedLat,
            lng: smoothedLng
          };
          
          setCurrentPosition(smoothedPosition);
          setGpsAccuracy(accuracy);
          setSpeed(speed || 0);
          
          setPositionHistory(prev => {
            const newHistory = [...prev, {
              lat: smoothedLat,
              lng: smoothedLng,
              timestamp: Date.now(),
              accuracy: accuracy
            }].slice(-10);
            return newHistory;
          });
        },
        (error) => {
          console.error('Erro ao obter localização:', error)
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords
                setCurrentPosition({
                  lat: latitude,
                  lng: longitude
                });
              },
              (error) => console.error('Erro ao obter localização fallback:', error),
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 30000
              }
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        }
      )
    }
    
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [tracking, paused])
  
  const saveBairros = async (newBairros) => {
    setBairros(newBairros);
    storage.saveBairros(newBairros);
  }
  
  const handleAddBairro = async () => {
    if (newBairro.trim() && !bairros.includes(newBairro.trim())) {
      const updatedBairros = [...bairros, newBairro.trim()];
      await saveBairros(updatedBairros);
      setNewBairro('');
      setShowAddBairro(false);
      setShowBairroManager(false);
    }
  }
  
  const handleRemoveBairro = async (bairro) => {
    if (DEFAULT_BAIRROS.includes(bairro)) {
      showFeedback('Erro', 'Não é possível remover bairros padrão.', 'error');
      return;
    }
    if (confirm(`Deseja remover o bairro "${bairro}"?`)) {
      const updatedBairros = bairros.filter(b => b !== bairro);
      await saveBairros(updatedBairros);
      if (selectedBairro === bairro) {
        setSelectedBairro('todos');
      }
    }
  }
  
  const toggleFavorite = async (markerId) => {
    const newFavorites = favorites.includes(markerId) ?
      favorites.filter(id => id !== markerId) : [...favorites, markerId];
    
    setFavorites(newFavorites);
    if (user) {
      storage.saveFavorites(user.id, newFavorites);
    }
  }
  
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const status = await Network.getStatus()
        setIsOnline(status.connected)
      } catch (error) {
        setIsOnline(true)
      }
    }
    
    checkConnectivity()
    
    const setupListener = async () => {
      let networkListener
      try {
        networkListener = await Network.addListener('networkStatusChange', status => {
          setIsOnline(status.connected)
          if (status.connected && syncPending) {
            loadMarkers()
            setSyncPending(false)
          }
        })
      } catch (error) {}
      
      return () => {
        if (networkListener) {
          networkListener.remove()
        }
      }
    }
    
    const cleanupPromise = setupListener()
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup())
    }
  }, [syncPending])
  
  useEffect(() => {
    if (user) {
      loadMarkers()
    }
  }, [user])
  
  useEffect(() => {
    let filtered = markers
    
    if (selectedBairro !== 'todos') {
      filtered = filtered.filter(m => m.bairro === selectedBairro)
    }
    
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => favorites.includes(m.id))
    }
    
    setFilteredMarkers(filtered)
  }, [markers, selectedBairro, showFavoritesOnly, favorites])
  
  const loadMarkers = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      if (isOnline) {
        const { data, error } = await supabase
          .from('marcacoes')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        if (error) {
          if (error.code === '42P01') {
            console.log('Tabela não existe, será criada no primeiro upload')
          } else {
            console.error('Erro ao carregar marcações:', error)
            await loadMarkersFromCache()
          }
        } else {
          setMarkers(data || [])
          storage.saveMarkers(user.id, data || [])
        }
      } else {
        await loadMarkersFromCache()
      }
    } catch (error) {
      console.error('Erro ao carregar marcações:', error)
      await loadMarkersFromCache()
    } finally {
      setLoading(false)
    }
  }
  
  const loadMarkersFromCache = async () => {
    if (!user) return
    
    try {
      const cachedMarkers = storage.loadMarkers(user.id)
      if (cachedMarkers) {
        setMarkers(cachedMarkers)
      }
    } catch (error) {
      console.error('Erro ao carregar marcações do cache:', error)
    }
  }
  
  const saveMarkerToSupabase = async (marker) => {
    if (!user) return null
    
    try {
      const { data, error } = await supabase
        .from('marcacoes')
        .insert([{ ...marker, user_id: user.id }])
        .select()
      
      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Erro ao salvar marcação:', error)
      return null
    }
  }
  
  const updateMarkerInSupabase = async (marker) => {
    if (!user) return false
    
    try {
      const { error } = await supabase
        .from('marcacoes')
        .update(marker)
        .eq('id', marker.id)
        .eq('user_id', user.id)
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Erro ao atualizar marcação:', error)
      return false
    }
  }
  
  const deleteMarkerFromSupabase = async (markerId) => {
    if (!user) return false
    
    try {
      const { error } = await supabase
        .from('marcacoes')
        .delete()
        .eq('id', markerId)
        .eq('user_id', user.id)
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Erro ao deletar marcação:', error)
      return false
    }
  }
  
  const handleJoinProject = async (projectId) => {
    if (!user || !isOnline) {
      showFeedback('Erro', 'Você precisa estar online para importar projetos.', 'error');
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('join_project', {
        p_id: projectId
      });
      
      if (error) throw error;
      
      if (data.success) {
        showFeedback('Sucesso', data.message, 'success');
        await loadProjects();
      } else {
        showFeedback('Erro', data.message, 'error');
      }
      
    } catch (error) {
      console.error("Erro ao importar:", error);
      if (error.code === '22P02') {
        showFeedback('Erro', 'ID inválido. Certifique-se de copiar o código completo.', 'error');
      } else {
        showFeedback('Erro', 'Erro ao entrar no projeto.', 'error');
      }
    }
  };
  
  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImportProgress(0);
    setShowImportProgress(true);
    setImportCurrentAction('Processando arquivo...');
    setUploading(true);
    
    try {
      let kmlText;
      if (file.name.endsWith('.kmz')) {
        const zip = new(JSZip.default || JSZip)();
        const contents = await zip.loadAsync(file);
        const kmlFile = Object.keys(contents.files).find(name => name.endsWith('.kml'));
        if (!kmlFile) throw new Error('KML não encontrado no KMZ');
        kmlText = await contents.files[kmlFile].async('text');
      } else {
        kmlText = await file.text();
      }
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));
      
      const newMarkers = placemarks.map((placemark, i) => {
        const coordsText = placemark.getElementsByTagName('coordinates')[0]?.textContent?.trim();
        if (!coordsText) return null;
        
        const [lng, lat] = coordsText.split(',').map(Number);
        if (isNaN(lat) || isNaN(lng)) return null;
        
        return {
          id: generateUUID(),
          name: placemark.getElementsByTagName('name')[0]?.textContent || `Ponto ${i + 1}`,
          lat,
          lng,
          descricao: placemark.getElementsByTagName('description')[0]?.textContent || '',
          bairro: '',
          created_at: new Date().toISOString(),
          user_id: user?.id
        };
      }).filter(Boolean);
      
      setMarkers(prev => [...prev, ...newMarkers]);
      
      if (user) {
        storage.saveMarkers(user.id, newMarkers);
      }
      
      if (isOnline && user && newMarkers.length > 0) {
        setImportCurrentAction('Sincronizando com a nuvem...');
        const batchSize = 50;
        for (let i = 0; i < newMarkers.length; i += batchSize) {
          const batch = newMarkers.slice(i, i + batchSize);
          await supabase.from('marcacoes').insert(batch);
        }
      }
      
      setImportProgress(100);
      setImportSuccess(true);
      
      setTimeout(() => setShowImportProgress(false), 1500);
      
    } catch (error) {
      console.error('Erro na importação:', error);
      setImportError('Falha ao ler o arquivo.');
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };
  
  const handleClearImportedMarkers = async () => {
    if (!confirm('Tem certeza que deseja limpar todas as marcações importadas? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      if (isOnline && user) {
        const { error } = await supabase
          .from('marcacoes')
          .delete()
          .eq('user_id', user.id)
        
        if (error && error.code !== '42P01') {
          console.error('Erro ao limpar marcações:', error)
          showFeedback('Erro', 'Erro ao limpar marcações do servidor', 'error');
          return
        }
      }
      
      setMarkers([])
      setFilteredMarkers([])
      handleClearRoute()
      
      if (user) {
        storage.saveMarkers(user.id, []);
      }
      
      showFeedback('Sucesso', 'Todas as marcações importadas foram removidas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao limpar marcações:', error)
      showFeedback('Erro', 'Erro ao limpar marcações', 'error');
    }
  }
  
  const handleClearAllMarkers = async () => {
    if (!confirm('Tem certeza que deseja limpar todas as marcações? Esta ação não pode ser desfeita.')) {
      return
    }
    
    try {
      if (isOnline && user) {
        const { error } = await supabase
          .from('marcacoes')
          .delete()
          .eq('user_id', user.id)
        
        if (error && error.code !== '42P01') {
          console.error('Erro ao limpar marcações:', error)
          showFeedback('Erro', 'Erro ao limpar marcações do servidor', 'error');
          return
        }
      }
      
      setMarkers([])
      setFilteredMarkers([])
      handleClearRoute()
      
      if (user) {
        storage.saveMarkers(user.id, []);
      }
      
      showFeedback('Sucesso', 'Todas as marcações foram removidas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao limpar marcações:', error)
      showFeedback('Erro', 'Erro ao limpar marcações', 'error');
    }
  }
  
  const handleExport = () => {
    if (markers.length === 0) {
      showFeedback('Erro', 'Não há marcações para exportar.', 'error');
      return
    }
    
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Marcações Jamaaw</name>
    ${markers.map(marker => `
    <Placemark>
      <name>${escapeXml(marker.name)}</name>
      <description>${escapeXml(marker.descricao || '')}</description>
      <Point>
        <coordinates>${marker.lng},${marker.lat},0</coordinates>
      </Point>
    </Placemark>`).join('')}
  </Document>
</kml>`
    
    downloadKML(kml, 'marcacoes-jamaaw.kml')
  }
  
  const escapeXml = (unsafe) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '&':
          return '&amp;'
        case '\'':
          return '&apos;'
        case '"':
          return '&quot;'
        default:
          return c
      }
    })
  }
  
  const calculateTotalDistanceWithMultiplier = (points) => {
    if (!points || points.length < 2) return 0;
    let total = 0;
    
    points.forEach((point, index) => {
      let parent = null;
      if (point.connectedFrom) {
        parent = points.find(p => p.id === point.connectedFrom);
      } else if (index > 0) {
        parent = points[index - 1];
      }
      
      if (parent) {
        const linearDist = calculateDistance(parent.lat, parent.lng, point.lat, point.lng);
        const spans = point.spans || 1;
        total += (linearDist * spans);
      }
    });
    
    return total;
  };
  
  const handleSpanChange = (count) => {
    if (!spanSelectorInfo) return;
    
    const updatedPoints = manualPoints.map(p => {
      if (p.id === spanSelectorInfo.targetPointId) {
        return { ...p, spans: count };
      }
      return p;
    });
    
    setManualPoints(updatedPoints);
    
    const newTotal = calculateTotalProjectDistance(updatedPoints, extraConnections);
    setTotalDistance(newTotal);
    
    setSpanSelectorInfo(null);
  };
  
  const segmentsGeoJSON = useMemo(() => {
    const features = [];
    if (manualPoints.length > 0) {
      manualPoints.forEach((point, index) => {
        let parent = null;
        if (point.connectedFrom) {
          parent = manualPoints.find(p => p.id === point.connectedFrom);
        } else if (index > 0) {
          parent = manualPoints[index - 1];
        }
        
        if (parent) {
          const spans = point.spans || 1;
          const color = SPAN_COLORS[spans];
          
          features.push({
            type: 'Feature',
            properties: {
              type: 'segment',
              targetPointId: point.id,
              spans: spans,
              color: color
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [parent.lng, parent.lat],
                [point.lng, point.lat]
              ]
            }
          });
          
          const midLng = (parent.lng + point.lng) / 2;
          const midLat = (parent.lat + point.lat) / 2;
          
          features.push({
            type: 'Feature',
            properties: {
              type: 'badge',
              targetPointId: point.id,
              spans: spans,
              label: `${spans}AG`,
              color: color
            },
            geometry: {
              type: 'Point',
              coordinates: [midLng, midLat]
            }
          });
        }
      });
    }
    return { type: 'FeatureCollection', features };
  }, [manualPoints]);
  
  const downloadKML = async (kmlContent, filename) => {
    try {
      console.log('Iniciando download...', filename);
      
      if (Capacitor.getPlatform() === 'web') {
        const blob = new Blob([kmlContent], {
          type: 'application/vnd.google-earth.kml+xml;charset=utf-8'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      } else {
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: kmlContent,
          directory: Directory.Documents,
          encoding: 'utf-8',
        });
        
        showFeedback('Sucesso', `Arquivo salvo! Tentando abrir...`, 'success');
        
        try {
          await FileOpener.open({
            filePath: savedFile.uri,
            contentType: 'application/vnd.google-earth.kml+xml',
            openWithDefault: false
          });
        } catch (openerError) {
          console.warn("Erro ao abrir KML automaticamente:", openerError);
          try {
            await FileOpener.open({
              filePath: savedFile.uri,
              contentType: 'text/xml',
              openWithDefault: false
            });
          } catch (e) {
            showFeedback('Aviso', 'Arquivo salvo em Documentos, mas nenhum app compatível foi encontrado para abrir automaticamente.', 'warning');
          }
        }
      }
    } catch (error) {
      console.error('Erro fatal no download:', error);
      showFeedback('Erro', 'Erro ao salvar o arquivo.', 'error');
    }
  };
  
  const handleCalculateDistance = async () => {
    if (selectedForDistance.length !== 2) {
      showFeedback('Erro', 'Selecione exatamente 2 marcadores', 'error');
      return
    }
    
    setCalculatingRoute(true)
    const [m1, m2] = selectedForDistance
    
    // 3. ATUALIZAR CHAMADA PARA RoutingService
    const route = await RoutingService.getRouteFromAPI([m1.lng, m1.lat], [m2.lng, m2.lat])
    
    if (route) {
      setRouteCoordinates(route)
      
      const coordinates = [
        [m1.lng, m1.lat],
        [m2.lng, m2.lat]
      ]
      const distanceMatrix = await RoutingService.calculateDistanceMatrix(coordinates)
      let distance
      
      if (distanceMatrix && distanceMatrix[0] && distanceMatrix[0][1]) {
        distance = distanceMatrix[0][1]
      } else {
        distance = calculateDistance(m1.lat, m1.lng, m2.lat, m2.lng)
      }
      
      setDistanceResult({
        type: 'dois',
        distance: distance.toFixed(2),
        markers: [m1.name, m2.name],
        method: 'rota'
      })
    } else {
      const distance = calculateDistance(m1.lat, m1.lng, m2.lat, m2.lng)
      setRouteCoordinates([
        [m1.lat, m1.lng],
        [m2.lat, m2.lng]
      ])
      setDistanceResult({
        type: 'dois',
        distance: distance.toFixed(2),
        markers: [m1.name, m2.name],
        method: 'linha reta'
      })
    }
    
    setCalculatingRoute(false)
    setSidebarOpen(false)
  }
  
  const handleCalculateAllDistances = async () => {
    if (markers.length < 2) {
      showFeedback('Erro', 'É necessário ter pelo menos 2 marcadores', 'error');
      return
    }
    
    setCalculatingRoute(true)
    
    const allCoordinates = markers.map(m => [m.lng, m.lat])
    
    try {
      const coordsString = allCoordinates.map(c => `${c[0]},${c[1]}`).join(';')
      
      // 3. ATUALIZAR CHAMADA PARA RoutingService
      const data = await RoutingService.getRouteFromAPI(allCoordinates[0], allCoordinates[allCoordinates.length - 1])
      
      if (data) {
        const routeCoords = data.map(coord => [coord[1], coord[0]])
        setRouteCoordinates(routeCoords)
        
        // Para simplicidade, usaremos a distância calculada manualmente
        let totalDistance = 0
        for (let i = 0; i < markers.length - 1; i++) {
          totalDistance += calculateDistance(markers[i].lat, markers[i].lng, markers[i + 1].lat, markers[i + 1].lng)
        }
        
        setDistanceResult({
          type: 'todas',
          distance: totalDistance.toFixed(2),
          count: markers.length,
          method: 'rota'
        })
      } else {
        throw new Error('Rota não encontrada')
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error)
      
      let totalDistance = 0
      const routeCoords = []
      
      for (let i = 0; i < markers.length - 1; i++) {
        const m1 = markers[i]
        const m2 = markers[i + 1]
        totalDistance += calculateDistance(m1.lat, m1.lng, m2.lat, m2.lng)
        routeCoords.push([m1.lat, m1.lng])
      }
      routeCoords.push([markers[markers.length - 1].lat, markers[markers.length - 1].lng])
      
      setRouteCoordinates(routeCoords)
      setDistanceResult({
        type: 'todas',
        distance: totalDistance.toFixed(2),
        count: markers.length,
        method: 'linha reta'
      })
    }
    
    setCalculatingRoute(false)
    setSidebarOpen(false)
  }
  
  const handleClearRoute = () => {
    setRouteCoordinates([])
    setDistanceResult(null)
    setSelectedForDistance([])
  }
  
  const toggleMarkerSelection = (marker) => {
    // Removida função de seleção múltipla
  };
  
  
  const toggleProjectSelection = (project) => {
    setSelectedProjects(prev => {
      const exists = prev.find(p => p.id === project.id);
      if (exists) {
        return prev.filter(p => p.id !== project.id);
      } else {
        return [...prev, project];
      }
    });
  };
  
  const removeLoadedProject = (projectId) => {
    if (currentProject && currentProject.id === projectId && isOnline && user) {
      ProjectLockService.releaseLock(currentProject.id, user.id);
    }
    
    setLoadedProjects(prev => prev.filter(p => p.id !== projectId));
    
    if (currentProject && currentProject.id === projectId) {
      setCurrentProject(null);
      setManualPoints([]);
      setTotalDistance(0);
      setSelectedStartPoint(null);
    }
    
    if (mapRef.current) {
      mapRef.current.triggerRepaint();
    }
  };
  
  const handleEditMarker = useCallback((marker) => {
    setEditingMarker(marker);
    setShowEditDialog(true);
  }, []);
  
  const handleSaveEdit = async () => {
    if (!editingMarker) return
    
    if (isOnline) {
      const success = await updateMarkerInSupabase(editingMarker)
      if (success) {
        setMarkers(prev => prev.map(m => m.id === editingMarker.id ? editingMarker : m))
        setShowEditDialog(false)
        setEditingMarker(null)
      } else {
        showFeedback('Erro', 'Erro ao salvar alterações', 'error');
      }
    } else {
      setMarkers(prev => prev.map(m => m.id === editingMarker.id ? editingMarker : m))
      setSyncPending(true)
      setShowEditDialog(false)
      setEditingMarker(null)
    }
  }
  
  const handleDeleteMarker = async () => {
    if (!editingMarker) return
    
    if (confirm(`Deseja realmente deletar "${editingMarker.name}"?`)) {
      if (isOnline) {
        const success = await deleteMarkerFromSupabase(editingMarker.id)
        if (success) {
          setMarkers(prev => prev.filter(m => m.id !== editingMarker.id))
          setShowEditDialog(false)
          setEditingMarker(null)
        } else {
          showFeedback('Erro', 'Erro ao deletar marcação', 'error');
        }
      } else {
        setMarkers(prev => prev.filter(m => m.id !== editingMarker.id))
        setSyncPending(true)
        setShowEditDialog(false)
        setEditingMarker(null)
      }
    }
  }
  
  const detectStreetName = async (lat, lng) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      )
      
      if (response.data && response.data.address) {
        const address = response.data.address
        const streetName = address.road || address.street || address.pedestrian || address.footway || address.highway || address.cycleway || address.path || ''
        return streetName
      }
      return ''
    } catch (error) {
      console.error('Erro ao detectar nome da rua:', error)
      return ''
    }
  }
  
  const handleShareLocation = (marker) => {
    const url = `https://www.google.com/maps?q=${marker.lat},${marker.lng}`;
    if (navigator.share) {
      navigator.share({
        title: marker.name,
        text: `Confira esta localização: ${marker.name}`,
        url: url
      })
    } else {
      navigator.clipboard.writeText(url)
      showFeedback('Sucesso', 'Link copiado para a área de transferência!', 'success');
    }
  }
  
  const getMarkerCountByBairro = (bairro) => {
    if (bairro === 'todos') return markers.length
    return markers.filter(m => m.bairro === bairro).length
  }
  
  const addManualPoint = async () => {
    if (!currentPosition || !tracking || paused) {
      return;
    }
    
    let finalPosition = currentPosition;
    
    if (snappingEnabled) {
      try {
        const snapped = await RoadSnappingService.snapToRoad(currentPosition.lat, currentPosition.lng);
        if (snapped.snapped) {
          finalPosition = { lat: snapped.lat, lng: snapped.lng };
        }
      } catch (error) {
        console.warn('Erro no snapping, usando posição original:', error);
      }
    }
    
    addPoint(finalPosition);
  }
  
  const addPoint = (position) => {
    const newPoint = {
      ...position,
      id: generateUUID(),
      timestamp: Date.now(),
      connectedFrom: selectedStartPoint ? selectedStartPoint.id : null,
      user_id: user.id,
      user_email: user.email,
      spans: 1,
    }
    
    setManualPoints(prev => {
      const updatedPoints = [...prev, newPoint]
      const newTotalDistance = calculateTotalProjectDistance(updatedPoints, extraConnections);
      setTotalDistance(newTotalDistance);
      return updatedPoints
    })
    
    if (selectedStartPoint) {
      setSelectedStartPoint(newPoint);
    }
  }
  
  const undoLastPoint = () => {
    if (manualPoints.length > 0) {
      const pointToRemove = manualPoints[manualPoints.length - 1];
      
      const newPoints = manualPoints.slice(0, -1);
      
      setManualPoints(newPoints);
      const newTotalDistance = calculateTotalProjectDistance(newPoints, extraConnections);
      setTotalDistance(newTotalDistance);
      
      if (selectedStartPoint && selectedStartPoint.id === pointToRemove.id) {
        if (newPoints.length > 0) {
          const parentPoint = pointToRemove.connectedFrom ?
            newPoints.find(p => p.id === pointToRemove.connectedFrom) :
            null;
          
          const newActivePoint = parentPoint || newPoints[newPoints.length - 1];
          
          setSelectedStartPoint(newActivePoint);
        } else {
          setSelectedStartPoint(null);
        }
      }
    }
  };
  
  const pauseTracking = async () => {
    try {
      if (manualPoints.length > 0 && tracking && !paused) {
        await saveProject(true, manualPoints);
      }
    } catch (error) {
      console.error('Erro ao salvar projeto automaticamente:', error);
    } finally {
      setPaused(!paused);
    }
  };
  
  const toggleSnapping = () => {
    setSnappingEnabled(!snappingEnabled);
  };
  
  const stopTracking = async () => {
    if (currentProject && isOnline && user) {
      await ProjectLockService.releaseLock(currentProject.id, user.id);
    }
    
    try {
      if (manualPoints.length > 0 && !showProjectDialog) {
        let projectNameToUse = projectName;
        if (currentProject && !projectName.trim()) {
          projectNameToUse = currentProject.name;
        } else if (!projectName.trim()) {
          projectNameToUse = `Rastreamento ${new Date().toLocaleString('pt-BR')}`;
        }
        
        if (projectNameToUse.trim() && manualPoints.length > 0) {
          await saveProject(true, manualPoints);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar projeto automaticamente:', error);
    } finally {
      setTracking(false);
      setPaused(false);
      setShowTrackingControls(false);
      setManualPoints([]);
      setExtraConnections([]);
      setTotalDistance(0);
      setSelectedStartPoint(null);
      setPositionHistory([]);
      setGpsAccuracy(null);
      setSpeed(0);
    }
  };
  
  const clearManualPoints = () => {
    setManualPoints([])
    setTotalDistance(0)
    setCurrentProject(null)
    setSelectedStartPoint(null)
  }
  
  const handleRemovePoints = () => {
    if (currentProject && confirm(`Tem certeza que deseja remover todos os pontos do projeto "${currentProject.name}"?`)) {
      setManualPoints([]);
      setTotalDistance(0);
      setCurrentProject(null);
      setSelectedStartPoint(null);
      setShowProjectDetails(false);
      setProjectName('');
    }
  };
  
  const exportProjectAsKML = (project = currentProject) => {
    if (!project) return;
    
    setTimeout(() => {
      const dist = project.total_distance || project.totalDistance || 0;
      const distTexto = dist < 1000 ?
        `${Math.round(dist)} metros` :
        `${(dist / 1000).toFixed(3)} km`;
      
      const linesKML = project.points.map((point, index) => {
        if (index === 0) return '';
        
        let parent = point.connectedFrom ?
          project.points.find(p => p.id === point.connectedFrom) :
          project.points[index - 1];
        
        if (parent) {
          return `
          <Placemark>
            <name>Traçado ${index}</name>
            <styleUrl>#lineStyle</styleUrl>
            <LineString>
              <tessellate>1</tessellate>
              <coordinates>
                ${parent.lng},${parent.lat},0
                ${point.lng},${point.lat},0
              </coordinates>
            </LineString>
          </Placemark>`;
        }
        return '';
      }).join('\n');
      
      const pointsKML = project.points.map((point, index) => `
        <Placemark>
          <name>${index + 1}</name>
          <description>Lat: ${point.lat}, Lng: ${point.lng}</description>
          <styleUrl>#iconStyle</styleUrl>
          <Point>
            <coordinates>${point.lng},${point.lat},0</coordinates>
          </Point>
        </Placemark>
      `).join('\n');
      
      const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(project.name)}</name>
    <description>Distância Total: ${distTexto}</description>
    
    <Style id="lineStyle">
      <LineStyle>
        <color>ff00ffff</color> 
        <width>4</width>
      </LineStyle>
    </Style>
    
    <Style id="iconStyle">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
        <hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>

    <Folder>
      <name>Traçado Completo (${distTexto})</name>
      ${linesKML}
    </Folder>

    <Folder>
      <name>Pontos (${project.points.length})</name>
      ${pointsKML}
    </Folder>

  </Document>
</kml>`;
      
      const friendlyName = project.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      downloadKML(kmlContent, `projeto_${friendlyName}.kml`);
    }, 50);
  };
  
  const handleBoundsAdjustedForMarkers = () => {
    setAdjustBoundsForMarkers(false);
  };
  
  const handleBoundsAdjustedForProject = () => {
    setAdjustBoundsForProject(false);
  };
  
  const centerMapOnUser = () => {
    if (currentPosition && mapRef.current) {
      mapRef.current.flyTo({
        center: [currentPosition.lng, currentPosition.lat],
        zoom: 16,
        essential: true,
      });
    } else {
      showFeedback('Erro', 'Localização atual ainda não disponível.', 'error');
    }
  };
  
  const handleARMode = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showFeedback('Erro', 'Seu navegador não suporta acesso à câmera para realidade aumentada.', 'error');
      return;
    }
    
    if (!currentPosition) {
      showFeedback('Erro', 'Aguardando localização GPS... Tente novamente em alguns segundos.', 'error');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      setArPermission('granted');
      setArMode(true);
      setSidebarOpen(false);
      
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      
      if (error.name === 'NotAllowedError') {
        showFeedback('Erro', 'Permissão da câmera negada. Ative as permissões da câmera nas configurações do seu navegador.', 'error');
      } else if (error.name === 'NotFoundError') {
        showFeedback('Erro', 'Nenhuma câmera traseira encontrada. O modo AR funciona melhor com câmera traseira.', 'error');
      } else {
        showFeedback('Erro', 'Não foi possível acessar a câmera: ' + error.message, 'error');
      }
      
      setArPermission('denied');
    }
  };
  
  useEffect(() => {
    const handleBodyClick = (event) => {
      if (event.target.closest('button')?.textContent.includes('Exportar') ||
        event.target.closest('button')?.textContent.includes('Download') ||
        event.target.closest('button')?.querySelector('svg[data-icon="download"]')) {
        document.body.classList.add('download-requested')
      }
    }
    
    document.body.addEventListener('click', handleBodyClick)
    
    return () => {
      document.body.removeEventListener('click', handleBodyClick)
    }
  }, [])
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400 font-semibold text-lg">Carregando Jamaaw App...</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return <Auth onAuthSuccess={(user) => setUser(user)} />
  }
  
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      <div className="absolute inset-0 z-0">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: -35.7353,
            latitude: -9.6658,
            zoom: 13
          }}
          style={{ width: '100%', height: '100%', position: 'relative' }}
          mapStyle={mapStyles[mapStyle].url}
          mapboxAccessToken={mapboxToken}
          cursor={tracking && trackingInputMode === 'touch' && !paused ? 'crosshair' : 'auto'}
          preserveDrawingBuffer={true}
          onClick={async (e) => {
    // 1. Verificação de segurança: O mapa está carregado?
    if (!mapRef.current) return;

    // 2. Tenta pegar features de marcadores (Markers)
    const markerLayers = ['markers-hit-area', 'markers-layer'].filter(id => 
      mapRef.current.getLayer(id)
    );
    
    let features = [];
    if (markerLayers.length > 0) {
      features = e.target.queryRenderedFeatures(e.point, {
        layers: markerLayers
      });
    }
    
    // Lógica do segmento (Traçado)
    if (tracking && !paused) {
      const segmentLayers = ['segment-hit-area', 'segment-badge-bg'].filter(id => 
        mapRef.current.getLayer(id)
      );

      if (segmentLayers.length > 0) {
        const segmentFeatures = e.target.queryRenderedFeatures(e.point, {
          layers: segmentLayers
        });

        if (segmentFeatures.length > 0) {
          const feature = segmentFeatures[0];
          setSpanSelectorInfo({
            x: e.point.x,
            y: e.point.y,
            targetPointId: feature.properties.targetPointId,
            currentSpans: feature.properties.spans
          });
          return;
        }
      }
    }
    
    setSpanSelectorInfo(null);

    // Lógica de clique no Marcador
    if (features.length > 0) {
      const feature = features[0];
      const markerData = {
        ...feature.properties,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0]
      };
      
      setPopupMarker(markerData);
      return;
    }

    // Lógica de adicionar ponto (Toque)
    if (tracking && trackingInputMode === 'touch' && !paused) {
      const { lat, lng } = e.lngLat;
      
      if (snappingEnabled) {
        try {
          const snapped = await RoadSnappingService.snapToRoad(lat, lng);
          if (snapped.snapped) {
            addPoint({ lat: snapped.lat, lng: snapped.lng });
          } else {
            addPoint({ lat, lng });
          }
        } catch (error) {
          console.warn('Erro no snapping de toque:', error);
          addPoint({ lat, lng });
        }
      } else {
        addPoint({ lat, lng });
      }
      return;
    }

    setPopupMarker(null); 
  }}
        >
          <NavigationControl position="top-right" />

          {/* CAMADA DE MARCADORES OTIMIZADA */}
          <Source id="markers-source" type="geojson" data={markersGeoJSON}>
            <Layer
              id="markers-layer"
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 4,
                  15, 8
                ],
                'circle-color': ['get', 'color'],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
              }}
            />
            <Layer
              id="markers-hit-area"
              type="circle"
              paint={{
                'circle-radius': 20,
                'circle-color': 'transparent',
                'circle-opacity': 0
              }}
            />
          </Source>

          {loadedProjects.map(project => (
            <Source 
              key={`source-${project.id}`}
              id={`route-${project.id}`} 
              type="geojson" 
              data={{
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: project.points
                        .filter(point => !point.connectedFrom)
                        .map(point => [point.lng, point.lat])
                    }
                  },
                  ...project.points
                    .filter(point => point.connectedFrom)
                    .map(point => {
                      const parent = project.points.find(p => p.id === point.connectedFrom);
                      return parent ? {
                        type: 'Feature',
                        geometry: {
                          type: 'LineString',
                          coordinates: [[parent.lng, parent.lat], [point.lng, point.lat]]
                        }
                      } : null;
                    }).filter(Boolean)
                ]
              }}
            >
              <Layer
  id={`route-layer-${project.id}`}
  type="line"
  paint={{
    'line-color': project.color,
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      10, 1,
      15, 3,
      22, 6
    ],
    'line-opacity': 0.8
  }}
/>
            </Source>
          ))}

          {loadedProjects.map(project => (
            <React.Fragment key={`markers-${project.id}`}>
              {project.points.map((point, index) => (
                <PoleMarker
                  key={point.id}
                  point={point}
                  index={index + 1}
                  color={project.color}
                  isActive={false}
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setPointPopupInfo({
                      point,
                      pointNumber: index + 1,
                      projectName: project.name,
                      projectId: project.id,
                      totalPoints: project.points.length,
                      color: project.color,
                      isManualPoint: false
                    });
                  }}
                />
              ))}
            </React.Fragment>
          ))}

          {/* CAMADA DE TRAÇADO COM VÃOS */}
          {manualPoints.length > 0 && (
            <Source id="segments-source" type="geojson" data={segmentsGeoJSON}>
              <Layer
                id="segment-hit-area"
                type="line"
                paint={{
                  'line-width': 20,
                  'line-opacity': 0
                }}
              />

              <Layer
  id="segment-line"
  type="line"
  layout={{
    'line-join': 'round',
    'line-cap': 'round'
  }}
  paint={{
    'line-color': ['get', 'color'],
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      10, 1,
      15, 3,
      22, 6
    ],
    'line-opacity': 0.9
  }}
/>

              <Layer
                id="segment-badge-bg"
                type="circle"
                filter={['==', 'type', 'badge']}
                paint={{
                  'circle-radius': 8,
                  'circle-color': '#0f172a',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': ['get', 'color']
                }}
              />

              <Layer
                id="segment-badge-text"
                type="symbol"
                filter={['==', 'type', 'badge']}
                layout={{
                  'text-field': ['get', 'label'],
                  'text-size': 10,
                  'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                  'text-allow-overlap': true
                }}
                paint={{
                  'text-color': '#ffffff'
                }}
              />
            </Source>
          )}

          {manualPoints.map((point, index) => (
            <PoleMarker
              key={point.id}
              point={point}
              index={index + 1}
              color="#1e3a8a"
              isActive={selectedStartPoint && selectedStartPoint.id === point.id}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPointPopupInfo({
                  point,
                  pointNumber: index + 1,
                  isManualPoint: true,
                  totalPoints: manualPoints.length
                });
              }}
            />
          ))}

          {routeCoordinates.length > 0 && (
            <Source id="calculated-route" type="geojson" data={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates.map(c => [c[1], c[0]])
              }
            }}>
              <Layer
                id="calculated-route-layer"
                type="line"
                paint={{
                  'line-color': '#06B6D4',
                  'line-width': 4,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          )}

          {currentPosition && (
            <Marker longitude={currentPosition.lng} latitude={currentPosition.lat}>
              <div className="current-position-marker" />
            </Marker>
          )}

          {pointPopupInfo && pointPopupInfo.isManualPoint && (
            <Popup
              longitude={pointPopupInfo.point.lng}
              latitude={pointPopupInfo.point.lat}
              onClose={() => setPointPopupInfo(null)}
              className="modern-popup"
              closeButton={false}
              anchor="bottom"
              offset={20}
              maxWidth="300px"
            >
              <TrackingPointPopupContent 
                pointInfo={pointPopupInfo}
                onClose={() => setPointPopupInfo(null)}
                onSelectStart={selectPointAsStart}
                selectedStartPoint={selectedStartPoint}
                manualPoints={manualPoints}
              />
            </Popup>
          )}

          {pointPopupInfo && pointPopupInfo.point && !pointPopupInfo.isManualPoint && (
            <Popup
              longitude={pointPopupInfo.point.lng}
              latitude={pointPopupInfo.point.lat}
              onClose={() => setPointPopupInfo(null)}
              className="modern-popup"
              closeButton={false}
              maxWidth="300px"
              anchor="bottom"
              offset={15}
            >
              <div className="w-[260px] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                
                <div className="relative p-3 flex items-center justify-between bg-slate-800/50 border-b border-slate-700/50">
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: pointPopupInfo.color }}
                  />
                  
                  <div className="pl-2 flex flex-col overflow-hidden">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Projeto
                    </span>
                    <span className="text-sm font-bold text-white truncate leading-tight" title={pointPopupInfo.projectName}>
                      {pointPopupInfo.projectName}
                    </span>
                  </div>

                  <button
                    onClick={() => setPointPopupInfo(null)}
                    className="h-6 w-6 flex items-center justify-center rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 shadow-inner"
                    >
                      <span 
                        className="text-lg font-bold" 
                        style={{ color: pointPopupInfo.color }}
                      >
                        {pointPopupInfo.pointNumber}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-300 font-medium">Ponto de Traçado</span>
                      <span className="text-[10px] text-slate-500">
                        Total de {pointPopupInfo.totalPoints} pontos
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex flex-col">
                      <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Latitude</span>
                      <span className="font-mono text-xs text-cyan-400 font-medium truncate">
                        {pointPopupInfo.point.lat?.toFixed(7)}
                      </span>
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex flex-col">
                      <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Longitude</span>
                      <span className="font-mono text-xs text-cyan-400 font-medium truncate">
                        {pointPopupInfo.point.lng?.toFixed(7)}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full h-7 text-xs border border-dashed border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition-all"
                    onClick={() => {
                      const coords = `${pointPopupInfo.point.lat}, ${pointPopupInfo.point.lng}`;
                      navigator.clipboard.writeText(coords);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="w-3 h-3" /> Copiar Coordenadas
                    </span>
                  </Button>

                </div>
              </div>
            </Popup>
          )}
        </Map>
        
        {/* 5. NOVO CONTROLE DE MAPA E GPS (Substitui os botões antigos) */}
        <MapControls 
          onCenterMap={centerMapOnUser}
          currentMapStyle={mapStyle}
          onChangeStyle={setMapStyle}
          isTrackingActive={tracking}
        />
        
        {/* 6. Botão de Equipe (Só aparece se tiver projeto carregado e online) */}
        {currentProject && isOnline && (
          <div className="absolute top-4 left-20 z-10">
             <Button 
               size="sm" 
               onClick={() => setShowMembersDialog(true)}
               className="bg-slate-900/80 backdrop-blur text-cyan-400 border border-white/10 shadow-xl"
             >
               <Users size={16} className="mr-2" /> Equipe
             </Button>
          </div>
        )}
      </div>
      

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="bg-slate-950/90 backdrop-blur border border-white/10 text-cyan-400 shadow-xl rounded-xl h-10 w-10 active:scale-90 transition-transform"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          
          <SheetContent side="left" className="w-[280px] p-0 border-r border-white/5 bg-slate-950 text-white flex flex-col">
            <div className="p-5 border-b border-white/5 bg-gradient-to-b from-cyan-950/20 to-transparent">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                  <MapPinned className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-lg tracking-tight">Jamaaw</h2>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
              <div className="px-3 space-y-1">
                <p className="text-[10px] uppercase text-slate-600 font-bold px-2 mt-4 mb-2">Ferramentas</p>
                
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all group"
                  onClick={() => { setSidebarOpen(false); setShowProjectsList(true); }}
                >
                  <FolderOpen className="w-5 h-5 mr-3 text-cyan-500 group-hover:scale-110 transition-transform" />
                  <span className="flex-1 text-left">Projetos</span>
                  <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">{projects.length}</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all group"
                  onClick={() => { 
                    setSidebarOpen(false); 
                    startTracking('touch');
                  }}
                >
                  <Ruler className="w-5 h-5 mr-3 text-purple-500 group-hover:scale-110 transition-transform" />
                  <span>Medir</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all group"
                  onClick={() => { setSidebarOpen(false); handleARMode(); }}
                >
                  <Camera className="w-5 h-5 mr-3 text-yellow-500 group-hover:scale-110 transition-transform" />
                  <span>Realidade Aumentada</span>
                </Button>

                <p className="text-[10px] uppercase text-slate-600 font-bold px-2 mt-6 mb-2">Dados</p>
                
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  onClick={() => { setSidebarOpen(false); fileInputRef.current?.click(); }}
                >
                  <Upload className="w-5 h-5 mr-3 text-slate-500" />
                  <span>Importar KML</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  onClick={() => { setSidebarOpen(false); handleExport(); }}
                >
                  <Download className="w-5 h-5 mr-3 text-slate-500" />
                  <span>Exportar Tudo</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl transition-all"
                  onClick={() => { 
                    setSidebarOpen(false); 
                    if(confirm('ATENÇÃO: Isso apagará todas as marcações do mapa. Continuar?')) {
                       handleClearAllMarkers();
                    }
                  }}
                >
                  <Trash2 className="w-5 h-5 mr-3" />
                  <span>Limpar Marcações</span>
                </Button>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex flex-col overflow-hidden mr-2">
                  <span className="text-xs font-medium text-white truncate">{user?.email}</span>
                  <span className="text-[10px] text-slate-500">Logado</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm rounded-lg px-4 py-2.5 shadow-xl border border-slate-600/50">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <MapPinned className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-white text-sm sm:text-base">Jamaaw App</span>
            {currentProject && manualPoints.length > 0 && (
              <span className="text-xs text-cyan-400 ml-2 bg-cyan-500/20 px-2 py-0.5 rounded-full">
                {currentProject.name}
              </span>
            )}
            {loadedProjects.length > 0 && (
              <span className="text-xs text-green-400 ml-2 bg-green-500/20 px-2 py-0.5 rounded-full">
                {loadedProjects.length} projetos
              </span>
            )}
            {!isOnline && (
              <span className="text-xs text-orange-400 ml-2 bg-orange-500/20 px-2 py-0.5 rounded-full">Offline</span>
            )}
            {tracking && (
              <span className="text-xs text-green-400 ml-2 bg-green-500/20 px-2 py-0.5 rounded-full">Rastreando</span>
            )}
            {selectedStartPoint && (
              <span className="text-xs text-purple-400 ml-2 bg-purple-500/20 px-2 py-0.5 rounded-full">Galho Ativo</span>
            )}
          </div>
        </div>

        <Button
          size="icon"
          className={`bg-gradient-to-br from-slate-800 to-slate-700 backdrop-blur-sm text-white shadow-xl border border-slate-600/50 transition-all-smooth ${
            tracking ? 'opacity-50 cursor-not-allowed' : 'hover:from-slate-700 hover:to-slate-600 hover-lift'
          }`}
          onClick={() => {
            if (tracking) {
              showFeedback('Erro', 'Não é possível gerenciar projetos durante o rastreamento. Pare o rastreamento atual primeiro.', 'error');
              return;
            }
            setShowLoadedProjects(true);
          }}
          disabled={tracking || loadedProjects.length === 0}
        >
          <Layers className="w-5 h-5" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowRulerPopup(false)}
          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* REMOVIDO: Botão de seleção múltipla */}

      {/* REMOVIDO: MultipleSelectionPopup */}

      {showProjectDetails && currentProject && (
        <div className="absolute bottom-20 right-4 z-50 animate-scale-in">
          <Card className="bg-gradient-to-br from-slate-800/95 to-slate-700/95 backdrop-blur-sm border-slate-600/50 shadow-2xl text-white w-64">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-1">
                  <FolderOpen className="w-4 h-4 text-cyan-400" />
                  Detalhes
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowProjectDetails(false)}
                  className="h-5 w-5 p-0 text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      <ProjectManager
  isOpen={showProjectsList}
  onClose={() => setShowProjectsList(false)}
  projects={projects}
  currentUserId={user?.id}
  onLoadProject={(p) => {
    loadProject(p);
    setShowProjectsList(false);
  }}
  onDeleteProject={deleteProject}
  onExportProject={exportProjectAsKML}
  onJoinProject={handleJoinProject}
  // --- CORREÇÃO DO RELATÓRIO ---
  onOpenReport={(project) => {
      const img = getMapImage(); 
      setReportData({ project, image: img }); 
      setShowProjectsList(false); 
  }}
  // --- CORREÇÃO DA EQUIPE (O QUE FALTAVA) ---
  onOpenMembers={(project) => {
      setInspectingProject(project);
      setShowMembersDialog(true);
  }}
/>

      <LoadedProjectsManager
        isOpen={showLoadedProjects}
        onClose={() => setShowLoadedProjects(false)}
        loadedProjects={loadedProjects}
        onRemoveProject={removeLoadedProject}
        onFocusProject={focusOnProject}
        onShowDetails={(p) => {
          setPointPopupInfo({ project: p, showOverview: true });
          setShowLoadedProjects(false);
        }}
        totalDistanceAll={totalDistanceAllProjects}
      />

      

      {/* REMOVIDO: Botão antigo de localização */}

      {distanceResult && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm rounded-xl p-4 shadow-2xl text-white border border-slate-600/50 animate-slide-in-bottom">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-cyan-400 mb-1 flex items-center gap-2">
                <Ruler className="w-4 h-4" />
                {distanceResult.type === 'dois' ? 'Distância entre 2 Postes' : 'Distância Total'}
              </h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {distanceResult.distance} m
              </p>
              {distanceResult.type === 'dois' && (
                <p className="text-sm text-gray-300 mt-1">
                  {distanceResult.markers[0]} → {distanceResult.markers[1]}
                </p>
              )}
              {distanceResult.type === 'todas' && (
                <p className="text-sm text-gray-300 mt-1">
                  {distanceResult.count} marcações
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1 bg-slate-700/50 px-2 py-1 rounded inline-block">
                Método: {distanceResult.method}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearRoute}
              className="text-gray-400 hover:text-white hover:bg-red-500/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {calculatingRoute && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm px-6 py-3 rounded-xl shadow-2xl z-10 flex items-center gap-3 text-white border border-slate-600/50 animate-scale-in">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
          <span className="text-sm font-medium">Calculando rota...</span>
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open)
        if (!open) {
          setEditingMarker(null)
        }
      }}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Personalizar Marcação
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Atualize as informações da marcação. O nome é automático e não pode ser alterado aqui.
            </DialogDescription>
          </DialogHeader>
          {editingMarker && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-gray-300 font-medium">Nome</Label>
                  <Input
                    value={editingMarker.name}
                    disabled
                    className="bg-slate-800/50 border-slate-700 text-gray-400"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 font-medium">Bairro</Label>
                  <Select
                    value={editingMarker.bairro || ''}
                    onValueChange={(value) => setEditingMarker({ ...editingMarker, bairro: value })}
                  >
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20">
                      <SelectValue placeholder="Selecione um bairro" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white z-[9999]">
                      {bairros.map(bairro => (
                        <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-300 font-medium">Descrição</Label>
                  <Textarea
                    value={editingMarker.descricao || ''}
                    onChange={(e) => setEditingMarker({ ...editingMarker, descricao: e.target.value })}
                    className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                    rows={3}
                    placeholder="Adicione uma descrição..."
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-700/50">
                <Button onClick={handleDeleteMarker} variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300">
                  <X className="w-4 h-4 mr-2"/>
                  Deletar
                </Button>
                <Button onClick={handleSaveEdit} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg">
                  <Save className="w-4 h-4 mr-2"/>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBairroManager} onOpenChange={setShowBairroManager}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Gerenciar Bairros
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newBairro}
                onChange={(e) => setNewBairro(e.target.value)}
                placeholder="Adicionar novo bairro"
                className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                onKeyPress={(e) => e.key === 'Enter' && handleAddBairro()}
              />
              <Button onClick={handleAddBairro} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                Adicionar
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
              {bairros.map(bairro => (
                <div key={bairro} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                  <span>{bairro}</span>
                  {!DEFAULT_BAIRROS.includes(bairro) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      onClick={() => handleRemoveBairro(bairro)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {newMarkerData && (
        <Dialog open={true} onOpenChange={() => setNewMarkerData(null)}>
          <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Novo Marcador
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 font-medium">Rua</Label>
                <Input
                  value={newMarkerData.rua}
                  onChange={(e) => setNewMarkerData({ ...newMarkerData, rua: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 font-medium">Cor</Label>
                <Input
                  type="color"
                  value={newMarkerData.color}
                  onChange={(e) => setNewMarkerData({ ...newMarkerData, color: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <Button
                onClick={async () => {
                  const savedMarker = await saveMarkerToSupabase({
                    name: `Marcador ${markers.length + 1}`,
                    lat: newMarkerData.lat,
                    lng: newMarkerData.lng,
                    rua: newMarkerData.rua,
                    color: newMarkerData.color,
                  });
                  if (savedMarker) {
                    setMarkers(prev => [...prev, savedMarker]);
                  }
                  setNewMarkerData(null);
                }}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                Salvar Marcador
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showProjectDialog} onOpenChange={(open) => {
        setShowProjectDialog(open);
        if (!open) {
          setEditingProject(null);
          setProjectName('');
        }
      }}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Save className="w-5 h-5" />
              {editingProject ? 'Atualizar Projeto' : 'Salvar Projeto'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              {editingProject ? 
                `Atualize os dados do projeto "${editingProject.name}"` : 
                'Salve o traçado atual como um novo projeto'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 font-medium">Nome do Projeto</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Digite o nome do projeto"
                className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
              />
            </div>
            
            <ResumoProjeto
              manualPoints={manualPoints}
              totalDistance={totalDistance || 0}
              selectedBairro={selectedBairro}
              trackingMode="manual"
            />

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={() => {
                  setShowProjectDialog(false);
                  setEditingProject(null);
                  setProjectName('');
                }}
                className="flex-1 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  saveProject(false, manualPoints);
                }}
                disabled={!projectName.trim()}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                {editingProject ? 'Atualizar' : 'Salvar'} Projeto
              </Button>
            </div>
          </div>
        </DialogContent> 
      </Dialog>
      
      <ToolsDock
        active={tracking}
        onStartGPS={() => startTracking('gps')}
        onStartTouch={() => startTracking('touch')}
        onStartAR={handleARMode}
        onNewProject={startNewProject}
      />

      {tracking && showTrackingControls && (
        <ControlesRastreamento
          tracking={tracking}
          paused={paused}
          pauseTracking={pauseTracking}
          addManualPoint={addManualPoint}
          stopTracking={stopTracking}
          setShowProjectDialog={setShowProjectDialog}
          setShowProjectDetails={setShowProjectDetails}
          manualPoints={manualPoints}
          totalDistance={totalDistance}
          trackingMode="manual"
          currentPosition={currentPosition}
          currentProject={currentProject}
          snappingEnabled={snappingEnabled}
          onToggleSnapping={toggleSnapping}
          gpsAccuracy={gpsAccuracy}
          speed={speed}
          handleRemovePoints={handleRemovePoints}
          showProjectDialog={showProjectDialog}
          formatDistanceDetailed={formatDistanceDetailed}
          undoLastPoint={undoLastPoint}
          selectedStartPoint={selectedStartPoint}
          resetStartPoint={resetStartPoint}
        />
      )}

      {popupMarker && (
        <ModernPopup
          marker={popupMarker}
          onClose={() => setPopupMarker(null)}
          onEdit={(marker) => {
            setPopupMarker(null);
            setEditingMarker(marker);
            setShowEditDialog(true);
          }}
          onShare={handleShareLocation}
          onFavorite={toggleFavorite}
          onCalculateDistance={(marker) => {
            setSelectedForDistance([marker]);
            setPopupMarker(null);
          }}
          currentPosition={currentPosition}
        />
      )}

      {arMode && (
        <ARCamera
          markers={filteredMarkers}
          manualPoints={manualPoints}
          currentPosition={currentPosition}
          loadedProjects={loadedProjects}
          onClose={() => setArMode(false)}
        />
      )}

      <ImportProgressPopup
        isOpen={showImportProgress}
        progress={importProgress}
        currentStep={importCurrentStep}
        totalSteps={importTotalSteps}
        currentAction={importCurrentAction}
        success={importSuccess}
        error={importError}
        onClose={() => {
          setShowImportProgress(false);
          setImportError(null);
        }}
      />

      <ProjectReport
        isOpen={!!reportData}
        onClose={() => setReportData(null)}
        project={reportData?.project}
        mapImage={reportData?.image}
        currentUserEmail={user?.email}
      />

    <ProjectMembersDialog 
    isOpen={showMembersDialog}
    onClose={() => { 
        setShowMembersDialog(false); 
        setInspectingProject(null); 
    }}
    // Se estiver inspecionando um da lista, usa ele. Se não, usa o atual carregado.
    project={inspectingProject || currentProject}
    currentUserId={user?.id}
/>

      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".kml,.kmz"
        onChange={handleFileImport}
        className="hidden"
      />
      
      <GlowNotification 
        notification={notification} 
        onClose={() => setNotification(null)} 
      />
      
      <input
        ref={projectInputRef}
        id="project-input"
        type="file"
        accept=".kml,.kmz"
        onChange={handleProjectImport}
        className="hidden"
      />
      
      {spanSelectorInfo && (
        <SpanSelector
          currentSpans={spanSelectorInfo.currentSpans}
          onSelect={handleSpanChange}
          onClose={() => setSpanSelectorInfo(null)}
          style={{
            left: Math.min(spanSelectorInfo.x - 80, window.innerWidth - 170),
            top: spanSelectorInfo.y - 60 
          }}
        />
      )}

    </div>
  )
}

export default App