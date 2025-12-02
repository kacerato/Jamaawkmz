import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react'
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl'
import { Upload, MapPin, Ruler, X, Download, Share2, Edit2, Menu, LogOut, Heart, MapPinned, Layers, Play, Pause, Square, FolderOpen, Save, Navigation, Clock, Cloud, CloudOff, Archive, Camera, Plus, Star, LocateFixed, Info, Undo, FileText, MousePointerClick, CheckCircle, Users, Hash, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { supabase } from './lib/supabase'
// Adicione junto com os outros imports
import electricPoleIcon from './assets/electric-pole.png'; // Ajuste o caminho conforme sua pasta
import Auth from './components/Auth'
import JSZip from 'jszip'
import { Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import axios from 'axios'
import ARCamera from './components/ARCamera'
import ResumoProjeto from './components/ResumoProjeto'
import ControlesRastreamento from './components/ControlesRastreamento'
import ModernPopup from './components/ModernPopup'
import ImportProgressPopup from './components/ImportProgressPopup'
import MultipleSelectionPopup from './components/MultipleSelectionPopup'
import BairroDetectionService from './components/BairroDetectionService'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'

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
  light: { name: 'Claro', url: 'mapbox://styles/mapbox/light-v10' },
  outdoors: { name: 'Ar Livre', url: 'mapbox://styles/mapbox/outdoors-v11' },
};

// Função para gerar UUIDs
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback simples se crypto não estiver disponível
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const generateRandomColor = () => {
  const colors = [
    '#1e3a8a', '#3730a3', '#5b21b6', '#7c2d12', '#831843',
    '#0f766e', '#1e40af', '#334155', '#475569', '#6b21a8',
    '#86198f', '#9d174d', '#be185d', '#7e22ce', '#6d28d9',
    '#4338ca', '#374151', '#4b5563', '#1f2937', '#111827'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return "0".padStart(decimals + 2, '0');
  }
  return Number(value).toFixed(decimals);
};

const formatDistanceDetailed = (distanceInMeters) => {
  if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
    return "0 m";
  }
  
  const distance = Number(distanceInMeters);
  
  if (distance < 1) {
    return `${(distance * 100).toFixed(0)} cm`;
  } else if (distance < 1000) {
    return `${distance.toFixed(0)} m`;
  } else if (distance < 10000) {
    return `${(distance / 1000).toFixed(2)} km`;
  } else {
    return `${(distance / 1000).toFixed(1)} km`;
  }
};

class KalmanFilter {
  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R;
    this.Q = Q;
    this.A = A;
    this.B = B;
    this.C = C;
    this.cov = NaN;
    this.x = NaN;
  }

  filter(z, u = 0) {
    if (isNaN(this.x)) {
      this.x = (1 / this.C) * z;
      this.cov = (1 / this.C) * this.Q * (1 / this.C);
    } else {
      const predX = (this.A * this.x) + (this.B * u);
      const predCov = ((this.A * this.cov) * this.A) + this.Q;
      const K = predCov * this.C * (1 / ((this.C * predCov * this.C) + this.R));
      this.x = predX + K * (z - (this.C * predX));
      this.cov = predCov - (K * this.C * predCov);
    }
    return this.x;
  }
}

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

