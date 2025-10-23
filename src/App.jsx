
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import { Upload, MapPin, Filter, Ruler, X, Plus, Image as ImageIcon, Save, Trash2, Download, Share2, FolderPlus, Edit2, Menu, Search, Navigation, LogOut, Star, Heart, MapPinned, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import JSZip from 'jszip'
import L from 'leaflet'
import { Network } from '@capacitor/network'
import { Geolocation } from '@capacitor/geolocation'
import { Preferences } from '@capacitor/preferences'
import axios from 'axios'
import polyline from '@mapbox/polyline'
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

// Componente para ajustar o mapa quando os marcadores mudam
function MapBounds({ markers }) {
  const map = useMap()
  
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [markers, map])
  
  return null
}

// Componente para exibir a localização do usuário
function UserLocationMarker({ userLocation, showUserLocation }) {
  const map = useMap();

  useEffect(() => {
    if (showUserLocation && userLocation) {
      map.setView([userLocation.lat, userLocation.lng], map.getZoom());
    }
  }, [userLocation, showUserLocation, map]);

  return showUserLocation && userLocation ? (
    <Marker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({
      className: 'custom-blue-marker',
      html: '<div style="background-color: blue; width: 1rem; height: 1rem; border-radius: 50%; border: 2px solid white;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })} />
  ) : null;
}

// Componente para rota animada
function AnimatedRoute({ routeCoordinates, onRouteComplete }) {
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

    // Criar polyline animada
    let currentIndex = 0
    const animatedCoords = []
    
    const polyline = L.polyline([], {
      color: '#06B6D4',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1
    }).addTo(map)
    
    polylineRef.current = polyline

    // Animar o desenho da rota
    const animate = () => {
      if (currentIndex < routeCoordinates.length) {
        animatedCoords.push(routeCoordinates[currentIndex])
        polyline.setLatLngs(animatedCoords)
        currentIndex++
        setTimeout(animate, 10)
      } else {
        const bounds = L.latLngBounds(routeCoordinates)
        map.fitBounds(bounds, { padding: [50, 50] })
        if (onRouteComplete) onRouteComplete()
      }
    }
    
    animate()

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current)
      }
    }
  }, [routeCoordinates, map, onRouteComplete])
  
  return null
}

  function MapClickHandler({ rulerMode, setRulerPoints, rulerPoints, calculateDistance, setRulerDistance, roadTraceMode, roadTracePoints, setRoadTracePoints, setRoadTraceRoute, setRoadTraceDistance }) {
    const map = useMapEvents({
      click: async (e) => {
        if (rulerMode) {
          const newPoints = [...rulerPoints, e.latlng]
          setRulerPoints(newPoints)

          if (newPoints.length >= 2) {
            const lastTwoPoints = newPoints.slice(-2)
            const dist = calculateDistance(
              lastTwoPoints[0].lat,
              lastTwoPoints[0].lng,
              lastTwoPoints[1].lat,
              lastTwoPoints[1].lng
            )
            setRulerDistance(prev => prev + dist)
          }
        } else if (roadTraceMode) {
          const newPoints = [...roadTracePoints, e.latlng]
          setRoadTracePoints(newPoints)

          // Se temos pelo menos 2 pontos, calcular rota pelas ruas
          if (newPoints.length >= 2) {
            try {
              // Pegar todos os pontos para criar a rota completa
              const coords = newPoints.map(p => `${p.lng},${p.lat}`).join(';')
              // Usar a API Valhalla para um traçado mais livre
              const valhallaLocations = newPoints.map(p => ({ lat: p.lat, lon: p.lng }));
              const valhallaRequest = {
                locations: valhallaLocations,
                costing: 'auto',
                costing_options: {
                  auto: {
                    country_crossing_penalty: 2000.0,
                    use_highways: 0.0, // Reduzir preferência por rodovias
                    use_tolls: 0.0,    // Reduzir preferência por pedágios
                    use_ferry: 0.0,    // Reduzir preferência por balsas
                    maneuver_penalty: 0.0, // Reduzir penalidade por manobras para permitir mais flexibilidade e evitar voltas desnecessárias
                    shortest: true, // Priorizar o caminho mais curto
                    avoid_bad_paths: 0.0 // Adicionar esta linha para evitar caminhos ruins
                  }
                },
                directions_options: {
                  units: 'kilometers'
                },
                id: 'valhalla_route',
                ignore_one_ways: true // Ignorar sentido único para um traçado mais direto
              };

              const valhallaResponse = await fetch(
                'https://valhalla1.openstreetmap.de/route',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(valhallaRequest)
                }
              );
              const valhallaData = await valhallaResponse.json();

              if (valhallaData.trip && valhallaData.trip.legs) {
                const shape = valhallaData.trip.legs.map(leg => leg.shape).join('');
                const decodedPolyline = polyline.decode(shape, 6);
                setRoadTraceRoute(decodedPolyline);
                setRoadTraceDistance(valhallaData.trip.summary.length * 1000); // Distância em metros
              } else {
                console.error('Erro ao calcular rota com Valhalla API:', valhallaData);
              }
            } catch (error) {
              console.error('Erro ao calcular rota:', error)
            }
          }
        }
      },
    })
    return null
  }

