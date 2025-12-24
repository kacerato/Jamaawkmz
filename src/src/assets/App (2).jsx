import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { Upload, MapPin, Ruler, X, Download, Share2, Edit2, Menu, LogOut, Heart, MapPinned, Layers, Play, Pause, Square, FolderOpen, Save, Navigation, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import JSZip from 'jszip'
import L from 'leaflet'
import { Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'
import axios from 'axios'
import './App.css'

// Fix para ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Bairros padrão
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

// Opções de mapas modernos - MELHORADOS
const mapStyles = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
  },
  topographic: {
    name: 'Topográfico',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  },
  dark: {
    name: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  modern: {
    name: 'Moderno',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

// Filtro Kalman para suavização GPS
class KalmanFilter {
  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R; // Noise de medição
    this.Q = Q; // Noise do processo
    this.A = A; // Fator de estado
    this.B = B; // Fator de controle
    this.C = C; // Fator de medição
    this.cov = NaN;
    this.x = NaN; // Estado estimado
  }

  filter(z, u = 0) {
    if (isNaN(this.x)) {
      this.x = (1 / this.C) * z;
      this.cov = (1 / this.C) * this.Q * (1 / this.C);
    } else {
      // Predição
      const predX = (this.A * this.x) + (this.B * u);
      const predCov = ((this.A * this.cov) * this.A) + this.Q;

      // Atualização Kalman
      const K = predCov * this.C * (1 / ((this.C * predCov * this.C) + this.R));
      this.x = predX + K * (z - (this.C * predX));
      this.cov = predCov - (K * this.C * predCov);
    }
    return this.x;
  }
}

// Componente para ajustar o mapa apenas quando necessário
function MapBounds({ markers, active, onBoundsAdjusted }) {
  const map = useMap()
  
  useEffect(() => {
    if (active && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]))
      map.fitBounds(bounds, { padding: [50, 50] })
      // Chamar callback para notificar que os bounds foram ajustados
      if (onBoundsAdjusted) {
        onBoundsAdjusted()
      }
    }
  }, [markers, map, active, onBoundsAdjusted])
  
  return null
}

// Componente para rota animada
function AnimatedRoute({ routeCoordinates }) {
  const map = useMap()
  const polylineRef = useRef(null)
  
  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current)
        polylineRef.current = null
      }
      return
    }

    // Remover polyline anterior se existir
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current)
    }

    // Criar polyline
    const polyline = L.polyline(routeCoordinates, {
      color: '#06B6D4',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1
    }).addTo(map)
    
    polylineRef.current = polyline

    const bounds = L.latLngBounds(routeCoordinates)
    map.fitBounds(bounds, { padding: [50, 50] })

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current)
      }
    }
  }, [routeCoordinates, map])
  
  return null
}