class RoadSnappingService {
  static async snapToRoad(lat, lng, radius = 50) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        
      );
      
      const data = await response.json();
      
      if (data && data.lat && data.lon) {
        return {
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lon),
          address: data.address,
          snapped: true
        };
      }
    } catch (error) {
      console.warn('Erro no snapping de rua:', error);
    }
    
    return { lat, lng, snapped: false };
  }

  static async snapMultiplePoints(points) {
    const snappedPoints = [];
    
    for (const point of points) {
      const snapped = await this.snapToRoad(point.lat, point.lng);
      snappedPoints.push({
        ...point,
        lat: snapped.lat,
        lng: snapped.lng,
        originalLat: point.lat,
        originalLng: point.lng
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return snappedPoints;
  }
}

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

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

// Componente Memoizado do Poste (Só renderiza se as props mudarem)
const PoleMarker = React.memo(({ point, index, color, onClick, isActive }) => {
  return (
    <Marker 
      longitude={point.lng} 
      latitude={point.lat}
      anchor="bottom"
      onClick={onClick}
    >
      <div className="pole-marker-container" style={{ willChange: 'transform' }}> {/* will-change ajuda a GPU */}
        {/* Imagem do Poste */}
        <img 
          src={electricPoleIcon} 
          alt={`Ponto ${index}`} 
          className="pole-image"
          loading="lazy" // Ajuda a não travar o carregamento inicial
          style={{ pointerEvents: 'none' }} // Melhora a rolagem
        />
        
        {/* Número do Ponto */}
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
  // Otimização agressiva: Só re-renderiza se o ID, Cor ou Estado Ativo mudar
  return (
    prevProps.point.id === nextProps.point.id &&
    prevProps.color === nextProps.color &&
    prevProps.isActive === nextProps.isActive
  );
});

// Novo componente otimizado para o Card do Projeto
const ProjectCard = React.memo(({ project, isSelected, onToggle, onLoad, onEdit, onExport, onDelete, tracking, onShare }) => {
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
              alert('Pare o rastreamento atual primeiro.');
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
            onClick={(e) => {
              e.stopPropagation();
              onShare(project);
            }}
            className="action-btn-mini w-8 px-0 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
            title={project.shared_id ? `Compartilhado: ${project.shared_id}` : "Compartilhar projeto"}
          >
            {project.shared_id ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
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
  // Esta função diz ao React quando NÃO re-renderizar
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.name === nextProps.project.name &&
    prevProps.tracking === nextProps.tracking
  );
});

// Sub-componente para o conteúdo do popup de ponto de rastreamento com efeito Glow
const TrackingPointPopupContent = ({ pointInfo, onClose, onSelectStart, selectedStartPoint, manualPoints }) => {
  const cardRef = useRef(null);
  
  // Lógica do Efeito Glow (Mouse Move)
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };
  
  // Encontra o índice real do ponto no array principal
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
      {/* Camada de Glow do Background */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.15), transparent 40%)`,
        }}
      />

      {/* Camada de Glow da Borda (Shine Border) */}
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

      {/* Conteúdo Real */}
      <div className="relative p-4 bg-slate-900/80 backdrop-blur-xl h-full rounded-2xl">
        {/* Header */}
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

        {/* Coordenadas */}
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

        {/* Botão de Ação Principal (Usar como Início) */}
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
  const [projects, setProjects] = useState([])
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
  const [mapStyle, setMapStyle] = useState('streets');
  
  const [loadedProjects, setLoadedProjects] = useState([]);
  const [showLoadedProjects, setShowLoadedProjects] = useState(false);
  const [pointPopupInfo, setPointPopupInfo] = useState(null);

  const [popupMarker, setPopupMarker] = useState(null);
  const [adjustBoundsForMarkers, setAdjustBoundsForMarkers] = useState(false);
  const [adjustBoundsForProject, setAdjustBoundsForProject] = useState(false);
  const [backupStatus, setBackupStatus] = useState('idle');
  const [arMode, setArMode] = useState(false);
  const [arPermission, setArPermission] = useState(null);

  const [importProgress, setImportProgress] = useState(0);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [importCurrentStep, setImportCurrentStep] = useState(1);
  const [importTotalSteps, setImportTotalSteps] = useState(5);
  const [importCurrentAction, setImportCurrentAction] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState(null);

  const [selectedMarkers, setSelectedMarkers] = useState([]);
  const [showBatchBairroDialog, setShowBatchBairroDialog] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showMultipleSelection, setShowMultipleSelection] = useState(false);

  const [selectedStartPoint, setSelectedStartPoint] = useState(null);

  // Novo estado para modo de entrada do rastreamento
  const [trackingInputMode, setTrackingInputMode] = useState('gps');

  // Estados para compartilhamento
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMode, setShareMode] = useState('load'); // 'load' ou 'share'
  const [shareCode, setShareCode] = useState('');
  const [sharedProjects, setSharedProjects] = useState([]);
  const [showSharedProjects, setShowSharedProjects] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [realtimeSubscription, setRealtimeSubscription] = useState(null);

  const kalmanLatRef = useRef(new KalmanFilter(0.1, 0.1));
  const kalmanLngRef = useRef(new KalmanFilter(0.1, 0.1));

  const totalDistanceAllProjects = calculateTotalDistanceAllProjects(projects);

  // FUNÇÃO ATUALIZADA: Carregar projetos do Supabase (sem compartilhados)
const loadProjectsFromSupabase = async () => {
  if (!user) return [];
  
  try {
    const { data, error } = await supabase
      .from('projetos')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    // Salva também no localStorage como backup
    if (data && data.length > 0) {
      localStorage.setItem('jamaaw_projects', JSON.stringify(data));
    }
    
    return data || [];
  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    // Fallback para localStorage
    const localProjects = localStorage.getItem('jamaaw_projects');
    return localProjects ? JSON.parse(localProjects) : [];
  }
};

  // Função para detectar bairros de projetos que ainda estão como "Vários"
  const refreshProjectNeighborhoods = async () => {
    if (!projects || projects.length === 0) return;

    // Filtra projetos que precisam de atualização (bairro 'Vários' ou vazio) e têm pontos
    const projectsToUpdate = projects.filter(p => 
      (!p.bairro || p.bairro === 'Vários') && 
      p.points && 
      p.points.length > 0
    );

    if (projectsToUpdate.length === 0) return;

    console.log(`Detectando bairros para ${projectsToUpdate.length} projetos...`);

    // Cria uma cópia dos projetos atuais para não mutar o estado diretamente
    let updatedProjectsList = [...projects];
    let hasUpdates = false;

    for (const project of projectsToUpdate) {
      try {
        // Usa o serviço existente para detectar
        const detectedBairro = await BairroDetectionService.detectBairroForProject(project.points);

        if (detectedBairro && detectedBairro !== 'Vários') {
          // Atualiza o projeto na lista local
          updatedProjectsList = updatedProjectsList.map(p => 
            p.id === project.id ? { ...p, bairro: detectedBairro } : p
          );
          
          // Atualiza no Supabase se estiver online
          if (isOnline && user && !project.id.toString().startsWith('offline_')) {
            await supabase
              .from('projetos')
              .update({ bairro: detectedBairro })
              .eq('id', project.id);
          }
          
          hasUpdates = true;
          // Pequeno delay para não bloquear a UI ou exceder limites da API
          await new Promise(resolve => setTimeout(resolve, 200)); 
        }
      } catch (error) {
        console.error(`Erro ao detectar bairro para projeto ${project.name}:`, error);
      }
    }

    if (hasUpdates) {
      setProjects(updatedProjectsList);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjectsList));
      console.log('Lista de projetos atualizada com novos bairros.');
    }
  };

  // Efeito para rodar a detecção quando abrir a lista de projetos
  useEffect(() => {
    if (showProjectsList) {
      refreshProjectNeighborhoods();
    }
  }, [showProjectsList]); // Roda sempre que showProjectsList mudar para true

  const selectPointAsStart = (point) => {
    setSelectedStartPoint(point);
    alert(`Ponto selecionado como novo início! Novos pontos serão conectados a partir daqui.`);
  };

  const resetStartPoint = () => {
    setSelectedStartPoint(null);
  };
  
  const deleteMultipleProjects = async () => {
  if (selectedProjects.length === 0) {
    alert('Nenhum projeto selecionado para excluir.');
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
    localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));

    setLoadedProjects(prev => prev.filter(p => !deletedIds.includes(p.id)));

    if (currentProject && deletedIds.includes(currentProject.id)) {
      setCurrentProject(null);
      setManualPoints([]);
      setTotalDistance(0);
      setSelectedStartPoint(null);
    }

    setSelectedProjects([]);

    alert(`${selectedProjects.length} projeto(s) excluído(s) com sucesso!`);
    
  } catch (error) {
    console.error('Erro ao excluir múltiplos projetos:', error);
    alert('Erro ao excluir projetos. Tente novamente.');
  }
};

  const calculateTotalDistanceWithBranches = (points) => {
    if (points.length < 2) return 0;
    
    let total = 0;
    
    const mainPathPoints = points.filter(point => point.connectedFrom === null);
    for (let i = 0; i < mainPathPoints.length - 1; i++) {
      total += calculateDistance(
        mainPathPoints[i].lat, 
        mainPathPoints[i].lng,
        mainPathPoints[i + 1].lat, 
        mainPathPoints[i + 1].lng
      );
    }
    
    const branchPoints = points.filter(point => point.connectedFrom !== null);
    for (const branchPoint of branchPoints) {
      const parentPoint = points.find(p => p.id === branchPoint.connectedFrom);
      if (parentPoint) {
        total += calculateDistance(
          parentPoint.lat, 
          parentPoint.lng,
          branchPoint.lat, 
          branchPoint.lng
        );
      }
    }
    
    return total;
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('jamaaw_projects');
      localStorage.removeItem('jamaaw_bairros');
      
      if (user) {
        localStorage.removeItem(`jamaaw_favorites_${user.id}`);
        localStorage.removeItem(`jamaaw_markers_${user.id}`);
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
      setSelectedMarkers([]);
      setSelectedStartPoint(null);
      
    } catch (error) {
      console.error('Erro durante logout:', error);
      setUser(null);
      setMarkers([]);
      setProjects([]);
      setSelectedMarkers([]);
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

  // Função para gerar código de compartilhamento (6 caracteres maiúsculos)
  const generateShareCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Função para atualizar projeto compartilhado
  const updateSharedProject = async (project, updates) => {
    if (!project.shared_id || !user) return;

    try {
      // Atualizar projeto principal (com shared_id)
      const { error } = await supabase
        .from('projetos')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('shared_id', project.shared_id)
        .eq('is_shared', true);

      if (error) throw error;

      // A atualização será propagada via Realtime para todos os usuários
      console.log('Projeto compartilhado atualizado');
      
    } catch (error) {
      console.error('Erro ao atualizar projeto compartilhado:', error);
      // Fallback: atualizar apenas localmente
      const updatedProjects = projects.map(p => 
        p.shared_id === project.shared_id || p.id === project.id 
          ? { ...p, ...updates } 
          : p
      );
      setProjects(updatedProjects);
    }
  };

  const saveProject = async (autoSave = false, pointsToSave = manualPoints) => {
    let finalPoints = pointsToSave;
    
    if (editingProject && finalPoints.length === 0) {
      finalPoints = editingProject.points;
    }

    if (!finalPoints || finalPoints.length === 0) {
      console.log('⚠️ Nenhum ponto para salvar');
      if (!autoSave) {
        alert('Não há pontos para salvar no projeto.');
      }
      return;
    }
    
    if (autoSave && finalPoints.length === 0) {
      return;
    }
    
    let projectNameToUse = projectName;
    
    if (editingProject && !projectName.trim()) {
      projectNameToUse = editingProject.name;
    } else if (currentProject && !projectName.trim()) {
      projectNameToUse = currentProject.name;
    } else if (autoSave && !projectName.trim() && !currentProject && !editingProject) {
      projectNameToUse = `Rastreamento ${new Date().toLocaleString('pt-BR')}`;
    }
    
    if (!projectNameToUse.trim() && finalPoints.length === 0) {
      if (!autoSave) {
        alert('Digite um nome para o projeto e certifique-se de ter pontos no traçado.');
      }
      return;
    }
    
    // CORREÇÃO AUTOMÁTICA DE IDs: Converte IDs numéricos antigos para UUIDs antes de salvar
    const sanitizedPoints = finalPoints.map(p => ({
      ...p,
      id: typeof p.id === 'number' || !isNaN(p.id) ? generateUUID() : p.id,
      // Atualiza connectedFrom se for um ID numérico
      connectedFrom: p.connectedFrom && (typeof p.connectedFrom === 'number' || !isNaN(p.connectedFrom)) 
        ? null // Reseta para evitar referências quebradas - será recalculado se necessário
        : p.connectedFrom
    }));

    const calculatedTotalDistance = calculateTotalDistanceWithBranches(sanitizedPoints) || 0;
    
    const projectData = {
      name: projectNameToUse.trim(),
      points: sanitizedPoints,
      total_distance: calculatedTotalDistance,
      bairro: selectedBairro !== 'todos' ? selectedBairro : 'Vários',
      tracking_mode: 'manual',
      updated_at: new Date().toISOString()
    };
    
    try {
      let savedProject;
      
      if (editingProject) {
        console.log('🔄 Atualizando projeto em edição:', editingProject.name);
        
        if (isOnline && user) {
          const updateData = {
            ...projectData,
            updated_at: new Date().toISOString()
          };

          // Se o projeto é compartilhado, atualiza pelo shared_id
          if (editingProject?.shared_id) {
            await updateSharedProject(editingProject, updateData);
            savedProject = { ...editingProject, ...projectData };
          } else {
            const { data, error } = await supabase
              .from('projetos')
              .update(projectData)
              .eq('id', editingProject.id)
              .eq('user_id', user.id)
              .select();
            
            if (error) throw error;
            
            // Verificação de segurança: Se o RLS falhar ou usuário não tiver permissão, data vem vazio
            if (!data || data.length === 0) {
              throw new Error("Permissão negada ou projeto não encontrado para atualização.");
            }
            
            savedProject = data[0];
          }
        } else {
          savedProject = { ...editingProject, ...projectData };
        }
        
        const updatedProjects = projects.map(p =>
          p.id === editingProject.id ? savedProject : p
        );
        setProjects(updatedProjects);
        localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
        
        // Atualiza também o projeto na camada visual (loadedProjects)
        setLoadedProjects(prev => {
          const exists = prev.find(p => p.id === savedProject.id);
          if (exists) {
            return prev.map(p => 
              p.id === savedProject.id 
                ? { ...savedProject, color: p.color } // Mantém a cor original visual
                : p
            );
          }
          return prev;
        });

        if (currentProject && currentProject.id === editingProject.id) {
          setCurrentProject(savedProject);
        }
        
        setEditingProject(null);
        
      } else if (currentProject) {
        console.log('🔄 Atualizando projeto atual:', currentProject.name);
        
        if (isOnline && user) {
          const updateData = {
            ...projectData,
            updated_at: new Date().toISOString()
          };

          // Se o projeto é compartilhado, atualiza pelo shared_id
          if (currentProject?.shared_id) {
            await updateSharedProject(currentProject, updateData);
            savedProject = { ...currentProject, ...projectData };
          } else {
            const { data, error } = await supabase
              .from('projetos')
              .update(projectData)
              .eq('id', currentProject.id)
              .eq('user_id', user.id)
              .select();
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
              throw new Error("Erro ao salvar: Retorno vazio do banco.");
            }

            savedProject = data[0];
          }
        } else {
          savedProject = { ...currentProject, ...projectData };
        }
        
        const updatedProjects = projects.map(p =>
          p.id === currentProject.id ? savedProject : p
        );
        setProjects(updatedProjects);
        localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));

        // Atualiza também o projeto na camada visual (loadedProjects)
        setLoadedProjects(prev => {
          const exists = prev.find(p => p.id === savedProject.id);
          if (exists) {
            return prev.map(p => 
              p.id === savedProject.id 
                ? { ...savedProject, color: p.color } // Mantém a cor original visual
                : p
            );
          }
          return prev;
        });
        
        setCurrentProject(savedProject);
        
      } else {
        if (isOnline && user) {
          const { data, error } = await supabase
            .from('projetos')
            .insert([{ ...projectData, user_id: user.id }])
            .select();
          
          if (error) throw error;
          savedProject = data[0];
        } else {
          savedProject = {
            ...projectData,
            id: `offline_${Date.now()}`,
            created_at: new Date().toISOString(),
            user_id: user?.id || 'offline'
          };
        }
        
        const updatedProjects = [...projects, savedProject];
        setProjects(updatedProjects);
        localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
      }
      
      if (!autoSave && !editingProject) {
        setCurrentProject(savedProject);
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
        
        alert(editingProject ? 'Projeto atualizado com sucesso!' : 'Projeto salvo com sucesso!');
      } else {
        console.log('✅ Projeto salvo automaticamente:', savedProject.name);
      }
      
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      if (!autoSave) {
        alert('Erro ao salvar projeto. Tente novamente.');
      }
    }
  };

  // Função para compartilhar um projeto
  const shareProject = async (project) => {
    if (!user || !project) return;
    
    // Se já estiver compartilhado, apenas mostra o código
    if (project.shared_id) {
      setShareCode(project.shared_id);
      setShareMode('share');
      setShowShareDialog(true);
      return;
    }
    
    setIsSharing(true);
    try {
      // Gerar um ID único para compartilhamento
      const sharedId = generateShareCode();
      
      const { error } = await supabase
        .from('projetos')
        .update({
          shared_id: sharedId,
          is_shared: true,
          shared_with: [],
          last_sync: new Date().toISOString()
        })
        .eq('id', project.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Atualizar o projeto localmente
      const updatedProject = {
        ...project,
        shared_id: sharedId,
        is_shared: true
      };

      const updatedProjects = projects.map(p => 
        p.id === project.id ? updatedProject : p
      );
      
      setProjects(updatedProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
      
      setShareCode(sharedId);
      setShareMode('share');
      setShowShareDialog(true);
      
      // Iniciar assinatura em tempo real
      setupRealtimeSubscription(sharedId);
      
      alert(`Projeto compartilhado! Código: ${sharedId}`);
      
    } catch (error) {
      console.error('Erro ao compartilhar projeto:', error);
      alert('Erro ao compartilhar projeto. Verifique sua conexão.');
    } finally {
      setIsSharing(false);
    }
  };

  // Função para carregar um projeto compartilhado
  const loadSharedProject = async () => {
    const code = shareCode.trim().toUpperCase();
    
    if (!code || code.length !== 6) {
      alert('Digite um código válido de 6 caracteres');
      return;
    }
    
    if (!user) {
      alert('Você precisa estar logado para carregar projetos compartilhados');
      return;
    }

    setIsSharing(true);
    try {
      // Buscar projeto pelo código compartilhado
      const { data, error } = await supabase
        .from('projetos')
        .select('*')
        .eq('shared_id', code)
        .eq('is_shared', true)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        alert('Projeto não encontrado. Verifique o código.');
        return;
      }

      // Verificar se já temos este projeto
      const existingProject = projects.find(p => 
        p.shared_id === code || p.original_shared_id === code
      );
      
      if (existingProject) {
        alert('Este projeto já está em sua lista');
        return;
      }

      // Criar uma cópia local do projeto compartilhado
      const newProject = {
        ...data,
        id: generateUUID(),
        user_id: user.id,
        name: `${data.name} (Compartilhado)`,
        created_at: new Date().toISOString(),
        is_shared: false,
        shared_id: null,
        original_shared_id: data.shared_id, // Mantém referência ao original
        original_owner_id: data.user_id // Guarda quem criou originalmente
      };

      // Remover campos que não devem ser duplicados
      delete newProject.updated_at;
      delete newProject.created_at;

      let savedProject;
      
      // Salvar a cópia no Supabase
      try {
        const { data: savedData, error: saveError } = await supabase
          .from('projetos')
          .insert([newProject])
          .select()
          .single();

        if (saveError) throw saveError;
        savedProject = savedData;
      } catch (saveError) {
        // Se falhar online, salva localmente
        console.log('Salvando projeto compartilhado localmente...', saveError);
        savedProject = newProject;
      }

      // Adicionar à lista de projetos
      const updatedProjects = [...projects, savedProject];
      setProjects(updatedProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));

      // Adicionar aos projetos carregados
      const projectWithColor = {
        ...savedProject,
        color: generateRandomColor(),
        points: savedProject.points.map(point => ({
          ...point,
          projectId: savedProject.id,
          projectName: savedProject.name
        }))
      };
      
      setLoadedProjects(prev => [...prev, projectWithColor]);

      // Iniciar assinatura em tempo real
      setupRealtimeSubscription(code);

      alert('✅ Projeto carregado com sucesso!');
      setShareCode('');
      setShowShareDialog(false);

    } catch (error) {
      console.error('Erro ao carregar projeto compartilhado:', error);
      alert('Erro ao carregar projeto. Tente novamente.');
    } finally {
      setIsSharing(false);
    }
  };

  // Configurar assinatura em tempo real
  const setupRealtimeSubscription = (sharedId) => {
    if (!sharedId || !isOnline) return;

    // Cancelar assinatura anterior se existir
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
    }

    // Criar nova assinatura
    const channel = supabase.channel(`shared:${sharedId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projetos',
          filter: `shared_id=eq.${sharedId}`
        },
        (payload) => {
          console.log('Mudança detectada no projeto compartilhado:', payload);
          
          // Atualizar projetos locais
          if (payload.new) {
            setProjects(prev => prev.map(project => {
              if (project.shared_id === sharedId || project.original_shared_id === sharedId) {
                return { ...project, ...payload.new };
              }
              return project;
            }));
            
            setLoadedProjects(prev => prev.map(project => {
              if (project.shared_id === sharedId || project.original_shared_id === sharedId) {
                return { 
                  ...payload.new, 
                  color: project.color || generateRandomColor() 
                };
              }
              return project;
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log(`Status da conexão realtime (${sharedId}):`, status);
      });

    setRealtimeSubscription(channel);
  };

  // Função para parar de compartilhar
  const stopSharing = async (project) => {
    if (!project || !project.shared_id) return;
    
    if (!confirm('Deseja parar de compartilhar este projeto?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projetos')
        .update({
          shared_id: null,
          is_shared: false
        })
        .eq('id', project.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Atualizar localmente
      const updatedProjects = projects.map(p => 
        p.id === project.id ? { ...p, shared_id: null, is_shared: false } : p
      );
      
      setProjects(updatedProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));

      // Remover da lista de compartilhados
      setSharedProjects(prev => prev.filter(sp => sp.shared_id !== project.shared_id));

      alert('Compartilhamento encerrado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao parar compartilhamento:', error);
      alert('Erro ao parar compartilhamento');
    }
  };

  // Função para sincronizar projeto compartilhado
  const syncSharedProject = async (project) => {
    if (!project || !project.original_shared_id) return;
    
    setIsSharing(true);
    try {
      // Buscar versão mais recente do projeto
      const { data, error } = await supabase
        .from('projetos')
        .select('*')
        .eq('shared_id', project.original_shared_id)
        .single();

      if (error) throw error;

      // Atualizar projeto local
      const updatedProject = {
        ...project,
        points: data.points,
        total_distance: data.total_distance,
        bairro: data.bairro,
        updated_at: new Date().toISOString()
      };

      // Atualizar no Supabase
      const { error: updateError } = await supabase
        .from('projetos')
        .update(updatedProject)
        .eq('id', project.id);

      if (updateError) throw updateError;

      // Atualizar estado local
      const updatedProjects = projects.map(p => 
        p.id === project.id ? updatedProject : p
      );
      
      setProjects(updatedProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));

      alert('Projeto sincronizado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao sincronizar projeto:', error);
      alert('Erro ao sincronizar projeto');
    } finally {
      setIsSharing(false);
    }
  };

  const syncOfflineProjects = async () => {
    if (!user || !isOnline) return;

    try {
      const savedProjects = localStorage.getItem('jamaaw_projects');
      if (!savedProjects) return;

      const projects = JSON.parse(savedProjects);
      
      // Filtra apenas projetos offline válidos
      const offlineProjects = projects.filter(p => 
        p && 
        p.id && 
        p.id.toString().startsWith('offline_') && 
        p.name && 
        p.points && 
        Array.isArray(p.points)
      );

      console.log(`Sincronizando ${offlineProjects.length} projetos offline...`);

      for (const project of offlineProjects) {
        try {
          // Verifica se o projeto já foi sincronizado (já existe online)
          const { data: existingProject } = await supabase
            .from('projetos')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', project.name)
            .maybeSingle();

          if (existingProject) {
            console.log(`Projeto "${project.name}" já existe online, ignorando...`);
            continue;
          }

          // Insere o projeto offline no Supabase
          const { data, error } = await supabase
            .from('projetos')
            .insert([{
              name: project.name,
              points: project.points,
              total_distance: project.totalDistance || project.total_distance || 0,
              bairro: project.bairro || 'Vários',
              tracking_mode: 'manual',
              user_id: user.id
            }])
            .select()
            .single();

          if (error) throw error;

          // Atualiza o ID local para o ID do Supabase
          const updatedProjects = projects.map(p => {
            if (p.id === project.id) {
              return { ...data, color: p.color || generateRandomColor() };
            }
            return p;
          });
          
          localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
          setProjects(updatedProjects);

          console.log(`✅ Projeto offline sincronizado: "${project.name}"`);

        } catch (projectError) {
          console.error(`❌ Erro ao sincronizar projeto "${project?.name}":`, projectError);
        }
        
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('❌ Erro geral na sincronização offline:', error);
    }
  };

  const startTracking = async (mode = 'gps') => {
    if (loadedProjects.length === 1 && loadedProjects[0].points.length > 0) {
      const project = loadedProjects[0];
      setCurrentProject(project);
      setManualPoints(project.points);
      setTotalDistance(project.totalDistance || project.total_distance || 0);
      setProjectName(project.name);
    }
    else if (currentProject && manualPoints.length > 0) {
      // Mantém o projeto atual
    }
    else {
      setManualPoints([]);
      setTotalDistance(0);
      setCurrentProject(null);
      setProjectName('');
      setSelectedStartPoint(null);
    }
    
    setTrackingInputMode(mode); // Define se é GPS ou Toque
    setTracking(true);
    setPaused(false);
    setShowTrackingControls(true);
    setShowRulerPopup(false);
    
    // Reseta filtros apenas se for GPS, ou mantém lógica de Kalman
    kalmanLatRef.current = new KalmanFilter(0.1, 0.1);
    kalmanLngRef.current = new KalmanFilter(0.1, 0.1);
  };

  const loadProject = async (project) => {
    if (!canLoadProjects()) {
      alert('Não é possível carregar projetos durante o rastreamento ativo. Pare o rastreamento atual primeiro.');
      return;
    }

    if (!project || !project.points) {
      console.error('Projeto inválido:', project);
      alert('Erro: Projeto inválido ou corrompido.');
      return;
    }

    const exists = loadedProjects.find(p => p.id === project.id);
    if (exists) {
      setLoadedProjects(prev => prev.filter(p => p.id !== project.id));
      
      if (currentProject && currentProject.id === project.id) {
        setCurrentProject(null);
        setManualPoints([]);
        setTotalDistance(0);
        setSelectedStartPoint(null);
      }
    } else {
      let bairroDetectado = project.bairro;
      if (project.bairro === 'Vários' || !project.bairro) {
        try {
          setImportCurrentAction('Detectando bairro...');
          bairroDetectado = await BairroDetectionService.detectBairroForProject(project.points);
        } catch (error) {
          console.warn('Não foi possível detectar o bairro:', error);
          bairroDetectado = 'Vários';
        }
      }

      const projectWithColor = {
        ...project,
        bairro: bairroDetectado,
        color: project.color || generateRandomColor(),
        points: project.points.map(point => ({
          ...point,
          projectId: project.id,
          projectName: project.name
        }))
      };

      setLoadedProjects(prev => [...prev, projectWithColor]);
    }

    setShowProjectsList(false);
  };
  
  const loadMultipleProjects = async () => {
  if (!canLoadProjects()) {
    alert('Não é possível carregar projetos durante o rastreamento ativo. Pare o rastreamento atual primeiro.');
    return;
  }
  
  if (selectedProjects.length === 0) {
    alert('Selecione pelo menos um projeto para carregar');
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
          setSelectedMarkers([])
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

  const deleteProjectFromSupabase = async (projectId) => {
    if (!user) return false;
    
    try {
      // Mantém o .eq('user_id', user.id) para que apenas o dono possa deletar
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

  // EFEITO ATUALIZADO: Carregar projetos
  useEffect(() => {
    const loadProjects = async () => {
      try {
        let loadedProjects = [];

        if (user) {
          if (isOnline) {
            try {
              const data = await loadProjectsFromSupabase();
              loadedProjects = data || [];
              console.log('Projetos carregados:', loadedProjects.length);
              
              // Garante que o localStorage está atualizado
              localStorage.setItem('jamaaw_projects', JSON.stringify(loadedProjects));
              
            } catch (supabaseError) {
              console.error('Erro ao carregar do Supabase:', supabaseError);
              const savedProjects = localStorage.getItem('jamaaw_projects');
              if (savedProjects) {
                loadedProjects = JSON.parse(savedProjects).filter(isValidProject);
              }
            }
          } else {
            const savedProjects = localStorage.getItem('jamaaw_projects');
            if (savedProjects) {
              loadedProjects = JSON.parse(savedProjects).filter(isValidProject);
            }
          }
        }

        setProjects(loadedProjects);
        
      } catch (error) {
        console.error('Erro crítico ao carregar projetos:', error);
        setProjects([]);
      }
    };

    loadProjects();
  }, [user, isOnline]);

  useEffect(() => {
    if (isOnline && user) {
      syncOfflineProjects();
    }
  }, [isOnline, user]);

  useEffect(() => {
    const savedBairros = localStorage.getItem('jamaaw_bairros')
    if (savedBairros) {
      setBairros(JSON.parse(savedBairros))
    }
  }, [])

  useEffect(() => {
    if (user) {
      const savedFavorites = localStorage.getItem(`jamaaw_favorites_${user.id}`)
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites))
      }
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

  const saveBairros = (newBairros) => {
    setBairros(newBairros)
    localStorage.setItem('jamaaw_bairros', JSON.stringify(newBairros))
  }

  const handleAddBairro = () => {
    if (newBairro.trim() && !bairros.includes(newBairro.trim())) {
      const updatedBairros = [...bairros, newBairro.trim()]
      saveBairros(updatedBairros)
      setNewBairro('')
      setShowAddBairro(false)
      setShowBairroManager(false)
    }
  }

  const handleRemoveBairro = (bairro) => {
    if (DEFAULT_BAIRROS.includes(bairro)) {
      alert('Não é possível remover bairros padrão.')
      return
    }
    if (confirm(`Deseja remover o bairro "${bairro}"?`)) {
      const updatedBairros = bairros.filter(b => b !== bairro)
      saveBairros(updatedBairros)
      if (selectedBairro === bairro) {
        setSelectedBairro('todos')
      }
    }
  }

  const toggleFavorite = (markerId) => {
    const newFavorites = favorites.includes(markerId)
      ? favorites.filter(id => id !== markerId)
      : [...favorites, markerId]
    
    setFavorites(newFavorites)
    if (user) {
      localStorage.setItem(`jamaaw_favorites_${user.id}`, JSON.stringify(newFavorites))
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
      } catch (error) {
      }
      
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
          try {
            await Preferences.set({
              key: `jamaaw_markers_${user.id}`,
              value: JSON.stringify(data || [])
            })
          } catch (e) {
            localStorage.setItem(`jamaaw_markers_${user.id}`, JSON.stringify(data || []))
          }
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
      let cachedMarkers = null
      try {
        const { value } = await Preferences.get({ key: `jamaaw_markers_${user.id}` })
        if (value) {
          cachedMarkers = JSON.parse(value)
        }
      } catch (e) {
        const value = localStorage.getItem(`jamaaw_markers_${user.id}`)
        if (value) {
          cachedMarkers = JSON.parse(value)
        }
      }
      
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
        
        // Garante que funcione tanto em desenvolvimento quanto após o build (produção)
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
        
        shouldOverwrite = window.confirm(`Já existe um projeto com o nome "${projectName}". Deseja sobrescrever? Clique em "OK" para sobrescrever ou "Cancelar" para usar um nome diferente.`);
        
        if (!shouldOverwrite) {
          const suggestedName = getUniqueProjectName(projectName, projects);
          const newName = prompt('Digite um novo nome para o projeto:', suggestedName);
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
            
            const batchSize = 100;
            for (let j = 0; j < coordList.length; j += batchSize) {
              const batch = coordList.slice(j, j + batchSize);
              batch.forEach(coord => {
                const [lng, lat] = coord.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                  points.push({
                    lat,
                    lng,
                    id: generateUUID(), // UUID aqui
                    timestamp: Date.now()
                  });
                }
              });
              
              const progress = 70 + (i / lineStrings.length) * 20;
              updateImportProgress(progress, 4, `Processando traçado ${i + 1}/${lineStrings.length}...`);
              
              if (batch.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }
          }
        }
      }
      
      if (points.length === 0) {
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        const totalPlacemarks = placemarks.length;
        
        for (let i = 0; i < totalPlacemarks; i++) {
          const placemark = placemarks[i];
          const coordinates = placemark.getElementsByTagName('coordinates')[0]?.textContent;
          
          if (coordinates) {
            const [lng, lat] = coordinates.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              points.push({
                lat,
                lng,
                id: generateUUID(), // UUID aqui também
                timestamp: Date.now()
              });
            }
          }
          
          const progress = 70 + (i / totalPlacemarks) * 20;
          updateImportProgress(progress, 4, `Processando marcadores ${i + 1}/${totalPlacemarks}...`);
          
          if (i % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }
      
      if (points.length === 0) {
        throw new Error('Nenhum ponto válido encontrado no arquivo KML');
      }
      
      updateImportProgress(90, 5, 'Finalizando importação...');
      
      const totalDistance = calculateTotalDistance(points);
      
      const project = {
        id: `imported_${Date.now()}`,
        name: projectName,
        points: points,
        totalDistance: totalDistance,
        total_distance: totalDistance,
        bairro: 'Importado',
        tracking_mode: 'manual',
        created_at: new Date().toISOString(),
        description: `Projeto importado de ${file.name}`
      };
      
      if (isValidProject(project)) {
        let updatedProjects;
        
        if (existingProject && shouldOverwrite) {
          updatedProjects = projects.map(p => 
            p.id === existingProject.id ? project : p
          );
        } else {
          updatedProjects = [...projects, project];
        }
        
        setProjects(updatedProjects);
        localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
        
        updateImportProgress(100, 5, 'Importação concluída!');
        setImportSuccess(true);
        
        setTimeout(() => {
          loadProject(project);
          setTimeout(() => {
            setShowImportProgress(false);
          }, 2000);
        }, 1500);
        
      } else {
        throw new Error('Projeto inválido após importação');
      }
      
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

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportProgress(0);
    setImportCurrentStep(1);
    setImportTotalSteps(4);
    setImportCurrentAction('Iniciando importação de marcações...');
    setImportSuccess(false);
    setImportError(null);
    setShowImportProgress(true);

    setUploading(true);
    try {
      updateImportProgress(20, 1, 'Lendo arquivo...');

      let kmlText;

      if (file.name.endsWith('.kmz')) {
        updateImportProgress(40, 2, 'Extraindo KML do KMZ...');
        // Garante que funcione tanto em desenvolvimento quanto após o build (produção)
const zip = new(JSZip.default || JSZip)();
        const contents = await zip.loadAsync(file);
        const kmlFile = Object.keys(contents.files).find(name => name.endsWith('.kml'));
        if (!kmlFile) {
          throw new Error('Arquivo KML não encontrado no KMZ');
        }
        kmlText = await contents.files[kmlFile].async('text');
      } else {
        updateImportProgress(40, 2, 'Lendo arquivo KML...');
        kmlText = await file.text();
      }

      if (isOnline && user) {
        updateImportProgress(60, 3, 'Limpando marcações antigas...');
        try {
          const { error } = await supabase
            .from('marcacoes')
            .delete()
            .eq('user_id', user.id);
          
          if (error && error.code !== '42P01') {
            console.error('Erro ao limpar marcações antigas:', error);
          }
        } catch (error) {
          console.error('Erro ao limpar marcações antigas:', error);
        }
      }

      setMarkers([]);

      updateImportProgress(80, 4, 'Processando novas marcações...');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const placemarks = xmlDoc.getElementsByTagName('Placemark');

      const newMarkers = [];
      const totalPlacemarks = placemarks.length;

      for (let i = 0; i < totalPlacemarks; i++) {
        const placemark = placemarks[i];
        const name = placemark.getElementsByTagName('name')[0]?.textContent || `Marcação ${i + 1}`;
        const coordinates = placemark.getElementsByTagName('coordinates')[0]?.textContent.trim();
        
        if (coordinates) {
          const [lng, lat] = coordinates.split(',').map(Number);
          
          const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
          
          const marker = {
            name,
            lat,
            lng,
            descricao: description,
            bairro: '',
            rua: '',
            fotos: []
          }

          if (isOnline) {
            const savedMarker = await saveMarkerToSupabase(marker);
            if (savedMarker) {
              newMarkers.push(savedMarker);
            } else {
              newMarkers.push({ ...marker, id: generateUUID() }); // UUID para offline
            }
          } else {
            newMarkers.push({ ...marker, id: generateUUID() }); // UUID para offline
            setSyncPending(true);
          }
        }

        const progress = 80 + (i / totalPlacemarks) * 15;
        updateImportProgress(progress, 4, `Processando ${i + 1}/${totalPlacemarks} marcações...`);

        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      setMarkers(newMarkers);
      setAdjustBoundsForMarkers(true);
      
      if (user) {
        try {
          await Preferences.set({
            key: `jamaaw_markers_${user.id}`,
            value: JSON.stringify(newMarkers)
          });
        } catch (e) {
          localStorage.setItem(`jamaaw_markers_${user.id}`, JSON.stringify(newMarkers));
        }
      }

      updateImportProgress(100, 4, 'Importação concluída!');
      setImportSuccess(true);

      setTimeout(() => {
        setShowImportProgress(false);
      }, 2000);

    } catch (error) {
      console.error('Erro ao importar arquivo:', error);
      setImportError('Erro ao importar arquivo. Verifique o formato.');
      setImportProgress(100);
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
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
          alert('Erro ao limpar marcações do servidor')
          return
        }
      }

      setMarkers([])
      setFilteredMarkers([])
      handleClearRoute()
      
      if (user) {
        try {
          await Preferences.remove({ key: `jamaaw_markers_${user.id}` })
        } catch (e) {
          localStorage.removeItem(`jamaaw_markers_${user.id}`)
        }
      }

      alert('Todas as marcações importadas foram removidas com sucesso!')
    } catch (error) {
      console.error('Erro ao limpar marcações:', error)
      alert('Erro ao limpar marcações')
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
          alert('Erro ao limpar marcações do servidor')
          return
        }
      }

      setMarkers([])
      setFilteredMarkers([])
      handleClearRoute()
      
      if (user) {
        try {
          await Preferences.remove({ key: `jamaaw_markers_${user.id}` })
        } catch (e) {
          localStorage.removeItem(`jamaaw_markers_${user.id}`)
        }
      }

      alert('Todas as marcações foram removidas com sucesso!')
    } catch (error) {
      console.error('Erro ao limpar marcações:', error)
      alert('Erro ao limpar marcações')
    }
  }

  const handleExport = () => {
    if (markers.length === 0) {
      alert('Não há marcações para exportar.')
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
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '&': return '&amp;'
        case '\'': return '&apos;'
        case '"': return '&quot;'
        default: return c
      }
    })
  }

 // App.jsx
const downloadKML = async (kmlContent, filename) => {
  try {
    console.log('Iniciando download...', filename);
    
    if (Capacitor.getPlatform() === 'web') {
      // Lógica Web
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
      // Lógica Android/iOS
      await Filesystem.writeFile({
        path: filename,
        data: kmlContent,
        directory: Directory.Documents,
        encoding: 'utf-8',
      });
      
      alert(`Arquivo salvo em Documentos: ${filename}`);
    }
  } catch (error) {
    console.error('Erro fatal no download:', error);
    alert('Erro ao salvar o arquivo. Verifique as permissões.');
  }
};

  const getRouteFromAPI = async (start, end) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
      )
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates
        return coordinates.map(coord => [coord[1], coord[0]])
      }
      return null
    } catch (error) {
      console.error('Erro ao obter rota:', error)
      return null
    }
  }

  const calculateDistanceMatrix = async (coordinates) => {
    try {
      const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
      const response = await fetch(
        `https://router.project-osrm.org/table/v1/driving/${coordsString}?annotations=distance`
      )
      const data = await response.json()
      
      if (data.code === 'Ok') {
        return data.distances
      }
      return null
    } catch (error) {
      console.error('Erro ao calcular matriz de distâncias:', error)
      return null
    }
  }

  const handleCalculateDistance = async () => {
    if (selectedForDistance.length !== 2) {
      alert('Selecione exatamente 2 marcadores')
      return
    }

    setCalculatingRoute(true)
    const [m1, m2] = selectedForDistance

    const route = await getRouteFromAPI([m1.lng, m1.lat], [m2.lng, m2.lat])
    
    if (route) {
      setRouteCoordinates(route)
      
      const coordinates = [
        [m1.lng, m1.lat],
        [m2.lng, m2.lat]
      ]
      const distanceMatrix = await calculateDistanceMatrix(coordinates)
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
      setRouteCoordinates([[m1.lat, m1.lng], [m2.lat, m2.lng]])
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
      alert('É necessário ter pelo menos 2 marcadores')
      return
    }

    setCalculatingRoute(true)

    const allCoordinates = markers.map(m => [m.lng, m.lat])
    
    try {
      const coordsString = allCoordinates.map(c => `${c[0]},${c[1]}`).join(';')
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`
      )
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates
        const routeCoords = coordinates.map(coord => [coord[1], coord[0]])
        setRouteCoordinates(routeCoords)
        
        const distance = data.routes[0].distance
        setDistanceResult({
          type: 'todas',
          distance: distance.toFixed(2),
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
    if (marker === 'all') {
      if (selectedMarkers.length === markers.length) {
        setSelectedMarkers([]);
      } else {
        setSelectedMarkers([...markers]);
      }
      return;
    }
    
    setSelectedMarkers(prev => {
      const exists = prev.find(m => m.id === marker.id)
      if (exists) {
        return prev.filter(m => m.id !== marker.id)
      } else {
        return [...prev, marker]
      }
    })
  }

  const handleBatchBairroUpdate = async (bairro) => {
    if (!bairro || selectedMarkers.length === 0) return;

    try {
      const updatedMarkers = markers.map(marker => 
        selectedMarkers.some(selected => selected.id === marker.id) 
          ? { ...marker, bairro }
          : marker
      );

      setMarkers(updatedMarkers);
      
      if (isOnline && user) {
        for (const marker of selectedMarkers) {
          await updateMarkerInSupabase({ ...marker, bairro });
        }
      }

      setSelectedMarkers([]);
      setShowBatchBairroDialog(false);
      setShowMultipleSelection(false);
      alert(`${selectedMarkers.length} marcadores atualizados para o bairro ${bairro}`);
    } catch (error) {
      console.error('Erro ao atualizar marcadores em massa:', error);
      alert('Erro ao atualizar marcadores');
    }
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
    setLoadedProjects(prev => prev.filter(p => p.id !== projectId));
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
        alert('Erro ao salvar alterações')
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
          alert('Erro ao deletar marcação')
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
    const url = `https://www.google.com/maps?q=${marker.lat},${marker.lng}`
    if (navigator.share) {
      navigator.share({
        title: marker.name,
        text: `Confira esta localização: ${marker.name}`,
        url: url
      })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copiado para a área de transferência!')
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

  // 1. ATUALIZE A FUNÇÃO addPoint
  const addPoint = (position) => {
    const newPoint = {
      ...position,
      id: generateUUID(), // AGORA GERA UUID
      timestamp: Date.now(),
      connectedFrom: selectedStartPoint ? selectedStartPoint.id : null
    }
    
    setManualPoints(prev => {
      const updatedPoints = [...prev, newPoint]
      const newTotalDistance = calculateTotalDistanceWithBranches(updatedPoints);
      setTotalDistance(newTotalDistance);
      return updatedPoints
    })
    
    if (selectedStartPoint) {
      setSelectedStartPoint(newPoint);
    }
  }

  // Substitua a função undoLastPoint existente por esta:
const undoLastPoint = () => {
  if (manualPoints.length > 0) {
    // 1. Identifica o ponto que será removido
    const pointToRemove = manualPoints[manualPoints.length - 1];
    
    // 2. Cria a nova lista sem ele
    const newPoints = manualPoints.slice(0, -1);
    
    // 3. Atualiza a lista e a distância
    setManualPoints(newPoints);
    const newTotalDistance = calculateTotalDistanceWithBranches(newPoints);
    setTotalDistance(newTotalDistance);
    
    // 4. CORREÇÃO DO TRAÇADO:
    // Se o ponto removido era o "Ativo" (onde o próximo se conectaria),
    // precisamos mover o "Ativo" para trás.
    if (selectedStartPoint && selectedStartPoint.id === pointToRemove.id) {
      if (newPoints.length > 0) {
        // Tenta encontrar o "Pai" do ponto removido (para manter a lógica de ramificação)
        const parentPoint = pointToRemove.connectedFrom ?
          newPoints.find(p => p.id === pointToRemove.connectedFrom) :
          null;
        
        // Se tiver pai, volta para o pai. Se não, volta para o último ponto da lista.
        const newActivePoint = parentPoint || newPoints[newPoints.length - 1];
        
        setSelectedStartPoint(newActivePoint);
        
        // Feedback visual opcional
        // console.log("Voltando conexão para:", newActivePoint.id);
      } else {
        // Se apagou tudo, reseta o ponto inicial
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

  const deleteProject = async (projectId) => {
    if (!confirm('Tem certeza que deseja deletar este projeto?')) {
      return;
    }

    try {
      if (isOnline && user && !projectId.toString().startsWith('offline_')) {
        const { error } = await supabase
          .from('projetos')
          .delete()
          .eq('id', projectId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
      
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(null);
        setManualPoints([]);
        setTotalDistance(0);
        setSelectedStartPoint(null);
      }
      
      if (editingProject && editingProject.id === projectId) {
        setEditingProject(null);
      }
      
      alert('Projeto deletado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao deletar projeto:', error);
      alert('Erro ao deletar projeto. Tente novamente.');
    }
  };

const exportProjectAsKML = (project = currentProject) => {
  if (!project) return;
  
  // Pequeno delay para garantir que a UI não trave
  setTimeout(() => {
    // Cria a string de coordenadas para a linha única
    const coordinatesString = project.points
      .map(point => `${point.lng},${point.lat},0`)
      .join('\n          ');
    
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(project.name)}</name>
    <description>Traçado via Jamaaw App - Total: ${project.points.length} pontos</description>
    
    <Style id="trailStyle">
      <LineStyle>
        <color>ff1e3a8a</color>
        <width>4</width>
      </LineStyle>
    </Style>

    <Placemark>
      <name>Traçado - ${escapeXml(project.name)}</name>
      <styleUrl>#trailStyle</styleUrl>
      <LineString>
        <coordinates>
          ${coordinatesString}
        </coordinates>
      </LineString>
    </Placemark>

    ${project.points.map((point, index) => `
    <Placemark>
      <name>${index + 1}</name>
      <description>${escapeXml(point.descricao || '')}</description>
      <Point>
        <coordinates>${point.lng},${point.lat},0</coordinates>
      </Point>
    </Placemark>
    `).join('')}

  </Document>
</kml>`;
    
    const friendlyName = project.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    downloadKML(kml, `projeto_${friendlyName}.kml`);
  }, 100);
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
      alert('Localização atual ainda não disponível.');
    }
  };

  const handleARMode = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Seu navegador não suporta acesso à câmera para realidade aumentada.');
      return;
    }

    if (!currentPosition) {
      alert('Aguardando localização GPS... Tente novamente em alguns segundos.');
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
        alert('Permissão da câmera negada. Ative as permissões da câmera nas configurações do seu navegador.');
      } else if (error.name === 'NotFoundError') {
        alert('Nenhuma câmera traseira encontrada. O modo AR funciona melhor com câmera traseira.');
      } else {
        alert('Não foi possível acessar a câmera: ' + error.message);
      }
      
      setArPermission('denied');
    }
  };

  // Efeito para carregar projetos compartilhados
  useEffect(() => {
    const loadSharedProjects = async () => {
      if (!user) return;
      
      try {
        // Buscar projetos compartilhados do usuário
        const { data, error } = await supabase
          .from('projetos')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_shared', true);

        if (error) throw error;

        // Configurar subscriptions para cada projeto compartilhado
        data.forEach(project => {
          if (project.shared_id) {
            setupRealtimeSubscription(project.shared_id);
          }
        });

      } catch (error) {
        console.error('Erro ao carregar projetos compartilhados:', error);
      }
    };

    if (user && isOnline) {
      loadSharedProjects();
    }
  }, [user, isOnline]);

  // Efeito para limpar subscription ao desmontar
  useEffect(() => {
    return () => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
      }
    };
  }, [realtimeSubscription]);

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
          cursor={tracking && trackingInputMode === 'touch' && !paused ? 'crosshair' : 'auto'} // Muda o cursor para mira
          onClick={async (e) => { // Adicione async aqui
            // Lógica para adicionar ponto por toque COM SNAPPING
            if (tracking && trackingInputMode === 'touch' && !paused) {
              const { lat, lng } = e.lngLat;
              
              // Feedback visual imediato (opcional, ou aguarda o snap)
              
              if (snappingEnabled) {
                // Tenta alinhar à rua
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
                // Modo sem alinhamento
                addPoint({ lat, lng });
              }
              return;
            }

            // Lógica padrão (fechar popups se clicar fora)
            // setPopupMarker(null); 
          }}
        >
          <NavigationControl position="top-right" />

          {filteredMarkers.map(marker => (
            <Marker
              key={marker.id}
              longitude={marker.lng}
              latitude={marker.lat}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupMarker(marker);
              }}
              color={selectedMarkers.some(m => m.id === marker.id) ? '#06B6D4' : (marker.color || '#FF0000')}
            />
          ))}

          {/* 1. Renderização das LINHAS (GeoJSON é rápido, não precisa mudar muito) */}
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
                  'line-width': 4,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          ))}

          {/* 2. Renderização dos POSTES OTIMIZADA */}
          {/* Usamos useMemo aqui implicitamente ao separar a lógica */}
          {loadedProjects.map(project => (
            <React.Fragment key={`markers-${project.id}`}>
              {project.points.map((point, index) => (
                <PoleMarker
                  key={point.id}
                  point={point}
                  index={index + 1}
                  color={project.color}
                  isActive={false} // Projetos carregados geralmente não têm "ponto ativo" de edição
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setPointPopupInfo({
                      point,
                      pointNumber: index + 1,
                      projectName: project.name,
                      totalPoints: project.points.length,
                      color: project.color,
                      isManualPoint: false
                    });
                  }}
                />
              ))}
            </React.Fragment>
          ))}

          {manualPoints.length > 0 && (
            <Source 
              id="manual-route" 
              type="geojson" 
              data={{
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: manualPoints
                        .filter(point => point.connectedFrom === null)
                        .map(point => [point.lng, point.lat])
                    }
                  },
                  ...manualPoints
                    .filter(point => point.connectedFrom !== null)
                    .map(point => {
                      const parentPoint = manualPoints.find(p => p.id === point.connectedFrom);
                      if (parentPoint) {
                        return {
                          type: 'Feature',
                          geometry: {
                            type: 'LineString',
                            coordinates: [
                              [parentPoint.lng, parentPoint.lat],
                              [point.lng, point.lat]
                            ]
                          }
                        };
                      }
                      return null;
                    })
                    .filter(feature => feature !== null)
                ]
              }}
            >
              <Layer
                type="line"
                paint={{
                  'line-color': '#1e3a8a',
                  'line-width': 4,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          )}

          {/* Renderização dos pontos manuais com PoleMarker otimizado */}
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

          {/* SUBSTITUA O BLOCO ANTIGO POR ESTE NOVO */}
          {pointPopupInfo && pointPopupInfo.isManualPoint && (
            <Popup
              longitude={pointPopupInfo.point.lng}
              latitude={pointPopupInfo.point.lat}
              onClose={() => setPointPopupInfo(null)}
              className="modern-popup"
              closeButton={false}
              anchor="bottom" // Mudado para bottom para o card ficar acima do ponto
              offset={20}     // Um pouco mais de offset para não colar no marcador
              maxWidth="300px"
            >
              {/* Usa o novo componente com o design Glow, sem descrição */}
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
              anchor="bottom" // Mudado para bottom para não cobrir o ponto
              offset={15}
            >
              {/* Container Principal com design "Glass" escuro */}
              <div className="w-[260px] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Cabeçalho com a cor do projeto */}
                <div className="relative p-3 flex items-center justify-between bg-slate-800/50 border-b border-slate-700/50">
                  {/* Barra de cor lateral decorativa */}
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

                {/* Corpo do Popup */}
                <div className="p-3 space-y-3">
                  
                  {/* Destaque do Número do Ponto */}
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

                  {/* Grid de Coordenadas Técnicas */}
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

                  {/* Botão de Ação Rápida (Copiar) */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full h-7 text-xs border border-dashed border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition-all"
                    onClick={() => {
                      const coords = `${pointPopupInfo.point.lat}, ${pointPopupInfo.point.lng}`;
                      navigator.clipboard.writeText(coords);
                      // Feedback visual rápido poderia ser adicionado aqui
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
      </div>

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="bg-gradient-to-br from-slate-800 to-slate-700 backdrop-blur-sm hover:from-slate-700 hover:to-slate-600 text-white shadow-xl border border-slate-600/50 transition-all-smooth hover-lift"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 bg-slate-800 border-slate-700 text-white shadow-2xl flex flex-col slide-in-menu">
            <SheetHeader className="p-6 bg-slate-900 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <MapPinned className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <SheetTitle className="text-white text-lg font-bold">Jamaaw App</SheetTitle>
                  <p className="text-cyan-400 text-sm">Gerenciador Profissional</p>
                </div>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                
                <div className="menu-section">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Status do Sistema</span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isOnline ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{projects.length} projetos</span>
                    <span>{markers.length} marcações</span>
                    <span>{loadedProjects.length} carregados</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="menu-section-title">Navegação</h3>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 h-12 menu-button"
                    onClick={() => setShowRulerPopup(true)}
                  >
                    <Ruler className="w-5 h-5 mr-3 text-cyan-400" />
                    Ferramentas de Medição
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 h-12 menu-button"
                    onClick={() => {
                      if (tracking) {
                        alert('Não é possível gerenciar projetos durante o rastreamento.');
                        return;
                      }
                      setShowProjectsList(true);
                    }}
                    disabled={tracking}
                  >
                    <FolderOpen className="w-5 h-5 mr-3 text-blue-400" />
                    Meus Projetos
                    <span className="ml-auto bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs">
                      {projects.length}
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 h-12 menu-button"
                    onClick={() => projectInputRef.current?.click()}
                    disabled={tracking}
                  >
                    <Upload className="w-5 h-5 mr-3 text-green-400" />
                    Importar Projeto (KML)
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 h-12 menu-button"
                    onClick={() => {
                      setShareMode('load'); // Sempre abre no modo "carregar" pelo menu
                      setShareCode('');
                      setShowShareDialog(true);
                    }}
                  >
                    <Share2 className="w-5 h-5 mr-3 text-purple-400" />
                    Projetos Compartilhados
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 h-12 menu-button"
                    onClick={handleARMode}
                  >
                    <Camera className="w-5 h-5 mr-3 text-purple-400" />
                    Realidade Aumentada
                  </Button>
                </div>

                <div className="space-y-2">
                  <h3 className="menu-section-title">Ações Rápidas</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="bg-slate-700 hover:bg-slate-600 text-white h-10 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Importar
                    </Button>
                    
                    <Button
                      size="sm"
                      className="bg-slate-700 hover:bg-slate-600 text-white h-10 text-xs"
                      onClick={handleExport}
                      disabled={markers.length === 0}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Exportar
                    </Button>
                  </div>

                  {markers.length > 0 && (
                    <Button
                      size="sm"
                      className="w-full bg-red-500 hover:bg-red-600 text-white h-10 text-xs"
                      onClick={handleClearImportedMarkers}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Limpar Marcações
                    </Button>
                  )}
                </div>

                {selectedMarkers.length > 0 && (
                  <div className="menu-section">
                    <h3 className="menu-section-title">
                      {selectedMarkers.length} Marcadores Selecionados
                    </h3>
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                        onClick={() => setShowMultipleSelection(true)}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Gerenciar Seleção
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-slate-600 text-gray-400 hover:text-white"
                        onClick={() => setSelectedMarkers([])}
                      >
                        Limpar Seleção
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="menu-section-title">Filtros</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowBairroManager(true)}
                      className="h-6 text-xs text-cyan-400"
                    >
                      Gerenciar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <select
                      value={selectedBairro}
                      onChange={(e) => setSelectedBairro(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="todos">Todos os bairros</option>
                      {bairros.map(bairro => (
                        <option key={bairro} value={bairro}>{bairro}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-white">Apenas favoritos</span>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={showFavoritesOnly} 
                        onChange={() => setShowFavoritesOnly(!showFavoritesOnly)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="menu-section">
                  <h3 className="menu-section-title">Estatísticas</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-value">{markers.length}</div>
                      <div className="stat-label">Marcações</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{projects.length}</div>
                      <div className="stat-label">Projetos</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{loadedProjects.length}</div>
                      <div className="stat-label">Carregados</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">
                        {formatDistanceDetailed(totalDistanceAllProjects)}
                      </div>
                      <div className="stat-label">Distância Total</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="border-t border-slate-700 p-4 bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                    <p className={`text-xs ${isOnline ? 'text-green-400' : 'text-orange-400'}`}>
                      {isOnline ? 'Conectado' : 'Modo Offline'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 flex items-center gap-2 logout-button"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Sair</span>
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
              alert('Não é possível gerenciar projetos durante o rastreamento. Pare o rastreamento atual primeiro.');
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
          className="bg-gradient-to-br from-slate-800 to-slate-700 backdrop-blur-sm hover:from-slate-700 hover:to-slate-600 text-white shadow-xl border border-slate-600/50 transition-all-smooth hover-lift"
          onClick={() => setShowRulerPopup(!showRulerPopup)}
          data-testid="tools-button"
        >
          <Star className="w-5 h-5" />
        </Button>
      </div>

      <div className="absolute bottom-40 right-4 z-10">
        <Button
          size="icon"
          className="bg-white/80 backdrop-blur-sm hover:bg-white text-slate-900 shadow-xl border border-slate-200/50 transition-all-smooth hover-lift rounded-full w-12 h-12"
          onClick={() => setShowMultipleSelection(true)}
          title="Seleção Múltipla"
        >
          <Layers className="w-6 h-6" />
        </Button>
      </div>

      <MultipleSelectionPopup
        isOpen={showMultipleSelection}
        onClose={() => setShowMultipleSelection(false)}
        markers={markers}
        selectedMarkers={selectedMarkers}
        onToggleMarker={toggleMarkerSelection}
        onBatchBairroUpdate={handleBatchBairroUpdate}
        bairros={bairros}
      />

      {/* Diálogo de Compartilhamento */}
      <Dialog open={showShareDialog} onOpenChange={(open) => {
        setShowShareDialog(open);
        if (!open) {
          setShareMode('load');
          setShareCode('');
        }
      }}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              {shareMode === 'share' ? 'Compartilhar Projeto' : 'Carregar Projeto Compartilhado'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              {shareMode === 'share' 
                ? 'Compartilhe este código com outras pessoas' 
                : 'Cole o código de 6 dígitos para carregar um projeto'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {shareMode === 'share' ? (
              <>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <div className="text-center mb-3">
                    <div className="text-xs text-gray-400 mb-1">Código do Projeto</div>
                    <div className="text-2xl font-mono font-bold text-cyan-400 tracking-wider bg-slate-900 p-3 rounded">
                      {shareCode}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      Compartilhe este código com outras pessoas para que elas possam acessar e atualizar o projeto em tempo real.
                    </p>
                    <p className="text-xs text-gray-400">
                      As alterações serão sincronizadas automaticamente entre todos os usuários.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(shareCode);
                      alert('Código copiado para a área de transferência!');
                    }}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Copiar Código
                  </Button>
                  <Button
                    onClick={() => {
                      setShareMode('load');
                      setShareCode('');
                    }}
                    variant="outline"
                    className="border-slate-700 text-gray-400 hover:text-white"
                  >
                    Carregar Outro
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300 font-medium">Código do Projeto (6 dígitos)</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={shareCode}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          setShareCode(value.slice(0, 6));
                        }}
                        placeholder="Ex: ABC123"
                        className="bg-slate-800/50 border-slate-700 text-white text-center text-lg tracking-wider flex-1"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Digite o código de 6 letras/números que você recebeu
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={loadSharedProject}
                      disabled={!shareCode || shareCode.length !== 6 || isSharing}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    >
                      {isSharing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Carregando...
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Carregar Projeto
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setShareMode('share');
                        setShareCode('');
                      }}
                      variant="outline"
                      className="border-slate-700 text-gray-400 hover:text-white"
                    >
                      Compartilhar Meu
                    </Button>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-700/50">
                  <Button
                    onClick={() => setShowSharedProjects(true)}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Ver Meus Projetos Compartilhados
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Projetos Compartilhados */}
      <Dialog open={showSharedProjects} onOpenChange={setShowSharedProjects}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 w-[95vw] max-w-2xl shadow-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Projetos Compartilhados
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Projetos que você compartilhou ou que foram compartilhados com você
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              {/* Seção: Projetos que você compartilhou */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Compartilhados por Você
                </h3>
                
                {projects.filter(p => p.shared_id).length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Share2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Você ainda não compartilhou nenhum projeto</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.filter(p => p.shared_id).map(project => (
                      <div key={project.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium truncate">{project.name}</span>
                            <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                              Ativo
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-3">
                            <span>{project.points?.length || 0} pontos</span>
                            <span>•</span>
                            <span>Código: {project.shared_id}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(project.shared_id);
                              alert('Código copiado!');
                            }}
                            className="text-xs h-7 bg-slate-700 hover:bg-slate-600"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Copiar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => stopSharing(project)}
                            className="text-xs h-7 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Seção: Projetos compartilhados com você */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Compartilhados com Você
                </h3>
                
                {projects.filter(p => p.original_shared_id).length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum projeto compartilhado com você</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.filter(p => p.original_shared_id).map(project => (
                      <div key={project.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium truncate">{project.name}</span>
                            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                              Sincronizado
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Original: {project.original_shared_id}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => syncSharedProject(project)}
                            disabled={isSharing}
                            className="text-xs h-7 bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          >
                            {isSharing ? (
                              <>Atualizando...</>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Sincronizar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => loadProject(project)}
                            className="text-xs h-7 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 pt-4 border-t border-slate-700/50">
            <Button
              onClick={() => setShowSharedProjects(false)}
              className="flex-1 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setShowSharedProjects(false);
                setShowShareDialog(true);
              }}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar Novo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!tracking && showRulerPopup && (
        <div className="absolute top-20 right-4 z-10">
          <Card className="bg-gradient-to-br from-slate-800/95 to-slate-700/95 backdrop-blur-sm border-slate-600/50 shadow-2xl text-white w-80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-cyan-400" />
                  Ferramentas de Medição
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRulerPopup(false)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Ferramentas profissionais de medição</p>
              </CardHeader>
            
            <CardContent
            className="space-y-4">
              <Button
                onClick={handleARMode}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-medium py-3 text-base"
              >
                <Camera className="w-4 h-4 mr-2" />
                Realidade Aumentada
              </Button>

              <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Modo Ativo:</span>
                    <span className="font-medium text-cyan-400">
                      Manual (GPS)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Precisão:</span>
                    <span className="font-medium text-cyan-400">
                      Alta (GPS)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Melhor para:</span>
                    <span className="font-medium text-cyan-400">
                      Pontos exatos em campo
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 mt-2">
                <Button
                  onClick={startNewProject}
                  variant="outline"
                  className="w-full h-10 border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Novo Projeto
                </Button>
              </div>

              <Button
                onClick={() => startTracking('gps')}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3 text-base mb-2"
              >
                <Navigation className="w-4 h-4 mr-2" />
                {loadedProjects.length === 1 ? 
                  `Continuar (GPS) "${loadedProjects[0].name}"` : 
                  currentProject && manualPoints.length > 0 ? 
                    `Continuar (GPS) "${currentProject.name}"` : 
                    'Rastreamento via GPS'
                }
              </Button>

              <Button
                onClick={() => startTracking('touch')}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium py-3 text-base"
              >
                <MousePointerClick className="w-4 h-4 mr-2" />
                Rastreamento por Toque
              </Button>

              <div className="text-xs text-gray-400 text-center mt-1 mb-3">
                Toque no mapa para desenhar o trajeto manualmente
              </div>

              {(loadedProjects.length === 1 || (currentProject && manualPoints.length > 0)) && (
                <Button
                  onClick={startNewProject}
                  variant="outline"
                  className="w-full mt-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Iniciar Projeto Completamente Novo
                </Button>
              )}

              {projects.length > 0 && (
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-xs text-gray-400 mb-2">Projetos Recentes</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {projects.slice(0, 2).map(project => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                        onClick={() => loadProject(project)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{project.name}</p>
                          <p className="text-xs text-gray-400">
                            {safeToFixed(((project.totalDistance || project.total_distance) || 0) / 1000, 2)} km • {project.points.length} pontos
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportProjectAsKML(project);
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-white font-medium truncate text-sm mb-1">{currentProject.name}</p>
                <p className="text-cyan-400 text-xs">
                  Modo Manual
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 font-bold text-sm">
                    {formatDistanceDetailed(currentProject.totalDistance || currentProject.total_distance || 0)}
                  </div>
                  <div className="text-gray-400">Distância</div>
                </div>
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 font-bold">{currentProject.points?.length || 0}</div>
                  <div className="text-gray-400">Pontos</div>
                </div>
              </div>

              {currentProject.bairro && currentProject.bairro !== 'Vários' && (
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 text-xs font-medium">Bairro</div>
                  <div className="text-white text-sm">{currentProject.bairro}</div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    handleRemovePoints();
                  }}
                  size="sm"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs h-7"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    exportProjectAsKML(currentProject);
                    setShowProjectDetails(false);
                  }}
                  size="sm"
                  className="flex-1 border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs h-7"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Exportar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    <Dialog open={showProjectsList} onOpenChange={setShowProjectsList}>
  <DialogContent className="bg-slate-900/95 backdrop-blur-md text-white border-slate-700/50 w-[95vw] max-w-4xl mx-auto shadow-2xl max-h-[85vh] overflow-hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000] p-0 gap-0 rounded-xl flex flex-col">
    
    <div className="p-4 border-b border-slate-800 bg-slate-900/50 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Meus Projetos
          <span className="text-slate-500 text-sm font-normal ml-2">({projects.length})</span>
        </DialogTitle>
        <DialogDescription className="text-gray-400 text-xs mt-1">
          Gerencie seus traçados salvos
        </DialogDescription>
      </div>

      {projects.length > 0 && (
        <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
          <div className="px-3 text-xs text-gray-400 border-r border-slate-700 mr-1">
            {selectedProjects.length} <span className="hidden sm:inline">selecionados</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadMultipleProjects}
            disabled={selectedProjects.length === 0 || tracking}
            className="h-7 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
            title="Carregar Selecionados"
          >
            <Play className="w-3 h-3 mr-1.5" /> Carregar
          </Button>
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <Button
            size="sm"
            variant="ghost"
            onClick={deleteMultipleProjects}
            disabled={selectedProjects.length === 0}
            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="Excluir Selecionados"
          >
            <X className="w-3 h-3 mr-1.5" /> Excluir
          </Button>
        </div>
      )}
    </div>

    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/30">
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center p-6">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-700">
            <FolderOpen className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-400">Nenhum projeto ainda</h3>
          <p className="text-slate-500 text-sm mt-2 max-w-xs">
            Inicie um rastreamento manual e salve-o para vê-lo aqui.
          </p>
          <Button
            onClick={() => {
              setShowProjectsList(false);
              setShowRulerPopup(true);
            }}
            className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            Criar Novo Projeto
          </Button>
        </div>
      ) : (
        <div className="projects-grid-container">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={selectedProjects.some(p => p.id === project.id)}
              onToggle={toggleProjectSelection}
              onLoad={(p) => {
                loadProject(p);
                setShowProjectsList(false); // Fecha o modal imediatamente
              }}
              onEdit={(p) => {
                setEditingProject(p);
                setProjectName(p.name);
                setShowProjectDialog(true);
              }}
              onExport={exportProjectAsKML}
              onDelete={deleteProject}
              onShare={shareProject}
              tracking={tracking}
            />
          ))}
        </div>
      )}
    </div>
    
    <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-3">
      <Button
        variant="outline"
        onClick={() => {
          setShowProjectsList(false);
          setSelectedProjects([]);
        }}
        className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        Fechar
      </Button>
      <Button
        onClick={() => {
          setShowProjectsList(false);
          setShowRulerPopup(true);
        }}
        className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
      >
        <Plus className="w-4 h-4 mr-2" />
        Novo Projeto
      </Button>
    </div>
  </DialogContent>
</Dialog>

      <Dialog open={showLoadedProjects} onOpenChange={setShowLoadedProjects}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 w-[95vw] max-w-2xl mx-auto shadow-2xl max-h-[80vh] overflow-hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000]">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Projetos Carregados ({loadedProjects.length})
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Projetos ativos no mapa - Clique para ver detalhes
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
              {loadedProjects.map(project => (
                <div
                  key={project.id}
                  className="bg-slate-800 rounded-lg border border-slate-700 hover:border-cyan-500 transition-all group relative overflow-hidden"
                >
                  <div 
                    className="h-2 w-full"
                    style={{ backgroundColor: project.color }}
                  ></div>
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg mb-1 truncate">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>{project.points.length} pontos</span>
                          <span>•</span>
                          <span>manual</span>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLoadedProject(project.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-cyan-400 font-bold text-xl">
                          {project.points.length}
                        </div>
                        <div className="text-gray-400 text-xs">Pontos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-green-400 font-bold text-xl">
                          {formatDistanceDetailed(project.totalDistance || project.total_distance || 0)}
                        </div>
                        <div className="text-gray-400 text-xs">Distância</div>
                      </div>
                      <div className="text-center">
                        <div className="text-purple-400 font-bold text-xl">
                          {project.bairro || 'Vários'}
                        </div>
                        <div className="text-gray-400 text-xs">Bairro</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setPointPopupInfo({ 
                            project, 
                            showOverview: true 
                          });
                          setShowLoadedProjects(false);
                        }}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        Detalhes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportProjectAsKML(project)}
                        className="border-green-500 text-green-400 hover:bg-green-500/20 text-xs"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {loadedProjects.length > 0 && (
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 text-sm font-medium">Distância Total:</span>
                  <span className="text-white font-bold text-lg">
                    {formatDistanceDetailed(totalDistanceAllProjects)}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Soma de todos os projetos carregados
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-4 border-t border-slate-700/50">
            <Button
              onClick={() => setShowLoadedProjects(false)}
              className="flex-1 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setShowLoadedProjects(false);
                setShowProjectsList(true);
              }}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Adicionar Projetos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchBairroDialog} onOpenChange={setShowBatchBairroDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md mx-auto shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold">
              Definir Bairro para {selectedMarkers.length} Marcadores
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select onValueChange={handleBatchBairroUpdate}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue placeholder="Selecione um bairro" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white z-[10000]">
                {bairros.map(bairro => (
                  <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowBatchBairroDialog(false)}
                className="flex-1 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleBatchBairroUpdate(selectedBairro !== 'todos' ? selectedBairro : bairros[0])}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="absolute bottom-24 right-4 z-10">
        <Button
          size="icon"
          className="bg-white/80 backdrop-blur-sm hover:bg-white text-slate-900 shadow-xl border border-slate-200/50 transition-all-smooth hover-lift rounded-full w-12 h-12"
          onClick={centerMapOnUser}
          title="Centralizar no Local Atual"
        >
          <LocateFixed className="w-6 h-6" />
        </Button>
      </div>

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
          selectedMarkers={selectedMarkers}
          setSelectedMarkers={setSelectedMarkers}
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

      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".kml,.kmz"
        onChange={handleFileImport}
        className="hidden"
      />

      <input
        ref={projectInputRef}
        id="project-input"
        type="file"
        accept=".kml,.kmz"
        onChange={handleProjectImport}
        className="hidden"
      />
    </div>
  )
}

export default App