function App() {
  const mapRef = useRef(null);
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
  const [showAddMarkerDialog, setShowAddMarkerDialog] = useState(false)
  const [newMarkerData, setNewMarkerData] = useState({ name: '', lat: '', lng: '', bairro: '', descricao: '' })
  const [showRouteDialog, setShowRouteDialog] = useState(false)
  const [selectedMarkersForRoute, setSelectedMarkersForRoute] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showRulerDialog, setShowRulerDialog] = useState(false)
  const [selectedMarkersForRuler, setSelectedMarkersForRuler] = useState([])
  const [rulerPoints, setRulerPoints] = useState([])
  const [rulerDistance, setRulerDistance] = useState(0)
  const [rulerMode, setRulerMode] = useState(false);
  const [rulerModeManual, setRulerModeManual] = useState(false);
  const [rulerModeCurrentLocation, setRulerModeCurrentLocation] = useState(false);
  const [rulerModeTracking, setRulerModeTracking] = useState(false);
  const [isTrackingPaused, setIsTrackingPaused] = useState(false);
  const [rulerStartPoint, setRulerStartPoint] = useState(null);
  const [roadTraceMode, setRoadTraceMode] = useState(false)
  const [roadTracePoints, setRoadTracePoints] = useState([])
  const [roadTraceRoute, setRoadTraceRoute] = useState([])
  const [roadTraceDistance, setRoadTraceDistance] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState(null);
  // Removido declarações duplicadas de rulerStartPoint, rulerModeManual, rulerModeCurrentLocation, rulerModeTracking, isTrackingPaused


  // useEffect para o modo de rastreamento da régua
  useEffect(() => {
    if (rulerModeTracking && !isTrackingPaused && userLocation) {
      // Adiciona o ponto atual à régua, considerando um ponto de partida se houver
      const newPoints = rulerStartPoint ? [...rulerPoints, rulerStartPoint, userLocation] : [...rulerPoints, userLocation];
      setRulerPoints(newPoints);
      setRulerStartPoint(null); // Resetar o ponto de partida após o uso

      if (newPoints.length >= 2) {
        const lastTwoPoints = newPoints.slice(-2);
        const dist = calculateDistance(
          lastTwoPoints[0].lat,
          lastTwoPoints[0].lng,
          lastTwoPoints[1].lat,
          lastTwoPoints[1].lng
        );
        setRulerDistance(prev => prev + dist);
      }
    }
  }, [userLocation, rulerModeTracking, isTrackingPaused, rulerPoints, rulerStartPoint, calculateDistance]);

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

  // Função de logout
  const requestLocationPermission = async () => {
    const permStatus = await Geolocation.checkPermissions();
    if (permStatus.location === 'denied') {
      const requestResult = await Geolocation.requestPermissions();
      if (requestResult.location === 'denied') {
        alert('Permissão de localização negada. Não é possível mostrar sua localização.');
        return false;
      }
    }
    return true;
  };

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    try {
      const position = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setShowUserLocation(true);
      return { lat: latitude, lng: longitude };
    } catch (error) {
      console.error('Erro ao obter localização atual:', error);
      alert('Não foi possível obter sua localização atual. Verifique as configurações de GPS.');
    }
    return null;
  };

  const startLocationTracking = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    if (locationWatchId) {
      await Geolocation.clearWatch({ id: locationWatchId });
      setLocationWatchId(null);
    }

    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }, (position, err) => {
      if (err) {
        console.error('Erro ao rastrear localização:', err);
        return;
      }
      if (position) {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
      }
    });
    setLocationWatchId(id);
  };

  const stopLocationTracking = async () => {
    if (locationWatchId) {
      await Geolocation.clearWatch({ id: locationWatchId });
      setLocationWatchId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMarkers([])
    setFilteredMarkers([])
  }

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

  // Salvar bairros personalizados no localStorage
  const saveBairros = (newBairros) => {
    setBairros(newBairros)
    localStorage.setItem('jamaaw_bairros', JSON.stringify(newBairros))
  }

  // Adicionar novo bairro
  const handleAddBairro = () => {
    if (newBairro && !bairros.includes(newBairro)) {
      const updatedBairros = [...bairros, newBairro]
      saveBairros(updatedBairros)
      setNewBairro('')
      setShowAddBairro(false)
    }
  }

  // Carregar marcadores do Supabase
  useEffect(() => {
    if (user) {
      fetchMarkers()
    }
  }, [user])

  // Sincronizar marcadores offline
  useEffect(() => {
    const handleNetworkStatusChange = async (status) => {
      setIsOnline(status.connected)
      if (status.connected && syncPending) {
        console.log('Online novamente, tentando sincronizar marcadores pendentes...')
        await syncOfflineMarkers()
        setSyncPending(false)
      }
    }

    Network.addListener('networkStatusChange', handleNetworkStatusChange)

    return () => {
      Network.removeAllListeners()
    }
  }, [syncPending])

  const syncOfflineMarkers = async () => {
    const { value } = await Preferences.get({ key: 'offline_markers' })
    if (value) {
      const offlineMarkers = JSON.parse(value)
      for (const marker of offlineMarkers) {
        if (marker.status === 'new') {
          await addMarkerToSupabase(marker)
        } else if (marker.status === 'deleted') {
          await deleteMarkerFromSupabase(marker.id)
        }
      }
      await Preferences.remove({ key: 'offline_markers' })
      fetchMarkers()
    }
  }

  const addMarkerToSupabase = async (marker) => {
    try {
      const { data, error } = await supabase
        .from('markers')
        .insert([{ ...marker, user_id: user.id, status: undefined }]) // Remover status antes de inserir
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Erro ao adicionar marcador no Supabase:', error.message)
      throw error
    }
  }

  const deleteMarkerFromSupabase = async (markerId) => {
    try {
      const { error } = await supabase
        .from('markers')
        .delete()
        .eq('id', markerId)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao deletar marcador no Supabase:', error.message)
      throw error
    }
  }

  const fetchMarkers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('markers')
        .select('*')
        .eq('user_id', user.id)

      if (error) throw error
      setMarkers(data)
      setFilteredMarkers(data)
    } catch (error) {
      console.error('Erro ao buscar marcadores:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMarker = async (newMarker) => {
    const markerWithUserId = { ...newMarker, user_id: user.id }
    if (isOnline) {
      try {
        const addedMarker = await addMarkerToSupabase(markerWithUserId)
        setMarkers(prev => [...prev, addedMarker])
        setFilteredMarkers(prev => [...prev, addedMarker])
      } catch (error) {
        // Se falhar, salvar para sincronização offline
        const { value } = await Preferences.get({ key: 'offline_markers' })
        const offlineMarkers = value ? JSON.parse(value) : []
        await Preferences.set({ key: 'offline_markers', value: JSON.stringify([...offlineMarkers, { ...markerWithUserId, status: 'new' }]) })
        setSyncPending(true)
        alert('Marcador salvo offline. Será sincronizado quando a conexão for restabelecida.')
      }
    } else {
      const tempId = Date.now() // ID temporário para marcadores offline
      const offlineMarker = { ...markerWithUserId, id: tempId, status: 'new' }
      setMarkers(prev => [...prev, offlineMarker])
      setFilteredMarkers(prev => [...prev, offlineMarker])
      const { value } = await Preferences.get({ key: 'offline_markers' })
      const offlineMarkers = value ? JSON.parse(value) : []
      await Preferences.set({ key: 'offline_markers', value: JSON.stringify([...offlineMarkers, offlineMarker]) })
      setSyncPending(true)
      alert('Marcador salvo offline. Será sincronizado quando a conexão for restabelecida.')
    }
    setShowAddMarkerDialog(false)
    setNewMarkerData({ name: '', lat: '', lng: '', bairro: '', descricao: '' })
  }

  const handleEditMarker = (marker) => {
    setEditingMarker(marker)
    setShowEditDialog(true)
  }

  const handleUpdateMarker = async (updatedMarker) => {
    try {
      const { error } = await supabase
        .from('markers')
        .update(updatedMarker)
        .eq('id', updatedMarker.id)

      if (error) throw error

      setMarkers(prev => prev.map(m => (m.id === updatedMarker.id ? updatedMarker : m)))
      setFilteredMarkers(prev => prev.map(m => (m.id === updatedMarker.id ? updatedMarker : m)))
      setShowEditDialog(false)
      setEditingMarker(null)
    } catch (error) {
      console.error('Erro ao atualizar marcador:', error.message)
      alert('Erro ao atualizar marcador. Tente novamente.')
    }
  }

  const handleDeleteMarker = async (markerId) => {
    if (confirm('Tem certeza que deseja deletar este marcador?')) {
      if (isOnline) {
        try {
          await deleteMarkerFromSupabase(markerId)
          setMarkers(prev => prev.filter(m => m.id !== markerId))
          setFilteredMarkers(prev => prev.filter(m => m.id !== markerId))
        } catch (error) {
          // Se falhar, salvar para sincronização offline
          const { value } = await Preferences.get({ key: 'offline_markers' })
          const offlineMarkers = value ? JSON.parse(value) : []
          await Preferences.set({ key: 'offline_markers', value: JSON.stringify([...offlineMarkers, { id: markerId, status: 'deleted' }]) })
          setSyncPending(true)
          alert('Marcador marcado para exclusão offline. Será sincronizado quando a conexão for restabelecida.')
        }
      } else {
        setMarkers(prev => prev.filter(m => m.id !== markerId))
        setFilteredMarkers(prev => prev.filter(m => m.id !== markerId))
        const { value } = await Preferences.get({ key: 'offline_markers' })
        const offlineMarkers = value ? JSON.parse(value) : []
        await Preferences.set({ key: 'offline_markers', value: JSON.stringify([...offlineMarkers, { id: markerId, status: 'deleted' }]) })
        setSyncPending(true)
        alert('Marcador marcado para exclusão offline. Será sincronizado quando a conexão for restabelecida.')
      }
      setShowEditDialog(false)
      setEditingMarker(null)
    }
  }

  const handleFilterChange = (value) => {
    setSelectedBairro(value)
    if (value === 'todos') {
      setFilteredMarkers(markers)
    } else {
      setFilteredMarkers(markers.filter(marker => marker.bairro === value))
    }
  }

  const handleSearch = () => {
    if (searchQuery === '') {
      setFilteredMarkers(markers)
    } else {
      setFilteredMarkers(markers.filter(marker =>
        marker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        marker.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        marker.bairro.toLowerCase().includes(searchQuery.toLowerCase())
      ))
    }
  }

  const toggleFavorite = (markerId) => {
    const updatedFavorites = favorites.includes(markerId)
      ? favorites.filter(id => id !== markerId)
      : [...favorites, markerId]
    setFavorites(updatedFavorites)
    localStorage.setItem(`jamaaw_favorites_${user.id}`, JSON.stringify(updatedFavorites))
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
  }

  const handleRulerPointClick = (latlng) => {
    const newPoints = [...rulerPoints, latlng];
    setRulerPoints(newPoints);

    if (newPoints.length >= 2) {
      const lastTwoPoints = newPoints.slice(-2);
      const dist = calculateDistance(
        lastTwoPoints[0].lat,
        lastTwoPoints[0].lng,
        lastTwoPoints[1].lat,
        lastTwoPoints[1].lng
      );
      setRulerDistance(prev => prev + dist);
    }
  };

  const handleRoadTracePointClick = async (latlng) => {
    const newPoints = [...roadTracePoints, latlng];
    setRoadTracePoints(newPoints);

    if (newPoints.length >= 2) {
      try {
        const valhallaLocations = newPoints.map(p => ({ lat: p.lat, lon: p.lng }));
        const valhallaRequest = {
          locations: valhallaLocations,
          costing: 'auto',
          costing_options: {
            auto: {
              country_crossing_penalty: 2000.0,
              use_highways: 0.0,
              use_tolls: 0.0,
              use_ferry: 0.0,
              maneuver_penalty: 0.0,
              shortest: true,
              avoid_bad_paths: 0.0
            }
          },
          directions_options: {
            units: 'kilometers'
          },
          id: 'valhalla_route',
          ignore_one_ways: true
        };

        const valhallaResponse = await fetch(
          'https://valhalla1.openstreetmap.de/route',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(valhallaRequest)
          }
        );
        const valhallaData = await valhallaResponse.json();

        if (valhallaData.trip && valhallaData.trip.legs) {
          const shape = valhallaData.trip.legs.map(leg => leg.shape).join('');
          const decodedPolyline = polyline.decode(shape, 6);
          setRoadTraceRoute(decodedPolyline);
          setRoadTraceDistance(valhallaData.trip.summary.length * 1000);
        } else {
          console.error('Erro ao calcular rota com Valhalla API:', valhallaData);
        }
      } catch (error) {
        console.error('Erro ao calcular rota:', error);
      }
    }
  };

  // Componente interno para lidar com eventos do mapa
  function MapInteractionHandler() {
    useMapEvents({
      click: (e) => {
        if (showAddMarkerDialog) {
          setNewMarkerData(prev => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng }));
        }
        if (rulerMode) {
          handleRulerPointClick(e.latlng);
        }
        if (roadTraceMode) {
          handleRoadTracePointClick(e.latlng);
        }
      },
    });
    return null;
  }

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
          zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
          <MapInteractionHandler />
          <MapBounds markers={filteredMarkers} />
          <AnimatedRoute routeCoordinates={routeCoordinates} onRouteComplete={() => setCalculatingRoute(false)} />

          {filteredMarkers.map(marker => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              eventHandlers={{
                click: () => {
                  if (!rulerMode && !roadTraceMode) {
                    handleEditMarker(marker)
                  }
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
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      {favorites.includes(marker.id) ? <Heart fill="red" stroke="red" size={20} /> : <Heart size={20} />}
                    </button>
                  </div>
                  <p className="text-gray-600 mb-2">{marker.descricao}</p>
                  <p className="text-gray-600 mb-2">Bairro: {marker.bairro}</p>
                  <p className="text-gray-600 text-xs">Lat: {marker.lat.toFixed(4)}, Lng: {marker.lng.toFixed(4)}</p>
                  {marker.fotos && marker.fotos.length > 0 && (
                    <div className="mt-2">
                      <h4 className="font-semibold text-sm mb-1">Fotos:</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {marker.fotos.map((foto, index) => (
                          <img key={index} src={foto} alt={`Foto ${index + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-slate-700" />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleEditMarker(marker)}>Editar</Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {rulerMode && rulerPoints.length > 0 && (
            <Polyline positions={rulerPoints} color="purple" weight={5} opacity={0.7} />
          )}

          {roadTraceRoute.length > 0 && (
            <Polyline positions={roadTraceRoute} color="blue" weight={5} opacity={0.7} />
          )}
        </MapContainer>
      </div>

      {/* Botões de controle e diálogo */}
      <div className="absolute top-4 left-4 z-10">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-slate-800 text-white hover:bg-slate-700">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-slate-900 text-white border-r-slate-700">
            <SheetHeader>
              <SheetTitle className="text-white text-xl font-bold">Jamaaw App</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 py-4">
              <Button onClick={() => setShowAddMarkerDialog(true)} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Marcador
              </Button>
              <Input
                placeholder="Buscar marcadores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                className="bg-slate-800 text-white border-slate-700 placeholder:text-slate-400"
              />
              <Button onClick={handleSearch} className="w-full">
                <Search className="mr-2 h-4 w-4" /> Buscar
              </Button>
              <Select onValueChange={handleFilterChange} value={selectedBairro}>
                <SelectTrigger className="w-full bg-slate-800 text-white border-slate-700">
                  <SelectValue placeholder="Filtrar por Bairro" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 text-white border-slate-700">
                  <SelectItem value="todos">Todos os Bairros</SelectItem>
                  {bairros.map(bairro => (
                    <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowAddBairro(prev => !prev)} className="w-full">
                <FolderPlus className="mr-2 h-4 w-4" /> {showAddBairro ? 'Cancelar' : 'Adicionar Bairro'}
              </Button>
              {showAddBairro && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo Bairro"
                    value={newBairro}
                    onChange={(e) => setNewBairro(e.target.value)}
                    className="bg-slate-800 text-white border-slate-700 placeholder:text-slate-400"
                  />
                  <Button onClick={handleAddBairro}>Adicionar</Button>
                </div>
              )}
              <Button onClick={() => setShowFavoritesOnly(prev => !prev)} className="w-full">
                <Star className="mr-2 h-4 w-4" /> {showFavoritesOnly ? 'Mostrar Todos' : 'Mostrar Favoritos'}
              </Button>
              <Button onClick={() => setShowRulerDialog(true)} className="w-full">
                <Ruler className="mr-2 h-4 w-4" /> Distância da Régua
              </Button>
              <Button onClick={() => setShowRouteDialog(true)} className="w-full">
                <Navigation className="mr-2 h-4 w-4" /> Traçar Rota
              </Button>

              <Button
                onClick={async () => {
                  if (showUserLocation) {
                    setShowUserLocation(false);
                    setUserLocation(null);
                  } else {
                    const loc = await getCurrentLocation();
                    if (loc && mapRef.current) {
                      mapRef.current.setView([loc.lat, loc.lng], mapRef.current.getZoom());
                    }
                  }
                }}
                className="w-full"
              >
                <Navigation className="mr-2 h-4 w-4" />
                {showUserLocation ? 'Ocultar Minha Localização' : 'Mostrar Minha Localização'}
              </Button>

              {showUserLocation && userLocation && (
                <Button
                  onClick={() => {
                    if (mapRef.current && userLocation) {
                      mapRef.current.setView([userLocation.lat, userLocation.lng], mapRef.current.getZoom());
                    }
                  }}
                  className="w-full"
                >
                  <MapPinned className="mr-2 h-4 w-4" />
                  Centralizar no GPS
                </Button>
              )}
              {user && (
                <Button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Diálogo de Adicionar Marcador */}
      <Dialog open={showAddMarkerDialog} onOpenChange={setShowAddMarkerDialog}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar Novo Marcador</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right text-slate-400">Nome</Label>
              <Input
                id="name"
                value={newMarkerData.name}
                onChange={(e) => setNewMarkerData({ ...newMarkerData, name: e.target.value })}
                className="col-span-3 bg-slate-800 text-white border-slate-700"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lat" className="text-right text-slate-400">Latitude</Label>
              <Input
                id="lat"
                value={newMarkerData.lat}
                onChange={(e) => setNewMarkerData({ ...newMarkerData, lat: parseFloat(e.target.value) })}
                className="col-span-3 bg-slate-800 text-white border-slate-700"
                type="number"
                step="any"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lng" className="text-right text-slate-400">Longitude</Label>
              <Input
                id="lng"
                value={newMarkerData.lng}
                onChange={(e) => setNewMarkerData({ ...newMarkerData, lng: parseFloat(e.target.value) })}
                className="col-span-3 bg-slate-800 text-white border-slate-700"
                type="number"
                step="any"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bairro" className="text-right text-slate-400">Bairro</Label>
              <Select onValueChange={(value) => setNewMarkerData({ ...newMarkerData, bairro: value })} value={newMarkerData.bairro}>
                <SelectTrigger className="col-span-3 bg-slate-800 text-white border-slate-700">
                  <SelectValue placeholder="Selecione um bairro" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 text-white border-slate-700">
                  {bairros.map(bairro => (
                    <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="descricao" className="text-right text-slate-400">Descrição</Label>
              <Textarea
                id="descricao"
                value={newMarkerData.descricao}
                onChange={(e) => setNewMarkerData({ ...newMarkerData, descricao: e.target.value })}
                className="col-span-3 bg-slate-800 text-white border-slate-700"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => handleAddMarker(newMarkerData)}>Adicionar Marcador</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Editar Marcador */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Marcador</DialogTitle>
          </DialogHeader>
          {editingMarker && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right text-slate-400">Nome</Label>
                <Input
                  id="edit-name"
                  value={editingMarker.name}
                  onChange={(e) => setEditingMarker({ ...editingMarker, name: e.target.value })}
                  className="col-span-3 bg-slate-800 text-white border-slate-700"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-lat" className="text-right text-slate-400">Latitude</Label>
                <Input
                  id="edit-lat"
                  value={editingMarker.lat}
                  onChange={(e) => setEditingMarker({ ...editingMarker, lat: parseFloat(e.target.value) })}
                  className="col-span-3 bg-slate-800 text-white border-slate-700"
                  type="number"
                  step="any"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-lng" className="text-right text-slate-400">Longitude</Label>
                <Input
                  id="edit-lng"
                  value={editingMarker.lng}
                  onChange={(e) => setEditingMarker({ ...editingMarker, lng: parseFloat(e.target.value) })}
                  className="col-span-3 bg-slate-800 text-white border-slate-700"
                  type="number"
                  step="any"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-bairro" className="text-right text-slate-400">Bairro</Label>
                <Select onValueChange={(value) => setEditingMarker({ ...editingMarker, bairro: value })} value={editingMarker.bairro}>
                  <SelectTrigger className="col-span-3 bg-slate-800 text-white border-slate-700">
                    <SelectValue placeholder="Selecione um bairro" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 text-white border-slate-700">
                    {bairros.map(bairro => (
                      <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-descricao" className="text-right text-slate-400">Descrição</Label>
                <Textarea
                  id="edit-descricao"
                  value={editingMarker.descricao}
                  onChange={(e) => setEditingMarker({ ...editingMarker, descricao: e.target.value })}
                  className="col-span-3 bg-slate-800 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-gray-300 font-medium">Fotos</Label>
                <div className="flex flex-col gap-2">
                  {editingMarker.fotos?.map((foto, index) => (
                    <img key={index} src={foto} alt={`Foto ${index + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-slate-700" />
                  ))}
                </div>
                <Button
                  onClick={() => {
                    const newPhoto = prompt('Insira a URL da nova foto:');
                    if (newPhoto) {
                      setEditingMarker(prev => ({ ...prev, fotos: [...(prev.fotos || []), newPhoto] }));
                    }
                  }}
                  className="mt-2 w-full"
                >
                  <ImageIcon className="mr-2 h-4 w-4" /> Adicionar Foto
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-between mt-4">
            <Button variant="destructive" onClick={() => handleDeleteMarker(editingMarker.id)}>Deletar</Button>
            <Button onClick={() => handleUpdateMarker(editingMarker)}>Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Régua de Distância */}
      <Dialog open={showRulerDialog} onOpenChange={setShowRulerDialog}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Distância da Régua</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-slate-400">Selecione um modo para adicionar pontos e medir a distância.</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setRulerModeManual(true);
                  setRulerModeCurrentLocation(false);
                  setRulerModeTracking(false);
                  setIsTrackingPaused(false);
                  setRulerPoints([]);
                  setRulerDistance(0);
                  setRulerStartPoint(null);
                }}
                className={`w-full ${rulerModeManual ? 'bg-cyan-600 hover:bg-cyan-700' : ''}`}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar Manualmente
              </Button>
              <Button
                onClick={async () => {
                  setRulerModeManual(false);
                  setRulerModeCurrentLocation(true);
                  setRulerModeTracking(false);
                  setIsTrackingPaused(false);
                  setRulerPoints([]);
                  setRulerDistance(0);
                  setRulerStartPoint(null);
                  const loc = await getCurrentLocation();
                  if (loc) {
                    // Adiciona o primeiro ponto automaticamente se o modo de localização atual for ativado
                    setRulerPoints([loc]);
                  }
                }}
                className={`w-full ${rulerModeCurrentLocation ? 'bg-cyan-600 hover:bg-cyan-700' : ''}`}
              >
                <MapPin className="mr-2 h-4 w-4" /> Adicionar na Localização Atual
              </Button>
              <Button
                onClick={async () => {
                  setRulerModeManual(false);
                  setRulerModeCurrentLocation(false);
                  setRulerModeTracking(prev => !prev);
                  setIsTrackingPaused(false);
                  setRulerPoints([]);
                  setRulerDistance(0);
                  setRulerStartPoint(null);
                  if (!rulerModeTracking) { // Se estava desativado, ativa o rastreamento
                    await startLocationTracking();
                    const loc = await getCurrentLocation(); // Pega a primeira localização para iniciar
                    if (loc) {
                      setRulerPoints([loc]);
                    }
                  } else { // Se estava ativado, desativa
                    await stopLocationTracking();
                  }
                }}
                className={`w-full ${rulerModeTracking ? 'bg-cyan-600 hover:bg-cyan-700' : ''}`}
              >
                <Navigation className="mr-2 h-4 w-4" /> {rulerModeTracking ? 'Desativar Rastreamento' : 'Ativar Rastreamento'}
              </Button>

              {rulerModeTracking && (
                <Button
                  onClick={() => setIsTrackingPaused(prev => !prev)}
                  className={`w-full ${isTrackingPaused ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                >
                  {isTrackingPaused ? 'Continuar Rastreamento' : 'Pausar Rastreamento'}
                </Button>
              )}

              {(rulerModeManual || rulerModeCurrentLocation || rulerModeTracking) && rulerPoints.length > 0 && (
                <Button
                  onClick={() => {
                    setRulerPoints([]);
                    setRulerDistance(0);
                    setRulerStartPoint(null);
                    if (rulerModeTracking) {
                      stopLocationTracking();
                      setRulerModeTracking(false);
                    }
                  }}
                  className="w-full bg-red-500 hover:bg-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Limpar Pontos
                </Button>
              )}

              {(rulerModeManual || rulerModeCurrentLocation || rulerModeTracking) && rulerPoints.length > 0 && (
                <p className="text-center text-lg font-bold text-cyan-400">Distância Total: {rulerDistance.toFixed(2)} m</p>
              )}

              {(rulerModeManual || rulerModeCurrentLocation || rulerModeTracking) && (
                <Button
                  onClick={() => {
                    if (rulerPoints.length > 0) {
                      setRulerStartPoint(rulerPoints[rulerPoints.length - 1]);
                      alert('Ponto de partida definido para a próxima medição.');
                    } else {
                      alert('Adicione pelo menos um ponto antes de definir um ponto de partida.');
                    }
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                >
                  <MapPinned className="mr-2 h-4 w-4" /> Definir Ponto de Partida
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Traçar Rota */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Traçar Rota por Ruas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-slate-400">Clique no mapa para adicionar pontos e traçar uma rota por ruas.</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setRoadTraceMode(prev => !prev);
                  setRoadTracePoints([]);
                  setRoadTraceRoute([]);
                  setRoadTraceDistance(0);
                }}
                className="w-full"
              >
                {roadTraceMode ? 'Desativar Traçado de Rota' : 'Ativar Traçado de Rota'}
              </Button>
              {roadTraceMode && roadTracePoints.length > 0 && (
                <Button
                  onClick={() => {
                    setRoadTracePoints([]);
                    setRoadTraceRoute([]);
                    setRoadTraceDistance(0);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Limpar Pontos da Rota
                </Button>
              )}
              {roadTraceMode && roadTracePoints.length > 0 && (
                <p className="text-center text-lg font-bold text-cyan-400">Distância da Rota: {roadTraceDistance.toFixed(2)} m</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-75 z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-400"></div>
          <p className="text-cyan-400 font-semibold text-lg">Carregando Jamaaw App...</p>
        </div>
      )}

      {syncPending && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Sincronizando marcadores offline...
        </div>
      )}
    </div>
  )
}

export default App