// Componente para controle de localização
function LocationControl({ currentPosition }) {
  const map = useMap();
  
  const handleLocate = () => {
    if (currentPosition) {
      map.setView([currentPosition.lat, currentPosition.lng], 18, {
        animate: true,
        duration: 1
      });
    } else {
      map.locate({setView: true, maxZoom: 18});
    }
  };

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control">
        <button 
          className="location-button"
          onClick={handleLocate}
          title="Centralizar na minha localização"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Função para validar projeto
const isValidProject = (project) => {
  return project && 
         project.id && 
         project.name && 
         Array.isArray(project.points) && 
         project.points.length > 0 &&
         project.points.every(point => point.lat && point.lng);
};

// Serviço de snapping para alinhar pontos às ruas
class RoadSnappingService {
  static async snapToRoad(lat, lng, radius = 50) {
    try {
      // Usar Nominatim para encontrar a rua mais próxima
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'JamaawApp/1.0'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.lat && data.lon) {
        // Retorna a posição corrigida pelo serviço de geocodificação
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
    
    // Fallback: retorna posição original
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
      
      // Delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return snappedPoints;
  }
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [markers, setMarkers] = useState([])
  const [filteredMarkers, setFilteredMarkers] = useState([])
  const [selectedBairro, setSelectedBairro] = useState('todos')
  const [editingMarker, setEditingMarker] = useState(null)
  const [selectedForDistance, setSelectedForDistance] = useState([])
  const [distanceResult, setDistanceResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bairros, setBairros] = useState(DEFAULT_BAIRROS)
  const [showAddBairro, setShowAddBairro] = useState(false)
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

  // Novos estados para régua manual e projetos
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
  const [trackingMode, setTrackingMode] = useState('manual')
  const [lastAutoPointTime, setLastAutoPointTime] = useState(0)
  const [editingProject, setEditingProject] = useState(null);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [snappingPoints, setSnappingPoints] = useState([]);
  const [mapStyle, setMapStyle] = useState('modern');
  
  // Estados para controle de zoom - CORREÇÃO DO PROBLEMA
  const [adjustBoundsForMarkers, setAdjustBoundsForMarkers] = useState(false);
  const [adjustBoundsForProject, setAdjustBoundsForProject] = useState(false);

  // Filtros Kalman para suavização
  const kalmanLatRef = useRef(new KalmanFilter(0.1, 0.1));
  const kalmanLngRef = useRef(new KalmanFilter(0.1, 0.1));

  // Verificar autenticação ao iniciar
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setAuthLoading(false)
    }
    checkAuth()

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // FUNÇÕES PARA SUPABASE - PROJETOS
  // Carregar projetos do Supabase
  const loadProjectsFromSupabase = async () => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('projetos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          // Tabela não existe, criar
          await createProjectsTable();
          return [];
        }
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Erro ao carregar projetos do Supabase:', error);
      // Fallback para localStorage
      const localProjects = localStorage.getItem('jamaaw_projects');
      return localProjects ? JSON.parse(localProjects) : [];
    }
  };

  // Criar tabela de projetos se não existir
  const createProjectsTable = async () => {
    try {
      const { error } = await supabase.rpc('create_projects_table_if_not_exists');
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao criar tabela de projetos:', error);
    }
  };

  // Salvar projeto no Supabase
  const saveProjectToSupabase = async (project) => {
    if (!user) return null;
    
    try {
      const projectData = {
        name: project.name,
        points: project.points,
        total_distance: project.totalDistance,
        bairro: project.bairro,
        tracking_mode: project.trackingMode,
        user_id: user.id
      };

      let result;
      
      if (project.id && typeof project.id === 'number') {
        // Projeto existente do localStorage - criar novo no Supabase
        const { data, error } = await supabase
          .from('projetos')
          .insert([projectData])
          .select();
        
        if (error) throw error;
        result = data[0];
      } else {
        // Projeto já tem ID do Supabase - atualizar
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

  // Deletar projeto do Supabase
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

  // Sincronizar projetos locais com Supabase
  const syncLocalProjectsWithSupabase = async (localProjects) => {
    if (!user) return;
    
    try {
      for (const project of localProjects) {
        // Se o projeto tem ID numérico, é do localStorage e precisa ser salvo no Supabase
        if (typeof project.id === 'number') {
          await saveProjectToSupabase(project);
        }
      }
      
      // Recarregar projetos do Supabase após sincronização
      const supabaseProjects = await loadProjectsFromSupabase();
      setProjects(supabaseProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(supabaseProjects));
      
    } catch (error) {
      console.error('Erro na sincronização:', error);
    }
  };

  // Carregar projetos salvos com validação - MODIFICADO
  useEffect(() => {
    const loadProjects = async () => {
      try {
        let loadedProjects = [];
        
        // Tentar carregar do Supabase primeiro
        if (user) {
          loadedProjects = await loadProjectsFromSupabase();
        }
        
        // Se não encontrou no Supabase, carregar do localStorage
        if (loadedProjects.length === 0) {
          const savedProjects = localStorage.getItem('jamaaw_projects');
          if (savedProjects) {
            const parsedProjects = JSON.parse(savedProjects);
            // Filtrar apenas projetos válidos
            loadedProjects = parsedProjects.filter(isValidProject);
          }
        }
        
        setProjects(loadedProjects);
        
        // Sincronizar projetos locais com Supabase se estiver online
        if (isOnline && user && loadedProjects.length > 0) {
          syncLocalProjectsWithSupabase(loadedProjects);
        }
        
      } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        // Fallback para localStorage
        const savedProjects = localStorage.getItem('jamaaw_projects');
        if (savedProjects) {
          const parsedProjects = JSON.parse(savedProjects);
          setProjects(parsedProjects.filter(isValidProject));
        }
      }
    };

    loadProjects();
  }, [user, isOnline])

  // Carregar bairros personalizados do localStorage
  useEffect(() => {
    const savedBairros = localStorage.getItem('jamaaw_bairros')
    if (savedBairros) {
      setBairros(JSON.parse(savedBairros))
    }
  }, [])

  // Carregar favoritos do localStorage
  useEffect(() => {
    if (user) {
      const savedFavorites = localStorage.getItem(`jamaaw_favorites_${user.id}`)
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites))
      }
    }
  }, [user])

  // Efeito para rastrear posição do usuário
  useEffect(() => {
    let watchId = null
    
    if (tracking && !paused) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy, speed } = position.coords
            
            // Aplicar filtro Kalman para suavizar as coordenadas
            const smoothedLat = kalmanLatRef.current.filter(latitude);
            const smoothedLng = kalmanLngRef.current.filter(longitude);
            
            const smoothedPosition = {
              lat: smoothedLat,
              lng: smoothedLng
            };
            
            setCurrentPosition(smoothedPosition);
            setGpsAccuracy(accuracy);
            setSpeed(speed || 0);
            
            // Atualizar histórico de posições
            setPositionHistory(prev => {
              const newHistory = [...prev, {
                lat: smoothedLat,
                lng: smoothedLng,
                timestamp: Date.now(),
                accuracy: accuracy
              }].slice(-10); // Manter apenas as últimas 10 posições
              return newHistory;
            });
            
            // Se estiver no modo automático, adiciona ponto automaticamente
            if (trackingMode === 'automatic') {
              addAutomaticPoint(smoothedPosition, accuracy);
            }
          },
          (error) => {
            console.error('Erro ao obter localização:', error)
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 2000
          }
        )
      }
    }
    
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [tracking, paused, trackingMode])

  // Salvar bairros personalizados no localStorage
  const saveBairros = (newBairros) => {
    setBairros(newBairros)
    localStorage.setItem('jamaaw_bairros', JSON.stringify(newBairros))
  }

  // Adicionar novo bairro
  const handleAddBairro = () => {
    if (newBairro.trim() && !bairros.includes(newBairro.trim())) {
      const updatedBairros = [...bairros, newBairro.trim()]
      saveBairros(updatedBairros)
      setNewBairro('')
      setShowAddBairro(false)
    }
  }

  // Remover bairro
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

  // Toggle favorito
  const toggleFavorite = (markerId) => {
    const newFavorites = favorites.includes(markerId)
      ? favorites.filter(id => id !== markerId)
      : [...favorites, markerId]
    
    setFavorites(newFavorites)
    if (user) {
      localStorage.setItem(`jamaaw_favorites_${user.id}`, JSON.stringify(newFavorites))
    }
  }

  // Monitorar conectividade
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
        // Se falhar (web), não fazer nada
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

  // Carregar marcações do Supabase ao iniciar
  useEffect(() => {
    if (user) {
      loadMarkers()
    }
  }, [user])

  // Filtrar marcadores por bairro e favoritos
  useEffect(() => {
    let filtered = markers

    // Filtrar por bairro
    if (selectedBairro !== 'todos') {
      filtered = filtered.filter(m => m.bairro === selectedBairro)
    }

    // Filtrar por favoritos
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => favorites.includes(m.id))
    }

    setFilteredMarkers(filtered)
  }, [markers, selectedBairro, showFavoritesOnly, favorites])

  // Função para carregar marcações do Supabase ou cache local
  const loadMarkers = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      // Tentar carregar do Supabase se estiver online
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
          // Salvar no cache local para uso offline
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

  // Função para carregar marcações do cache local
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
        console.log('Marcações carregadas do cache local')
      }
    } catch (error) {
      console.error('Erro ao carregar marcações do cache:', error)
    }
  }

  // Função para salvar marcação no Supabase
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

  // Função para atualizar marcação no Supabase
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

  // Função para deletar marcação do Supabase
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

  // Função para processar arquivo KML/KMZ
  const handleFileImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      let kmlText

      if (file.name.endsWith('.kmz')) {
        const zip = new JSZip()
        const contents = await zip.loadAsync(file)
        const kmlFile = Object.keys(contents.files).find(name => name.endsWith('.kml'))
        if (!kmlFile) {
          throw new Error('Arquivo KML não encontrado no KMZ')
        }
        kmlText = await contents.files[kmlFile].async('text')
      } else {
        kmlText = await file.text()
      }

      // Limpar marcações antigas do Supabase ANTES de processar as novas
      if (isOnline && user) {
        try {
          const { error } = await supabase
            .from('marcacoes')
            .delete()
            .eq('user_id', user.id)
          
          if (error && error.code !== '42P01') {
            console.error('Erro ao limpar marcações antigas:', error)
          }
        } catch (error) {
          console.error('Erro ao limpar marcações antigas:', error)
        }
      }

      // Limpar marcações do estado imediatamente
      setMarkers([])

      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml')
      const placemarks = xmlDoc.getElementsByTagName('Placemark')

      const newMarkers = []
      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i]
        const name = placemark.getElementsByTagName('name')[0]?.textContent || `Marcação ${i + 1}`
        const coordinates = placemark.getElementsByTagName('coordinates')[0]?.textContent.trim()
        
        if (coordinates) {
          const [lng, lat] = coordinates.split(',').map(Number)
          
          // Extrair descrição se existir
          const description = placemark.getElementsByTagName('description')[0]?.textContent || ''
          
          const marker = {
            name,
            lat,
            lng,
            descricao: description,
            bairro: '',
            rua: '',
            fotos: []
          }

          // Salvar no Supabase se online
          if (isOnline) {
            const savedMarker = await saveMarkerToSupabase(marker)
            if (savedMarker) {
              newMarkers.push(savedMarker)
            } else {
              newMarkers.push({ ...marker, id: Date.now() + i })
            }
          } else {
            newMarkers.push({ ...marker, id: Date.now() + i })
            setSyncPending(true)
          }
        }
      }

      // Substituir marcações antigas pelas novas
      setMarkers(newMarkers)
      // Ativar o zoom apenas para novas importações
      setAdjustBoundsForMarkers(true)
      
      // Atualizar cache local
      if (user) {
        try {
          await Preferences.set({
            key: `jamaaw_markers_${user.id}`,
            value: JSON.stringify(newMarkers)
          })
        } catch (e) {
          localStorage.setItem(`jamaaw_markers_${user.id}`, JSON.stringify(newMarkers))
        }
      }
      
      alert(`${newMarkers.length} marcações importadas com sucesso! As marcações antigas foram substituídas.`)
    } catch (error) {
      console.error('Erro ao importar arquivo:', error)
      alert('Erro ao importar arquivo. Verifique o formato.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  // Função para limpar marcações importadas
  const handleClearImportedMarkers = async () => {
    if (!confirm('Tem certeza que deseja limpar todas as marcações importadas? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      // Limpar do Supabase se online
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

      // Limpar do estado
      setMarkers([])
      setFilteredMarkers([])
      handleClearRoute()
      
      // Limpar cache local
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

  // Função para exportar marcações como KML
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

  // Função auxiliar para escapar caracteres XML
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

  // Função para download de KML - compatível com WebView
  const downloadKML = (kmlContent, filename) => {
    try {
      // Método 1: Tentar download tradicional primeiro
      const blob = new Blob([kmlContent], {
        type: 'application/vnd.google-earth.kml+xml;charset=utf-8'
      })
      
      // Criar link de download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      
      // Adicionar ao DOM e clicar
      document.body.appendChild(a)
      a.click()
      
      // Limpeza
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 1000)
      
      // Método 2: Fallback - abrir em nova aba após um delay
      setTimeout(() => {
        // Verificar se o download foi bem-sucedido
        const checkDownload = () => {
          // Se ainda estamos na mesma página, provavelmente o download falhous
          if (!document.hidden) {
            console.log('Download pode ter falhado, abrindo em nova aba...')
            
            // Criar nova tentativa com data URL
            const dataUrl = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kmlContent)
            const newWindow = window.open(dataUrl, '_blank')
            
            if (!newWindow) {
              // Se popup foi bloqueado, mostrar dados para copiar manualmente
              alert(`Download bloqueado pelo navegador. \n\nSalve manualmente: \n1. Copie o conteúdo abaixo\n2. Cole em um editor de texto\n3. Salve como "${filename}"\n\n${kmlContent}`)
            }
          }
        }
        
        // Verificar após 2 segundos
        setTimeout(checkDownload, 2000)
      }, 100)
      
    } catch (error) {
      console.error('Erro ao exportar KML:', error)
      
      // Método 3: Fallback final - data URL direta
      try {
        const dataUrl = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kmlContent)
        const newWindow = window.open(dataUrl, '_blank')
        
        if (!newWindow) {
          // Último recurso - mostrar alerta com conteúdo
          alert(`Erro ao baixar arquivo. \n\nPara salvar manualmente:\n1. Copie o texto abaixo\n2. Cole em um editor\n3. Salve como "${filename}"\n\nConteúdo:\n${kmlContent.substring(0, 1000)}${kmlContent.length > 1000 ? '...' : ''}`)
        }
      } catch (fallbackError) {
        console.error('Fallback também falhou:', fallbackError)
        alert('Erro ao exportar arquivo KML. Tente novamente.')
      }
    }
  }

  // Função para calcular distância entre dois pontos
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

  // Função para calcular distância total
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

  // Função para obter rota da API OSRM
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

  // Função para calcular matriz de distâncias via OSRM
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

  // Função para calcular distância entre dois marcadores selecionados
  const handleCalculateDistance = async () => {
    if (selectedForDistance.length !== 2) {
      alert('Selecione exatamente 2 marcadores')
      return
    }

    setCalculatingRoute(true)
    const [m1, m2] = selectedForDistance

    // Tentar obter rota da API
    const route = await getRouteFromAPI([m1.lng, m1.lat], [m2.lng, m2.lat])
    
    if (route) {
      setRouteCoordinates(route)
      
      // Calcular distância via API
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
      // Fallback para linha reta
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

  // Função para calcular distância total entre todos os marcadores
  const handleCalculateAllDistances = async () => {
    if (markers.length < 2) {
      alert('É necessário ter pelo menos 2 marcadores')
      return
    }

    setCalculatingRoute(true)

    // Criar rota passando por todos os marcadores
    const allCoordinates = markers.map(m => [m.lng, m.lat])
    
    // Tentar obter rota via API
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
      
      // Fallback para soma de distâncias em linha reta
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

  // Função para limpar rota
  const handleClearRoute = () => {
    setRouteCoordinates([])
    setDistanceResult(null)
    setSelectedForDistance([])
  }

  // Função para limpar todas as marcações
  const handleClearAllMarkers = async () => {
    if (!confirm('Tem certeza que deseja limpar todas as marcações? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      // Limpar do Supabase se online
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

      // Limpar do estado
      setMarkers([])
      setFilteredMarkers([])
      handleClearRoute()
      
      // Limpar cache local
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

  // Função para alternar seleção de marcador
  const toggleMarkerSelection = (marker) => {
    setSelectedForDistance(prev => {
      const exists = prev.find(m => m.id === marker.id)
      if (exists) {
        return prev.filter(m => m.id !== marker.id)
      } else {
        if (prev.length >= 2) {
          alert('Você já selecionou 2 marcadores. Desmarque um para selecionar outro.')
          return prev
        }
        return [...prev, marker]
      }
    })
  }

  // Função para editar marcador
  const handleEditMarker = (marker) => {
    setEditingMarker({ ...marker })
    setShowEditDialog(true)
  }

  // Função para salvar edição
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

  // Função para deletar marcador
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

  // Função para detectar nome da rua usando geocodificação reversa
  const detectStreetName = async (lat, lng) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'JamaawApp/1.0'
          }
        }
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

  // Função para compartilhar localização
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

  // Função para upload de fotos
  const handlePhotoUpload = async (event) => {
    if (!editingMarker) return

    const files = Array.from(event.target.files)
    const photoUrls = []

    for (const file of files) {
      const reader = new FileReader()
      reader.onload = (e) => {
        photoUrls.push(e.target.result)
        if (photoUrls.length === files.length) {
          setEditingMarker(prev => ({
            ...prev,
            fotos: [...(prev.fotos || []), ...photoUrls]
          }))
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Função para obter contagem de marcadores por bairro
  const getMarkerCountByBairro = (bairro) => {
    if (bairro === 'todos') return markers.length
    return markers.filter(m => m.bairro === bairro).length
  }

  // ========== FUNÇÕES DA RÉGUA MANUAL ==========

  // Iniciar rastreamento
  const startTracking = () => {
    setTracking(true);
    setPaused(false);
    setManualPoints([]);
    setTotalDistance(0);
    setCurrentProject(null);
    setLastAutoPointTime(Date.now());
    setShowTrackingControls(true);
    setShowRulerPopup(false);
    
    // Resetar filtros Kalman
    kalmanLatRef.current = new KalmanFilter(0.1, 0.1);
    kalmanLngRef.current = new KalmanFilter(0.1, 0.1);
  };

  // Parar rastreamento
  const stopTracking = () => {
    setTracking(false);
    setPaused(false);
    setCurrentPosition(null);
    setShowTrackingControls(false);
    // Limpar os pontos do mapa e estados relacionados
    setManualPoints([]);
    setTotalDistance(0);
    setCurrentProject(null);
    setPositionHistory([]);
    setGpsAccuracy(null);
    setSpeed(0);
  };

  // Pausar rastreamento
  const pauseTracking = () => {
    setPaused(!paused);
  };

  // Adicionar ponto manual com snapping
  const addManualPoint = async () => {
    if (currentPosition && tracking && !paused && trackingMode === 'manual') {
      let finalPosition = currentPosition;
      
      // Aplicar snapping se habilitado
      if (snappingEnabled) {
        try {
          const snapped = await RoadSnappingService.snapToRoad(currentPosition.lat, currentPosition.lng);
          if (snapped.snapped) {
            finalPosition = { lat: snapped.lat, lng: snapped.lng };
            console.log('Ponto alinhado à rua:', snapped.address);
          }
        } catch (error) {
          console.warn('Erro no snapping, usando posição original:', error);
        }
      }
      
      addPoint(finalPosition);
    }
  }

  // Verificar estabilidade das posições
  const checkPositionStability = (positions) => {
    if (positions.length < 3) return true;
    
    const variances = [];
    for (let i = 1; i < positions.length; i++) {
      const distance = calculateDistance(
        positions[i - 1].lat, positions[i - 1].lng,
        positions[i].lat, positions[i].lng
      );
      variances.push(distance);
    }
    
    // Calcular variância média
    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
    
    // Se a variação média for maior que 5 metros, considerar instável
    return avgVariance <= 5;
  };

  // Calcular direção entre dois pontos (em graus)
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360;
  };

  // Verificar movimento consistente
  const checkConsistentMovement = (history) => {
    if (history.length < 3) return true;
    
    const recent = history.slice(-3);
    const bearings = [];
    
    // Calcular direções entre pontos consecutivos
    for (let i = 1; i < recent.length; i++) {
      const bearing = calculateBearing(
        recent[i - 1].lat, recent[i - 1].lng,
        recent[i].lat, recent[i].lng
      );
      bearings.push(bearing);
    }
    
    // Verificar se as direções são consistentes (diferença máxima de 45 graus)
    if (bearings.length >= 2) {
      const bearingDiff = Math.abs(bearings[1] - bearings[0]);
      const normalizedDiff = Math.min(bearingDiff, 360 - bearingDiff);
      return normalizedDiff <= 45;
    }
    
    return true;
  };

  // Adicionar ponto automático - VERSÃO MELHORADA COM SNAPPING
  const addAutomaticPoint = async (position, accuracy) => {
    if (!tracking || paused || trackingMode !== 'automatic') return;
    
    const now = Date.now();
    const timeSinceLastPoint = now - lastAutoPointTime;
    
    // 1. Verificação de tempo mínimo (5 segundos)
    if (timeSinceLastPoint < 5000) {
      return;
    }
    
    // 2. Verificação de precisão do GPS (mínimo 20 metros de precisão)
    if (accuracy && accuracy > 20) {
      console.log('Precisão GPS insuficiente:', accuracy, 'm');
      return;
    }
    
    // 3. Verificação de velocidade mínima (0.5 m/s = 1.8 km/h)
    if (speed < 0.5) {
      console.log('Velocidade insuficiente:', (speed * 3.6).toFixed(1), 'km/h');
      return;
    }
    
    // 4. Verificação de estabilidade - analisar as últimas posições
    if (positionHistory.length >= 3) {
      const recentPositions = positionHistory.slice(-3);
      const isStable = checkPositionStability(recentPositions);
      if (!isStable) {
        console.log('Posição instável - ignorando ponto');
        return;
      }
    }
    
    // 5. Verificação de distância mínima do último ponto (10 metros)
    if (manualPoints.length > 0) {
      const lastPoint = manualPoints[manualPoints.length - 1];
      const distance = calculateDistance(
        lastPoint.lat, lastPoint.lng,
        position.lat, position.lng
      );
      
      if (distance < 10) {
        console.log('Distância insuficiente do último ponto:', distance.toFixed(1), 'm');
        return;
      }
    }
    
    // 6. Verificação de movimento consistente
    if (positionHistory.length >= 2) {
      const isConsistentMovement = checkConsistentMovement(positionHistory);
      if (!isConsistentMovement) {
        console.log('Movimento inconsistente - ignorando ponto');
        return;
      }
    }
    
    // Aplicar snapping se habilitado
    let finalPosition = position;
    if (snappingEnabled) {
      try {
        const snapped = await RoadSnappingService.snapToRoad(position.lat, position.lng);
        if (snapped.snapped) {
          finalPosition = { lat: snapped.lat, lng: snapped.lng };
          console.log('Ponto automático alinhado à rua');
        }
      } catch (error) {
        console.warn('Erro no snapping automático:', error);
      }
    }
    
    // TODAS AS VERIFICAÇÕES PASSARAM - Adicionar ponto
    console.log('✅ Ponto automático adicionado - Velocidade:', (speed * 3.6).toFixed(1), 'km/h');
    addPoint(finalPosition);
    setLastAutoPointTime(now);
  }

  // Função comum para adicionar ponto - CORREÇÃO: NÃO ATIVA ZOOM AUTOMÁTICO
  const addPoint = (position) => {
    const newPoint = {
      ...position,
      id: Date.now(),
      timestamp: Date.now()
    }

    setManualPoints(prev => {
      const updatedPoints = [...prev, newPoint]
      
      // Calcular distância total
      if (updatedPoints.length > 1) {
        const lastPoint = updatedPoints[updatedPoints.length - 2]
        const distance = calculateDistance(
          lastPoint.lat, lastPoint.lng,
          newPoint.lat, newPoint.lng
        )
        setTotalDistance(prevDist => prevDist + distance)
      }
      
      return updatedPoints
    })
    
    // NÃO ativar zoom automático ao adicionar pontos manuais
    // Isso evita que o mapa fique "puxando" o zoom a cada ponto
  }

  // Limpar pontos
  const clearManualPoints = () => {
    setManualPoints([])
    setTotalDistance(0)
    setCurrentProject(null)
    setLastAutoPointTime(0)
  }

  // MODIFICAR a função saveProject existente:
  const saveProject = async () => {
    if (!projectName.trim() || manualPoints.length === 0) {
      alert('Digite um nome para o projeto e certifique-se de ter pontos no traçado.');
      return;
    }
    
    // CALCULAR DISTÂNCIA TOTAL CORRETAMENTE
    const calculatedTotalDistance = calculateTotalDistance(manualPoints);
    
    let updatedProjects = [];
    let savedProject = null;
    
    const projectData = {
      name: projectName,
      points: manualPoints,
      totalDistance: calculatedTotalDistance,
      bairro: selectedBairro !== 'todos' ? selectedBairro : 'Vários',
      trackingMode: trackingMode,
      updatedAt: new Date().toISOString()
    };

    if (editingProject) {
      // Atualizar projeto existente
      updatedProjects = projects.map(p =>
        p.id === editingProject.id ?
        {
          ...p,
          ...projectData
        } :
        p
      );
      
      // Salvar no Supabase se online
      if (isOnline && user) {
        savedProject = await saveProjectToSupabase({
          ...editingProject,
          ...projectData
        });
      }
    } else {
      // Criar novo projeto
      const newProject = {
        ...projectData,
        createdAt: new Date().toISOString()
      };
      
      // Salvar no Supabase se online
      if (isOnline && user) {
        savedProject = await saveProjectToSupabase(newProject);
      }
      
      if (savedProject) {
        updatedProjects = [...projects, savedProject];
      } else {
        // Fallback para localStorage
        newProject.id = Date.now();
        updatedProjects = [...projects, newProject];
      }
    }
    
    setProjects(updatedProjects);
    localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
    
    if (savedProject) {
      setCurrentProject(savedProject);
    } else if (editingProject) {
      setCurrentProject(updatedProjects.find(p => p.id === editingProject.id));
    } else {
      setCurrentProject(updatedProjects[updatedProjects.length - 1]);
    }
    
    setTotalDistance(calculatedTotalDistance);
    setProjectName('');
    setShowProjectDialog(false);
    setEditingProject(null);
    
    alert(editingProject ? 'Projeto atualizado com sucesso!' : 'Projeto salvo com sucesso!');
  };

  // Carregar projeto - VERSÃO CORRIGIDA
  const loadProject = (project) => {
    if (!project || !project.points) {
      console.error('Projeto inválido:', project);
      alert('Erro: Projeto inválido ou corrompido.');
      return;
    }

    try {
      setManualPoints([...project.points]);
      
      // CALCULAR DISTÂNCIA SE NECESSÁRIO
      const projectDistance = project.totalDistance || calculateTotalDistance(project.points);
      setTotalDistance(projectDistance);
      
      setCurrentProject({
        ...project,
        totalDistance: projectDistance
      });
      
      setTrackingMode(project.trackingMode || 'manual');
      setShowProjectsList(false);
      setTracking(false);
      setPaused(false);
      setLastAutoPointTime(0);
      
      // Ativar zoom apenas para projetos carregados
      setAdjustBoundsForProject(true);
      
      // Fechar menus
      setSidebarOpen(false);
      setShowRulerPopup(false);
      
      console.log(`Projeto "${project.name}" carregado com sucesso!`);
    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
      alert('Erro ao carregar projeto. Tente novamente.');
    }
  };

  // MODIFICAR a função deleteProject existente:
  const deleteProject = async (projectId) => {
    if (confirm('Tem certeza que deseja deletar este projeto?')) {
      // Deletar do Supabase se online
      if (isOnline && user) {
        const success = await deleteProjectFromSupabase(projectId);
        if (!success) {
          alert('Erro ao deletar projeto do servidor');
          return;
        }
      }
      
      // Deletar localmente
      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
      
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(null);
        setManualPoints([]);
        setTotalDistance(0);
      }
    }
  };

  // Exportar projeto como KML
  const exportProjectAsKML = (project = currentProject) => {
    if (!project) return
    
    setTimeout(() => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(project.name)}</name>
    <description>Traçado criado no Jamaaw App - Distância total: ${(project.totalDistance / 1000).toFixed(2)} km - Modo: ${project.trackingMode || 'manual'}</description>
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
          ${project.points.map(point => `${point.lng},${point.lat},0`).join('\n          ')}
        </coordinates>
      </LineString>
    </Placemark>
    ${project.points.map((point, index) => `
    <Placemark>
      <name>Ponto ${index + 1}</name>
      <Point>
        <coordinates>${point.lng},${point.lat},0</coordinates>
      </Point>
    </Placemark>
    `).join('')}
  </Document>
</kml>`
      
      const friendlyName = project.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      downloadKML(kml, `projeto_${friendlyName}.kml`)
    }, 100)
  }

  // Funções para controle de zoom - CORREÇÃO DO PROBLEMA
  const handleBoundsAdjustedForMarkers = () => {
    setAdjustBoundsForMarkers(false);
  };

  const handleBoundsAdjustedForProject = () => {
    setAdjustBoundsForProject(false);
  };

  // Efeito para melhorar compatibilidade com WebView
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

  // Função de logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMarkers([])
    setFilteredMarkers([])
  }

  // Renderizar tela de autenticação se não estiver logado
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
      {/* Mapa em tela cheia */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[-9.6658, -35.7353]}
          zoom={13}
          className="h-full w-full"
          zoomControl={false} // Desativar controles de zoom
        >
          <TileLayer
            attribution={mapStyles[mapStyle].attribution}
            url={mapStyles[mapStyle].url}
            maxZoom={20}
            minZoom={3}
            detectRetina={true}
          />
          
          {/* Componente de localização */}
          <LocationControl currentPosition={currentPosition} />

          {/* Marcadores existentes */}
          {filteredMarkers.map(marker => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              eventHandlers={{
                click: () => {
                  handleEditMarker(marker)
                }
              }}
            >
              <Popup className="custom-popup">
                <div className="text-sm min-w-[200px] max-w-[280px] p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3 className="font-bold text-base text-slate-900 flex-1">{marker.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(marker.id)
                      }}
                      className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Heart 
                        className={`w-5 h-5 ${favorites.includes(marker.id) ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`}
                      />
                    </button>
                  </div>
    
                  <div className="space-y-2 mb-3">
                    {marker.bairro && (
                      <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 px-2 py-1.5 rounded">
                        <MapPin className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                        <span className="font-medium">{marker.bairro}</span>
                      </div>
                    )}
                    {marker.rua && (
                      <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 px-2 py-1.5 rounded">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span>{marker.rua}</span>
                      </div>
                    )}
                  </div>
    
                  {marker.descricao && (
                    <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded mb-3 leading-relaxed">{marker.descricao}</p>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md"
                    onClick={() => handleShareLocation(marker)}
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    Compartilhar Localização
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Pontos do traçado manual */}
          {manualPoints.map((point, index) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={L.divIcon({
                className: 'ruler-point',
                html: `<div class="ruler-point-marker">${index + 1}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              })}
            >
              <Popup className="modern-popup">
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-lg p-4 min-w-[200px] border border-slate-600/50 shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Ponto {index + 1}</h3>
                      <p className="text-cyan-400 text-xs">Traçado Manual</p>
                    </div>
                  </div>

                  {/* Coordenadas */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Latitude:</span>
                      <span className="text-white font-mono">{point.lat.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Longitude:</span>
                      <span className="text-white font-mono">{point.lng.toFixed(6)}</span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  {point.timestamp && (
                    <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 text-xs text-cyan-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(point.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xs"
                      onClick={() => {
                        const url = `https://www.google.com/maps?q=${point.lat},${point.lng}`;
                        navigator.clipboard.writeText(url);
                        alert('Coordenadas copiadas!');
                      }}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-gray-400 border-slate-600 hover:bg-slate-700 text-xs"
                      onClick={() => {
                        // Remover ponto específico
                        const updatedPoints = manualPoints.filter((_, i) => i !== index);
                        setManualPoints(updatedPoints);
                        
                        // Recalcular distância total
                        if (updatedPoints.length > 1) {
                          let newTotal = 0;
                          for (let i = 0; i < updatedPoints.length - 1; i++) {
                            newTotal += calculateDistance(
                              updatedPoints[i].lat, updatedPoints[i].lng,
                              updatedPoints[i + 1].lat, updatedPoints[i + 1].lng
                            );
                          }
                          setTotalDistance(newTotal);
                        } else {
                          setTotalDistance(0);
                        }
                      }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Linha do traçado */}
          {manualPoints.length > 1 && (
            <Polyline
              positions={manualPoints}
              color="#1e3a8a"
              weight={4}
              opacity={0.8}
            />
          )}

          {/* Posição atual do usuário */}
          {currentPosition && (
            <Marker
              position={[currentPosition.lat, currentPosition.lng]}
              icon={L.divIcon({
                className: 'current-position-marker',
                html: '<div class="current-position"></div>',
                iconSize: [12, 12]
              })}
            />
          )}

          <AnimatedRoute routeCoordinates={routeCoordinates} />
          
          {/* Componentes MapBounds separados para controle independente do zoom */}
          <MapBounds 
            markers={filteredMarkers} 
            active={adjustBoundsForMarkers}
            onBoundsAdjusted={handleBoundsAdjustedForMarkers}
          />
          
          <MapBounds 
            markers={manualPoints} 
            active={adjustBoundsForProject}
            onBoundsAdjusted={handleBoundsAdjustedForProject}
          />
        </MapContainer>
      </div>

      {/* Popup de Localização na Parte de Baixo */}
      {currentPosition && (
        <div className="absolute bottom-20 left-4 right-4 z-10 animate-slide-in-bottom">
          <Card className="bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm border-slate-600/50 shadow-2xl text-white location-popup-card">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Navigation className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-sm font-medium">Sua localização</p>
                    <p className="text-xs text-cyan-400">
                      {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    // Centralizar no usuário
                    if (currentPosition) {
                      const map = document.querySelector('.leaflet-container');
                      if (map && map.__leaflet_map) {
                        map.__leaflet_map.setView([currentPosition.lat, currentPosition.lng], 18, {
                          animate: true,
                          duration: 1
                        });
                      }
                    }
                  }}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Centralizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barra de ferramentas flutuante no topo */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        {/* Menu hambúrguer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="bg-gradient-to-br from-slate-800 to-slate-700 backdrop-blur-sm hover:from-slate-700 hover:to-slate-600 text-white shadow-xl border border-slate-600/50 transition-all-smooth hover-lift"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 shadow-2xl flex flex-col overflow-y-auto">
            <SheetHeader className="border-b border-slate-700/50 pb-4">
              <SheetTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <MapPinned className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold">Jamaaw App</p>
                  <p className="text-xs text-cyan-400 font-normal">Gerenciador de Marcações</p>
                </div>
              </SheetTitle>
            </SheetHeader>
            
            <div className="flex-1 py-4 space-y-6">
              {/* Seletor de Estilo do Mapa */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Estilo do Mapa</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(mapStyles).map(([key, style]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={mapStyle === key ? "default" : "outline"}
                      className={`justify-start text-xs h-10 ${
                        mapStyle === key 
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white' 
                          : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-gray-300'
                      }`}
                      onClick={() => setMapStyle(key)}
                    >
                      <MapPinned className="w-3 h-3 mr-2" />
                      {style.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Seção de Projetos */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold text-cyan-400">Projetos Salvos</h3>
                  <div className="flex gap-2">
                    <span className="project-count-badge">
                      {projects.length}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowProjectsList(true)}
                      className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                      title="Ver todos os projetos"
                    >
                      <Layers className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {projects.slice(0, 3).map(project => (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/30 transition-all cursor-pointer group"
                      onClick={() => {
                        if (isValidProject(project)) {
                          loadProject(project);
                          setSidebarOpen(false);
                        } else {
                          alert('Projeto corrompido. Não foi possível carregar.');
                        }
                      }}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                        <FolderOpen className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{project.name}</p>
                        <p className="text-xs text-gray-400">
                          {((project.totalDistance || 0) / 1000).toFixed(2)} km • {project.points.length} pts
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setProjectName(project.name);
                            setManualPoints(project.points);
                            setTotalDistance(project.totalDistance || 0);
                            setTrackingMode(project.trackingMode || 'manual');
                            setShowProjectDialog(true);
                          }}
                          className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                          title="Editar projeto"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportProjectAsKML(project);
                          }}
                          className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                          title="Exportar projeto"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="text-center py-6">
                      <FolderOpen className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Nenhum projeto salvo</p>
                      <p className="text-xs text-gray-500 mt-1">Use a régua manual para criar projetos</p>
                    </div>
                  )}
                  {projects.length > 3 && (
                    <Button
                      variant="ghost"
                      className="w-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 text-sm"
                      onClick={() => setShowProjectsList(true)}
                    >
                      Ver todos os projetos ({projects.length})
                    </Button>
                  )}
                </div>
              </div>

              {/* Configurações de Alinhamento */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-cyan-400">Alinhamento de Pontos</h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${snappingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <span className="text-xs text-gray-400">{snappingEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Interruptor moderno */}
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <div className="flex items-center gap-3">
                      <Navigation className="w-4 h-4 text-cyan-400" />
                      <div>
                        <span className="text-gray-300 text-sm font-medium">Alinhar pontos às ruas</span>
                        <p className="text-xs text-gray-400 mt-1">
                          {snappingEnabled 
                            ? 'Pontos serão alinhados automaticamente' 
                            : 'Pontos na posição exata do GPS'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Interruptor estilizado */}
                    <button
                      onClick={() => setSnappingEnabled(!snappingEnabled)}
                      className={`toggle-switch relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                        snappingEnabled ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`toggle-slider inline-block transform rounded-full bg-white transition-transform ${
                          snappingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filtros de Bairro */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold text-cyan-400">Filtrar por Bairro</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddBairro(!showAddBairro)}
                    className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  >
                    +
                  </Button>
                </div>

                {showAddBairro && (
                  <div className="flex gap-2 mb-3 p-2 bg-slate-800/30 rounded-lg">
                    <Input
                      value={newBairro}
                      onChange={(e) => setNewBairro(e.target.value)}
                      placeholder="Novo bairro"
                      className="h-8 text-sm bg-slate-700/50 border-slate-600 text-white flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBairro()}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddBairro}
                      className="h-8 px-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                    >
                      Add
                    </Button>
                  </div>
                )}

                <div className="space-y-1">
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      selectedBairro === 'todos' 
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' 
                        : 'bg-slate-800/30 hover:bg-slate-800/50'
                    }`}
                    onClick={() => setSelectedBairro('todos')}
                  >
                    <span className="text-sm font-medium">Todos os bairros</span>
                    <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                      {getMarkerCountByBairro('todos')}
                    </span>
                  </div>
                  
                  {bairros.map(bairro => (
                    <div
                      key={bairro}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all group ${
                        selectedBairro === bairro 
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' 
                          : 'bg-slate-800/30 hover:bg-slate-800/50'
                      }`}
                      onClick={() => setSelectedBairro(bairro)}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm">{bairro}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                          {getMarkerCountByBairro(bairro)}
                        </span>
                        {!DEFAULT_BAIRROS.includes(bairro) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveBairro(bairro);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="space-y-2">
                <Button
                  className="w-full justify-start bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white"
                  onClick={() => document.getElementById('file-input').click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-3" />
                  {uploading ? 'Importando...' : 'Importar KML/KMZ'}
                </Button>
                
                <Button
                  className="w-full justify-start bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white"
                  onClick={handleExport}
                  disabled={markers.length === 0}
                >
                  <Download className="w-4 h-4 mr-3" />
                  Exportar Marcações
                </Button>

                {/* BOTÃO NOVO: Limpar Marcações Importadas */}
                <Button
                  className="w-full justify-start bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white border border-red-500/30"
                  onClick={handleClearImportedMarkers}
                  disabled={markers.length === 0}
                >
                  <X className="w-4 h-4 mr-3" />
                  Limpar Marcações Importadas
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="justify-start bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white"
                    onClick={handleCalculateDistance}
                    disabled={selectedForDistance.length !== 2}
                  >
                    <Ruler className="w-4 h-4 mr-2" />
                    2 Postes
                  </Button>

                  <Button
                    className="justify-start bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white"
                    onClick={handleCalculateAllDistances}
                    disabled={markers.length < 2}
                  >
                    <Ruler className="w-4 h-4 mr-2" />
                    Todas
                  </Button>
                </div>

                {routeCoordinates.length > 0 && (
                  <Button
                    className="w-full justify-start bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400"
                    onClick={handleClearRoute}
                  >
                    <X className="w-4 h-4 mr-3" />
                    Limpar Rota
                  </Button>
                )}
              </div>
            </div>

            {/* Footer do Menu */}
            <div className="border-t border-slate-700/50 pt-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  <p className="text-xs text-cyan-400">Online</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo e título */}
        <div className="flex-1 flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm rounded-lg px-4 py-2.5 shadow-xl border border-slate-600/50">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <MapPinned className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-white text-sm sm:text-base">Jamaaw App</span>
            {!isOnline && (
              <span className="text-xs text-orange-400 ml-2 bg-orange-500/20 px-2 py-0.5 rounded-full">Offline</span>
            )}
            {tracking && (
              <span className="text-xs text-green-400 ml-2 bg-green-500/20 px-2 py-0.5 rounded-full">Rastreando</span>
            )}
          </div>
        </div>

        {/* Botão da Régua Manual */}
        <Button
          size="icon"
          className="bg-gradient-to-br from-orange-500 to-red-600 backdrop-blur-sm hover:from-orange-600 hover:to-red-700 text-white shadow-xl border border-orange-600/50 transition-all-smooth hover-lift"
          onClick={() => setShowRulerPopup(!showRulerPopup)}
        >
          <Navigation className="w-5 h-5" />
        </Button>
      </div>

      {/* Popup da Régua Manual */}
      {!tracking && showRulerPopup && (
        <div className="absolute top-20 right-4 z-10">
          <Card className="bg-gradient-to-br from-slate-800/95 to-slate-700/95 backdrop-blur-sm border-slate-600/50 shadow-2xl text-white w-80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-cyan-400" />
                  Régua Manual
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
              <p className="text-xs text-gray-400 mt-1">Crie medições precisas no mapa</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Configuração de Alinhamento */}
              <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Navigation className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-gray-300 font-medium text-sm">Alinhamento Automático</span>
                      <p className="text-xs text-gray-400">Alinhar pontos à rede viária</p>
                    </div>
                  </div>
                  
                  {/* Interruptor idêntico ao do menu */}
                  <button
                    onClick={() => setSnappingEnabled(!snappingEnabled)}
                    className={`toggle-switch relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-700 ${
                      snappingEnabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`toggle-slider inline-block transform rounded-full bg-white transition-transform ${
                        snappingEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {/* Status do alinhamento */}
                <div className="flex items-center justify-center gap-2 mt-2 p-2 bg-slate-600/30 rounded">
                  <div className={`w-2 h-2 rounded-full ${snappingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-xs text-cyan-400">
                    {snappingEnabled ? 'Alinhamento ativo' : 'Alinhamento desativado'}
                  </span>
                </div>
              </div>

              {/* Seletor de Modo */}
              <div className="space-y-3">
                <span className="text-gray-300 font-medium text-sm">Modo de Rastreamento</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={trackingMode === 'manual' ? 'default' : 'outline'}
                    className={`flex-1 font-medium ${
                      trackingMode === 'manual' 
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white' 
                        : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-gray-300'
                    }`}
                    onClick={() => setTrackingMode('manual')}
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    Manual
                  </Button>
                  <Button
                    size="sm"
                    variant={trackingMode === 'automatic' ? 'default' : 'outline'}
                    className={`flex-1 font-medium ${
                      trackingMode === 'automatic' 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white' 
                        : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-gray-300'
                    }`}
                    onClick={() => setTrackingMode('automatic')}
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    Automático
                  </Button>
                </div>
              </div>

              {/* Informações do Modo */}
              <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Precisão:</span>
                    <span className="font-medium text-cyan-400">
                      {trackingMode === 'manual' ? 'Alta (Manual)' : 'Automática (10m intervalos)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Alinhamento:</span>
                    <span className="font-medium text-cyan-400">
                      {snappingEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Melhor para:</span>
                    <span className="font-medium text-cyan-400">
                      {trackingMode === 'manual' ? 'Pontos exatos' : 'Trajetos contínuos'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botão Iniciar */}
              <Button
                onClick={startTracking}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3 text-base"
              >
                <Play className="w-4 h-4 mr-2" />
                Iniciar Sessão de Rastreamento
              </Button>

              {/* Projetos Recentes */}
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
                            {((project.totalDistance || 0) / 1000).toFixed(2)} km • {project.points.length} pontos
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

      {/* Diálogo de Lista de Projetos */}
      <Dialog open={showProjectsList} onOpenChange={setShowProjectsList}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-2xl shadow-2xl max-h-[80vh] overflow-hidden project-dialog-content">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Meus Projetos ({projects.length})
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Gerencie e carregue seus projetos salvos
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/30 transition-all group project-grid-item"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-cyan-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-lg mb-1">{project.name}</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-400">
                      <div>
                        <span className="text-cyan-400 font-medium">{project.points.length}</span> pontos
                      </div>
                      <div>
                        <span className="text-cyan-400 font-medium">{((project.totalDistance || 0) / 1000).toFixed(2)}</span> km
                      </div>
                      <div>
                        <span className="text-cyan-400 font-medium">{project.trackingMode || 'manual'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Criado: {new Date(project.createdAt).toLocaleDateString('pt-BR')}</span>
                      {project.updatedAt && (
                        <span>Atualizado: {new Date(project.updatedAt).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="project-actions-grid">
                    <Button
                      size="sm"
                      onClick={() => {
                        loadProject(project);
                        setShowProjectsList(false);
                      }}
                      className="compact-button bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Carregar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingProject(project);
                        setProjectName(project.name);
                        setManualPoints(project.points);
                        setTotalDistance(project.totalDistance || 0);
                        setTrackingMode(project.trackingMode || 'manual');
                        setShowProjectDialog(true);
                        setShowProjectsList(false);
                      }}
                      className="compact-button border-slate-600 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportProjectAsKML(project)}
                      className="compact-button border-slate-600 text-green-400 hover:bg-green-500/20"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Exportar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteProject(project.id)}
                      className="compact-button border-slate-600 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
              
              {projects.length === 0 && (
                <div className="text-center py-12">
                  <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-400 mb-2">Nenhum projeto encontrado</h3>
                  <p className="text-gray-500 text-sm">
                    Use a régua manual para criar seu primeiro projeto de medição
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 pt-4 border-t border-slate-700/50">
            <Button
              onClick={() => setShowProjectsList(false)}
              className="flex-1 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setShowProjectsList(false);
                setShowRulerPopup(true);
              }}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <Ruler className="w-4 h-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resultado de distância flutuante */}
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

      {/* Loading overlay */}
      {calculatingRoute && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm px-6 py-3 rounded-xl shadow-2xl z-10 flex items-center gap-3 text-white border border-slate-600/50 animate-scale-in">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
          <span className="text-sm font-medium">Calculando rota...</span>
        </div>
      )}

      {/* Dialog de edição de marcação */}
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
              Editar Marcação
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Edite os dados da marcação no mapa
            </DialogDescription>
          </DialogHeader>
          {editingMarker && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 font-medium">Nome</Label>
                <Input
                  value={editingMarker.name}
                  onChange={(e) => setEditingMarker({ ...editingMarker, name: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
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
                <Label className="text-gray-300 font-medium">Rua</Label>
                <Input
                  value={editingMarker.rua || ''}
                  onChange={(e) => setEditingMarker({ ...editingMarker, rua: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                  placeholder="Nome da rua"
                />
              </div>

              <div>
                <Label className="text-gray-300 font-medium">Descrição</Label>
                <Textarea
                  value={editingMarker.descricao || ''}
                  onChange={(e) => setEditingMarker({ ...editingMarker, descricao: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-gray-300 font-medium">Fotos</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editingMarker.fotos?.map((foto, index) => (
                    <img key={index} src={foto} alt={`Foto ${index + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-slate-700" />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-slate-700 text-cyan-400 hover:bg-slate-800"
                  onClick={() => document.getElementById('photo-input').click()}
                >
                  Adicionar Fotos
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveEdit} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg">
                  Salvar
                </Button>
                <Button onClick={handleDeleteMarker} variant="destructive" className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg">
                  Deletar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para Salvar Projeto */}
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
              {editingProject ? 'Atualize os dados do projeto' : 'Salve o traçado atual como um novo projeto'}
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
            
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
              <p className="text-sm text-cyan-400 font-medium mb-2">Resumo do Projeto</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 font-bold">{manualPoints.length}</div>
                  <div className="text-gray-400 text-xs">Pontos</div>
                </div>
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 font-bold">{(totalDistance / 1000).toFixed(2)} km</div>
                  <div className="text-gray-400 text-xs">Distância</div>
                </div>
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 font-bold">{selectedBairro !== 'todos' ? selectedBairro : 'Vários'}</div>
                  <div className="text-gray-400 text-xs">Bairro</div>
                </div>
                <div className="text-center p-2 bg-slate-700/30 rounded">
                  <div className="text-cyan-400 font-bold">{trackingMode === 'manual' ? 'Manual' : 'Automático'}</div>
                  <div className="text-gray-400 text-xs">Modo</div>
                </div>
              </div>
            </div>

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
                onClick={saveProject}
                disabled={!projectName.trim()}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                {editingProject ? 'Atualizar' : 'Salvar'} Projeto
              </Button>
            </div>
          </div>
        </DialogContent> 
      </Dialog>

      {/* Input oculto para upload de arquivo */}
      <input
        id="file-input"
        type="file"
        accept=".kml,.kmz"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Input oculto para upload de fotos */}
      <input
        id="photo-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Controles de Rastreamento */}
      {tracking && showTrackingControls && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-bottom">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-lg border border-slate-600/50 rounded-2xl shadow-2xl p-4 min-w-[350px] max-w-[90vw]">
            {/* Header com informações */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Rastreamento Ativo</h3>
                  <p className="text-cyan-400 text-xs">
                    {trackingMode === 'manual' ? 'Modo Manual' : 'Modo Automático'} • {manualPoints.length} pontos
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">{(totalDistance / 1000).toFixed(2)} km</p>
                <p className="text-gray-400 text-xs">Distância total</p>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="w-full bg-slate-600/50 rounded-full h-2 mb-4">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min((totalDistance / 5000) * 100, 100)}%` 
                }}
              ></div>
            </div>

            {/* Status do Alinhamento */}
            <div className="flex items-center justify-center gap-2 text-xs mb-3">
              <div className={`w-2 h-2 rounded-full ${snappingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-cyan-400">
                Alinhamento: {snappingEnabled ? 'ATIVO' : 'INATIVO'}
              </span>
            </div>

            {/* Botões de controle */}
            <div className="flex gap-2 flex-wrap">
              {/* Botão Pausar/Retomar */}
              <Button
                onClick={pauseTracking}
                className={`flex-1 min-w-[120px] py-3 font-medium ${
                  paused 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white' 
                    : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white'
                }`}
              >
                {paused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Retomar
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pausar
                  </>
                )}
              </Button>

              {/* Botão Adicionar Ponto (apenas modo manual) */}
              {trackingMode === 'manual' && (
                <Button
                  onClick={addManualPoint}
                  disabled={paused || !currentPosition}
                  className="flex-1 min-w-[120px] py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Adicionar Ponto
                </Button>
              )}

              {/* Botão Salvar Projeto */}
              {manualPoints.length > 0 && (
                <Button
                  onClick={() => setShowProjectDialog(true)}
                  className="flex-1 min-w-[100px] py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-medium"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              )}

              {/* Botão Parar */}
              <Button
                onClick={stopTracking}
                className="flex-1 min-w-[100px] py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-medium"
                >
                <Square className="w-4 h-4 mr-2" />
                Parar
              </Button>
            </div>

            {/* Status do modo automático */}
            {trackingMode === 'automatic' && !paused && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 rounded-lg p-2 border border-cyan-500/20">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  Pontos automáticos a cada 10m
                </div>
                
                {/* Informações de qualidade do GPS */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-slate-700/30 rounded">
                    <div className="text-gray-400">Precisão</div>
                    <div className={`font-medium ${
                      gpsAccuracy && gpsAccuracy <= 10 ? 'text-green-400' : 
                      gpsAccuracy && gpsAccuracy <= 20 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {gpsAccuracy ? `${gpsAccuracy.toFixed(0)}m` : '--'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/30 rounded">
                    <div className="text-gray-400">Velocidade</div>
                    <div className={`font-medium ${
                      speed >= 1 ? 'text-green-400' : 
                      speed >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {speed ? `${(speed * 3.6).toFixed(1)} km/h` : '0 km/h'}
                    </div>
                  </div>
                </div>
                
                {/* Indicador de qualidade */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Qualidade do GPS</div>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2 h-6 rounded-full transition-all ${
                          gpsAccuracy && gpsAccuracy <= level * 4 ? 'bg-green-400' : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App