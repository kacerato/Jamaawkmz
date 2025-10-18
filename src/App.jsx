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

  function MapClickHandler({ rulerMode, setRulerPoints, rulerPoints, calculateDistance, setRulerDistance, roadTraceMode, roadTracePoints, setRoadTracePoints, setRoadTraceRoute, setRoadTraceDistance, gpsRulerMode, setGpsRulerPoints, gpsRulerPoints, setGpsRulerDistance }) {
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
        } else if (gpsRulerMode) {
          const newPoints = [...gpsRulerPoints, e.latlng]
          setGpsRulerPoints(newPoints)

          if (newPoints.length >= 2) {
            const lastTwoPoints = newPoints.slice(-2)
            const dist = calculateDistance(
              lastTwoPoints[0].lat,
              lastTwoPoints[0].lng,
              lastTwoPoints[1].lat,
              lastTwoPoints[1].lng
            )
            setGpsRulerDistance(prev => prev + dist)
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
  const [rulerMode, setRulerMode] = useState(false)
  const [roadTraceMode, setRoadTraceMode] = useState(false)
  const [roadTracePoints, setRoadTracePoints] = useState([])
  const [roadTraceRoute, setRoadTraceRoute] = useState([])
  const [roadTraceDistance, setRoadTraceDistance] = useState(0)
  const [gpsRulerMode, setGpsRulerMode] = useState(false) // Novo estado para o modo GPS Ruler
  const [gpsRulerPoints, setGpsRulerPoints] = useState([]) // Pontos marcados no modo GPS Ruler
  const [gpsRulerDistance, setGpsRulerDistance] = useState(0) // Distância total no modo GPS Ruler
  const [gpsRulerColor, setGpsRulerColor] = useState('#0000FF') // Cor da régua GPS (azul por padrão)
  const [startGpsRulerIndex, setStartGpsRulerIndex] = useState(0) // Índice do ponto de início da medição GPS
  const [showStartGpsDialog, setShowStartGpsDialog] = useState(false) // Diálogo para escolher o ponto de partida
  const [isSelectingStartPoint, setIsSelectingStartPoint] = useState(false) // Estado para selecionar o ponto de partida no mapa
  const [startGpsFromMarker, setStartGpsFromMarker] = useState(null) // Marcador para iniciar o GPS
  const [isGpsReady, setIsGpsReady] = useState(false) // Estado para saber se o GPS está pronto
  const [followGps, setFollowGps] = useState(false) // Estado para seguir o GPS no mapa
  const [watchId, setWatchId] = useState(null) // ID do observador de posição
  const [currentLocation, setCurrentLocation] = useState(null) // Localização atual do GPS

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
        // Se falhar (web), assumir online
        setIsOnline(true)
      }
    }

    checkConnectivity()

    // Listener para mudanças de conectividade
    let networkListener
    const setupListener = async () => {
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
    }

    setupListener()

    return () => {
      if (networkListener) {
        networkListener.remove()
      }
    }
  }, [syncPending])

  // Carregar marcações do Supabase ao iniciar
  useEffect(() => {
    if (user) {
      loadMarkers()
    }
  }, [user])

  // Filtrar marcadores por pesquisa, bairro e favoritos
  useEffect(() => {
    let filtered = markers

    // Filtrar por bairro
    if (selectedBairro !== 'todos') {
      filtered = filtered.filter(m => m.bairro === selectedBairro)
    }

    // Filtrar por pesquisa
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(query) ||
        (m.bairro && m.bairro.toLowerCase().includes(query)) ||
        (m.rua && m.rua.toLowerCase().includes(query)) ||
        (m.descricao && m.descricao.toLowerCase().includes(query))
      )
    }

    // Filtrar por favoritos
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => favorites.includes(m.id))
    }

    setFilteredMarkers(filtered)
  }, [markers, selectedBairro, searchQuery, showFavoritesOnly, favorites])

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
            // Se falhar (web), usar localStorage
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
        // Se falhar (web), tentar localStorage
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
          // Deletar todas as marcações antigas do usuário
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

  // Função para exportar marcações como KML
  const handleExport = () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Marcações Jamaaw</name>
    ${markers.map(marker => `
    <Placemark>
      <name>${marker.name}</name>
      <description>${marker.descricao || ''}</description>
      <Point>
        <coordinates>${marker.lng},${marker.lat},0</coordinates>
      </Point>
    </Placemark>`).join('')}
  </Document>
</kml>`

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'marcacoes-jamaaw.kml'
    a.click()
    URL.revokeObjectURL(url)
  }
  // Função para calcular distância (Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3 // metres
    const φ1 = (lat1 * Math.PI) / 180 // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    const d = R * c // in metres
    return d
  }

  // --- Funções de Manipulação da Régua GPS ---

  // Função para marcar o ponto GPS atual
  const handleMarkGpsPoint = () => {
    if (currentLocation) {
      const newPoint = { lat: currentLocation.latitude, lng: currentLocation.longitude }
      const updatedPoints = [...gpsRulerPoints, newPoint]
      setGpsRulerPoints(updatedPoints)

      // Recalcular a distância total a partir do ponto de início
      let totalDistance = 0
      if (updatedPoints.length >= 2 && startGpsRulerIndex < updatedPoints.length - 1) {
        for (let i = startGpsRulerIndex + 1; i < updatedPoints.length; i++) {
          const dist = calculateDistance(
            updatedPoints[i-1].lat,
            updatedPoints[i-1].lng,
            updatedPoints[i].lat,
            updatedPoints[i].lng
          )
          totalDistance += dist
        }
      }
      setGpsRulerDistance(totalDistance)
    }
  }

  // Função para desfazer o último ponto da régua GPS
  const handleUndoGpsRuler = () => {
    if (gpsRulerPoints.length > 0) {
      const newPoints = gpsRulerPoints.slice(0, -1)
      setGpsRulerPoints(newPoints)

      // Recalcular distância total a partir do ponto de início
      let totalDistance = 0
      if (newPoints.length >= 2 && startGpsRulerIndex < newPoints.length - 1) {
        for (let i = startGpsRulerIndex + 1; i < newPoints.length; i++) {
          const dist = calculateDistance(
            newPoints[i-1].lat,
            newPoints[i-1].lng,
            newPoints[i].lat,
            newPoints[i].lng
          )
          totalDistance += dist
        }
      }
      setGpsRulerDistance(totalDistance)
    }
  }

  // Função para limpar a régua GPS
  const handleClearGpsRuler = () => {
    setGpsRulerPoints([])
    setGpsRulerDistance(0)
    setStartGpsFromMarker(null)
  }

  // Função para iniciar a régua GPS a partir de um marcador existente
  const handleStartGpsFromMarker = (marker) => {
    if (marker) {
      const startPoint = { lat: marker.lat, lng: marker.lng }
      setGpsRulerPoints([startPoint])
      setGpsRulerDistance(0)
      setStartGpsRulerIndex(0) // Resetar o índice de início
      setShowStartGpsDialog(false)
    }
  }

  const handleSelectStartPointForGpsRuler = (index) => {
    if (index >= 0 && index < gpsRulerPoints.length) {
      setStartGpsRulerIndex(index)
      // Recalcular a distância a partir do novo ponto de início
      let totalDistance = 0
      if (gpsRulerPoints.length >= 2 && index < gpsRulerPoints.length - 1) {
        for (let i = index + 1; i < gpsRulerPoints.length; i++) {
          const dist = calculateDistance(
            gpsRulerPoints[i-1].lat,
            gpsRulerPoints[i-1].lng,
            gpsRulerPoints[i].lat,
            gpsRulerPoints[i].lng
          )
          totalDistance += dist
        }
      }
      setGpsRulerDistance(totalDistance)
    }
  }

  // --- Funções de Geolocalização ---

  // Componente para centralizar o mapa no GPS
  function GpsFollow({ currentLocation, followGps }) {
    const map = useMap()
    useEffect(() => {
      if (followGps && currentLocation) {
        map.setView([currentLocation.latitude, currentLocation.longitude], map.getZoom(), {
          animate: true,
          duration: 1.0,
        })
      }
    }, [currentLocation, followGps, map])
    return null
  }

  // Lógica para solicitar permissão e iniciar o rastreamento do GPS
  useEffect(() => {
    const getGeolocationPermission = async () => {
      // Verifica se a geolocalização está disponível
      if (!('geolocation' in navigator)) {
        console.error('Geolocalização não suportada neste navegador.')
        return
      }

      // Tenta obter a permissão
      try {
        // Tenta pedir a permissão diretamente, o que é mais confiável em WebView
        navigator.geolocation.getCurrentPosition(() => {
          // Permissão concedida
          setIsGpsReady(true)
          startGpsTracking()
        }, (error) => {
          // Permissão negada ou erro
          console.error('Erro ao obter localização ou permissão negada:', error)
        })

        // Verifica o estado da permissão (para navegadores que suportam)
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        if (permission.state === 'granted' || permission.state === 'prompt') {
          setIsGpsReady(true)
          startGpsTracking()
        } else {
          console.warn('Permissão de geolocalização negada.')
        }
      } catch (error) {
        console.error('Erro ao verificar permissão de geolocalização:', error)
      }
    }

    const startGpsTracking = () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          setCurrentLocation({ latitude, longitude, accuracy })
          

        },
        (error) => {
          console.error('Erro ao rastrear posição:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      )
      setWatchId(id)
      setFollowGps(true) // Começa seguindo o GPS
    }

    getGeolocationPermission()

    // Limpeza: parar de rastrear a posição quando o componente for desmontado
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [gpsRulerPoints, watchId]) // Lógica para solicitar permissão e iniciar o rastreamento do GPSM
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
      console.log('Detectando rua para:', lat, lng)
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'JamaawApp/1.0'
          }
        }
      )
      
      console.log('Resposta da API:', response.data)
      
      if (response.data && response.data.address) {
        const address = response.data.address
        const streetName = address.road || address.street || address.pedestrian || address.footway || address.highway || address.cycleway || address.path || ''
        console.log('Nome da rua detectado:', streetName)
        return streetName
      }
      return ''
    } catch (error) {
      console.error('Erro ao detectar nome da rua:', error)
      return ''
    }
  }

  // Função para adicionar nova marcação
  const handleAddMarker = async () => {
    if (!newMarkerData.name || !newMarkerData.lat || !newMarkerData.lng) {
      alert('Preencha todos os campos obrigatórios (Nome, Latitude, Longitude)')
      return
    }

    // Detectar nome da rua automaticamente
    const streetName = await detectStreetName(parseFloat(newMarkerData.lat), parseFloat(newMarkerData.lng))

    const marker = {
      name: newMarkerData.name,
      lat: parseFloat(newMarkerData.lat),
      lng: parseFloat(newMarkerData.lng),
      bairro: newMarkerData.bairro,
      descricao: newMarkerData.descricao,
      rua: streetName,
      fotos: []
    }

    if (isOnline) {
      const savedMarker = await saveMarkerToSupabase(marker)
      if (savedMarker) {
        setMarkers(prev => [...prev, savedMarker])
        setShowAddMarkerDialog(false)
        setNewMarkerData({ name: '', lat: '', lng: '', bairro: '', descricao: '' })
      } else {
        alert('Erro ao adicionar marcação')
      }
    } else {
      const newMarker = { ...marker, id: Date.now() }
      setMarkers(prev => [...prev, newMarker])
      setSyncPending(true)
      setShowAddMarkerDialog(false)
      setNewMarkerData({ name: '', lat: '', lng: '', bairro: '', descricao: '' })
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

  // Função para calcular distância com régua (múltiplas marcações)
  const handleCalculateRulerDistance = async () => {
    if (selectedMarkersForRuler.length < 2) {
      alert('Selecione pelo menos 2 marcações para medir a distância')
      return
    }

    setCalculatingRoute(true)
    setShowRulerDialog(false)

    // Criar rota passando pelas marcações selecionadas na ordem
    const selectedCoordinates = selectedMarkersForRuler.map(m => [m.lng, m.lat])
    
    // Tentar obter rota via API
    try {
      const coordsString = selectedCoordinates.map(c => `${c[0]},${c[1]}`).join(';')
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
          type: 'regua',
          distance: distance.toFixed(2),
          count: selectedMarkersForRuler.length,
          markers: selectedMarkersForRuler.map(m => m.name),
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
      
      for (let i = 0; i < selectedMarkersForRuler.length - 1; i++) {
        const m1 = selectedMarkersForRuler[i]
        const m2 = selectedMarkersForRuler[i + 1]
        totalDistance += calculateDistance(m1.lat, m1.lng, m2.lat, m2.lng)
        routeCoords.push([m1.lat, m1.lng])
      }
      routeCoords.push([selectedMarkersForRuler[selectedMarkersForRuler.length - 1].lat, selectedMarkersForRuler[selectedMarkersForRuler.length - 1].lng])
      
      setRouteCoordinates(routeCoords)
      setDistanceResult({
        type: 'regua',
        distance: totalDistance.toFixed(2),
        count: selectedMarkersForRuler.length,
        markers: selectedMarkersForRuler.map(m => m.name),
        method: 'linha reta'
      })
    }
    
    setCalculatingRoute(false)
    setSidebarOpen(false)
  }

  // Função para limpar medição por régua
  const handleClearRuler = () => {
    setSelectedMarkersForRuler([])
    setRulerMode(false)
    handleClearRoute()
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
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
          {filteredMarkers.map(marker => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              eventHandlers={{
                click: () => {
                  if (isSelectingStartPoint) {
                    handleStartGpsFromMarker(marker)
                    setIsSelectingStartPoint(false)
                  } else if (!rulerMode && !roadTraceMode && !gpsRulerMode) {
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
                        <Navigation className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
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

          {/* Marcador de Localização Atual do GPS */}
          {currentLocation && (
            <Marker
              position={[currentLocation.latitude, currentLocation.longitude]}
              icon={new L.DivIcon({ className: 'gps-location-marker', html: `<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>` })}
            >
              <Popup>Você está aqui. Precisão: {currentLocation.accuracy.toFixed(2)}m</Popup>
            </Marker>
          )}
          <AnimatedRoute routeCoordinates={routeCoordinates} />
                    <MapBounds markers={filteredMarkers} />

          <MapClickHandler 
            rulerMode={rulerMode} 
            setRulerPoints={setRulerPoints} 
            rulerPoints={rulerPoints} 
            calculateDistance={calculateDistance} 
            setRulerDistance={setRulerDistance}
            roadTraceMode={roadTraceMode}
            roadTracePoints={roadTracePoints}
            setRoadTracePoints={setRoadTracePoints}
            setRoadTraceRoute={setRoadTraceRoute}
            setRoadTraceDistance={setRoadTraceDistance}
          />

          {rulerPoints.length > 0 && (
            <Polyline positions={rulerPoints} color="cyan" />
          )}

          {rulerPoints.map((point, index) => (
            <Marker key={index} position={point} icon={L.divIcon({ className: 'ruler-point' })} />
          ))}

          {/* Polylines para a régua GPS */}
          {gpsRulerMode && gpsRulerPoints.length > 0 && (
            <Polyline positions={gpsRulerPoints.slice(startGpsRulerIndex)} color={gpsRulerColor} weight={4} opacity={0.7} />
          )}

          {/* Marcadores dos pontos da Régua GPS */}
          {gpsRulerMode && gpsRulerPoints.map((point, index) => (
            <Marker
              key={`gps-ruler-point-${index}`}
              position={[point.lat, point.lng]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${index === startGpsRulerIndex ? 'green' : gpsRulerColor}; width: 1rem; height: 1rem; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Popup>
                Ponto ${index + 1}<br/>
                Lat: {point.lat.toFixed(4)}<br/>
                Lng: {point.lng.toFixed(4)}<br/>
                <Button
                  size="sm"
                  onClick={() => handleSelectStartPointForGpsRuler(index)}
                  disabled={index === startGpsRulerIndex}
                >
                  {index === startGpsRulerIndex ? 'Início Atual' : 'Iniciar Medição Aqui'}
                </Button>
              </Popup>
            </Marker>
          ))}

          {/* Traçado de rota nas ruas */}
          {roadTraceRoute.length > 0 && (
            <Polyline 
              positions={roadTraceRoute} 
              color="#f97316" 
              weight={5}
              opacity={0.8}
            />
          )}

          {roadTracePoints.map((point, index) => (
            <Marker 
              key={`road-trace-${index}`} 
              position={point} 
              icon={L.divIcon({ 
                className: 'road-trace-point',
                html: `<div style="background: #f97316; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
              })} 
            />
          ))}
        </MapContainer>
      </div>

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
          <SheetContent side="left" className="w-80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 shadow-2xl flex flex-col">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <MapPinned className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold">Jamaaw App</p>
                  <p className="text-xs text-cyan-400 font-normal">Gerenciador de Marcações</p>
                </div>
              </SheetTitle>
            </SheetHeader>
            
            <div className="mt-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {/* Barra de Pesquisa */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar marcações..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                  autoFocus={false}
                />
              </div>

              {/* Filtro de Favoritos */}
              <Button
                variant={showFavoritesOnly ? 'default' : 'outline'}
                className={`w-full justify-start ${
                  showFavoritesOnly
                    ? 'bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600'
                    : 'border-slate-700 hover:bg-slate-800'
                }`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Heart className={`w-4 h-4 mr-2 ${showFavoritesOnly ? 'fill-white' : ''}`} />
                {showFavoritesOnly ? 'Mostrando Favoritos' : 'Ver Favoritos'}
                {favorites.length > 0 && (
                  <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    {favorites.length}
                  </span>
                )}
              </Button>

              {/* Filtros de Bairro */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Filtrar por Bairro
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddBairro(!showAddBairro)}
                    className="h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {showAddBairro && (
                  <div className="flex gap-2 mb-3 animate-slide-in-bottom">
                    <Input
                      value={newBairro}
                      onChange={(e) => setNewBairro(e.target.value)}
                      placeholder="Novo bairro"
                      className="h-8 text-sm bg-slate-800/50 border-slate-700 text-white"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBairro()}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddBairro}
                      className="h-8 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  <Button
                    variant={selectedBairro === 'todos' ? 'default' : 'ghost'}
                    className={`w-full justify-between text-left transition-all-smooth ${
                      selectedBairro === 'todos'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg'
                        : 'hover:bg-slate-800/50'
                    }`}
                    onClick={() => {
                      setSelectedBairro('todos')
                      setSidebarOpen(false)
                    }}
                  >
                    <span className="font-medium">Todos</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {getMarkerCountByBairro('todos')}
                    </span>
                  </Button>
                  
                  {bairros.map(bairro => (
                    <div key={bairro} className="relative group">
                      <Button
                        variant={selectedBairro === bairro ? 'default' : 'ghost'}
                        className={`w-full justify-between text-left transition-all-smooth ${
                          selectedBairro === bairro
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg'
                            : 'hover:bg-slate-800/50'
                        }`}
                        onClick={() => {
                          setSelectedBairro(bairro)
                          setSidebarOpen(false)
                        }}
                      >
                        <span>{bairro}</span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                          {getMarkerCountByBairro(bairro)}
                        </span>
                      </Button>
                      {!DEFAULT_BAIRROS.includes(bairro) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveBairro(bairro)
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Informações do Usuário */}
              <div className="pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-lg border border-slate-600/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">Logado como:</p>
                    <p className="text-sm text-white truncate font-medium">{user?.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleLogout}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Ações */}
              <div className="pt-4 border-t border-slate-700/50 space-y-2">
                <Button
                  className="w-full justify-start bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg transition-all-smooth hover-lift"
                  onClick={() => document.getElementById('file-input').click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Importando...' : 'Importar KML/KMZ'}
                </Button>
                
                <Button
                  className="w-full justify-start bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg transition-all-smooth hover-lift"
                  onClick={handleExport}
                  disabled={markers.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar KML
                </Button>

                <Button
                  className="w-full justify-start bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg transition-all-smooth hover-lift"
                  onClick={handleCalculateDistance}
                  disabled={selectedForDistance.length !== 2}
                >
                  <Ruler className="w-4 h-4 mr-2" />
                  Calcular Rota (2 Postes)
                </Button>

                <Button
                  className="w-full justify-start bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg transition-all-smooth hover-lift"
                  onClick={handleCalculateAllDistances}
                  disabled={markers.length < 2}
                >
                  <Ruler className="w-4 h-4 mr-2" />
                  Calcular Todas
                </Button>

                {routeCoordinates.length > 0 && (
                  <Button
                    className="w-full justify-start bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg transition-all-smooth hover-lift"
                    onClick={handleClearRoute}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar Rota
                  </Button>
                )}

                <Button
                  className="w-full justify-start bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg transition-all-smooth hover-lift"
                  onClick={handleClearAllMarkers}
                  disabled={markers.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Todas as Marcações
                </Button>
              </div>

              {/* Lista de Marcações */}
              <div className="pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Marcações ({filteredMarkers.length})
                  </h3>
                  {selectedForDistance.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded-full font-medium">
                        {selectedForDistance.length} selecionados
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedForDistance([])}
                        className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredMarkers.map(marker => {
                    const isSelected = selectedForDistance.find(m => m.id === marker.id)
                    const isFavorite = favorites.includes(marker.id)
                    return (
                      <div
                        key={marker.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all-smooth hover-lift ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 border-2 border-cyan-400 shadow-lg selected-item'
                            : 'bg-slate-800/50 hover:bg-slate-800 border-2 border-transparent'
                        }`}
                        onClick={(e) => {
                          // Only toggle selection if the click is not on the edit button or favorite button
                          if (!e.target.closest("button") || (e.target.closest("button") && !e.target.closest("button").id.startsWith('edit-marker-') && !e.target.closest("button").id.startsWith('fav-marker-'))) {
                            toggleMarkerSelection(marker)
                          }
                        }}
                      >
                        <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            readOnly
                            className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-700 checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer transition-all"
                            style={{ accentColor: '#06B6D4' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-left text-sm font-medium truncate hover:text-cyan-400 w-full transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditMarker(marker)
                              setSidebarOpen(false)
                            }}
                          >
                            {marker.name}
                          </button>
                          {marker.bairro && (
                            <p className="text-xs text-gray-400 truncate">{marker.bairro}</p>
                          )}
                        </div>
                        <Button
                          id={`fav-marker-${marker.id}`}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 flex-shrink-0 hover:bg-slate-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(marker.id)
                          }}
                        >
                          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} transition-all`} />
                        </Button>
                        <Button
                          id={`edit-marker-${marker.id}`}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 flex-shrink-0 hover:bg-slate-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditMarker(marker)
                            setSidebarOpen(false)
                          }}
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
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
          </div>
        </div>
      </div>

      {/* Botões flutuantes */}
      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2 md:gap-3">
        {/* Botão Régua Manual (Roxo/Rosa) - Abre Diálogo */}
        <Button
          size="icon"
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-2xl transition-all-smooth hover-lift hover-glow border-2 border-white/20"
          onClick={() => setShowRulerDialog(true)}
          title="Medição por Régua (Marcadores)"
        >
          <Ruler className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        {/* Botão Rota (Verde) - Abre Diálogo */}
        <Button
          size="icon"
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-2xl transition-all-smooth hover-lift hover-glow border-2 border-white/20"
          onClick={() => setShowRouteDialog(true)}
          title="Traçar Rota"
        >
          <Navigation className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        {/* Botão Adicionar Marcador (Preto) - Abre Diálogo */}
        <Button
          size="icon"
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 backdrop-blur-sm hover:from-slate-700 hover:to-slate-600 text-white shadow-xl border border-slate-600/50 transition-all-smooth hover-lift"
          onClick={() => setShowAddMarkerDialog(true)}
          title="Adicionar Marcador"
        >
          <Plus className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        {/* Botão Traçado de Rota nas Ruas (Laranja) - Toggle */}
        <Button
          size="icon"
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${roadTraceMode ? 'from-orange-500 to-red-500' : 'from-orange-400 to-red-400'} hover:from-orange-500 hover:to-red-500 text-white shadow-xl border-2 border-white/20 transition-all-smooth hover-lift hover-glow`}
          onClick={() => {
            setRoadTraceMode(!roadTraceMode)
            if (roadTraceMode) {
              setRoadTracePoints([])
              setRoadTraceRoute([])
              setRoadTraceDistance(0)
            }
            // Desabilitar outros modos de medição
            setRulerMode(false)
            setGpsRulerMode(false)
          }}
          title="Traçado de Rota nas Ruas"
        >
          <Navigation className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        {/* Botão Régua Manual (Azul) - Toggle */}
        <Button
          size="icon"
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${rulerMode ? 'from-cyan-500 to-blue-500' : 'from-slate-800 to-slate-700'} backdrop-blur-sm hover:from-slate-700 hover:to-slate-600 text-white shadow-xl border border-slate-600/50 transition-all-smooth hover-lift`}
          onClick={() => {
            setRulerMode(!rulerMode)
            setRulerPoints([])
            setRulerDistance(0)
            // Desabilitar outros modos de medição
            setRoadTraceMode(false)
            setGpsRulerMode(false)
          }}
          title="Régua Manual (Pontos Livres)"
        >
          <Ruler className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        {/* NOVO BOTÃO: GPS Ruler (Azul/Ciano) - Toggle */}
        <Button
          size="icon"
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${gpsRulerMode ? 'from-blue-500 to-cyan-500' : 'from-slate-800 to-slate-700'} backdrop-blur-sm hover:from-slate-700 hover:to-slate-600 text-white shadow-xl border border-slate-600/50 transition-all-smooth hover-lift`}
          onClick={() => {
            setGpsRulerMode(!gpsRulerMode)
            // Desabilitar outros modos de medição
            setRulerMode(false)
            setRoadTraceMode(false)
          }}
          title="Régua com GPS (Caminhada)"
        >
          <MapPin className="w-5 h-5 md:w-6 md:h-6" />
        </Button>
      </div>

      {rulerMode && (
        <div className="absolute bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto z-10">
          <Card className="bg-slate-800/95 backdrop-blur-sm text-white border-slate-700/50 shadow-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 md:gap-3">
                <Ruler className="w-5 h-5 md:w-6 md:h-6 text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm text-cyan-400">Distância da Régua</p>
                  <p className="text-lg md:text-xl font-bold truncate">{rulerDistance.toFixed(2)} m</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-yellow-500/20 hover:text-yellow-400 flex-shrink-0"
                  onClick={() => {
                    if (rulerPoints.length > 0) {
                      const newPoints = rulerPoints.slice(0, -1)
                      setRulerPoints(newPoints)
                      
                      // Recalcular distância
                      if (newPoints.length >= 2) {
                        let totalDistance = 0
                        for (let i = 1; i < newPoints.length; i++) {
                          const dist = calculateDistance(
                            newPoints[i-1].lat,
                            newPoints[i-1].lng,
                            newPoints[i].lat,
                            newPoints[i].lng
                          )
                          totalDistance += dist
                        }
                        setRulerDistance(totalDistance)
                      } else {
                        setRulerDistance(0)
                      }
                    }
                  }}
                  title="Desfazer último ponto"
                  disabled={rulerPoints.length === 0}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-slate-700/50 flex-shrink-0"
                  onClick={() => {
                    setRulerPoints([])
                    setRulerDistance(0)
                  }}
                  title="Limpar todas as medições"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
                  onClick={() => {
                    setRulerMode(false)
                    setRulerPoints([])
                    setRulerDistance(0)
                  }}
                  title="Fechar régua"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* NOVO CARD: GPS Ruler */}
      {gpsRulerMode && (
        <div className="absolute bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto z-10">
          <Card className="bg-slate-800/95 backdrop-blur-sm text-white border-cyan-700/50 shadow-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 md:gap-3">
                <MapPin className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm text-blue-400">Régua GPS</p>
                  <p className="text-lg md:text-xl font-bold truncate">{(gpsRulerDistance / 1000).toFixed(2)} km</p>
                  <p className="text-xs text-blue-300">{gpsRulerPoints.length} pontos</p>
                </div>

                {/* Botão para marcar ponto atual */}
                <Button
                  size="icon"
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-xl border-2 border-white/20 transition-all-smooth hover-lift hover-glow"
                  onClick={handleMarkGpsPoint}
                  title="Marcar Ponto Atual do GPS"
                  disabled={!currentLocation}
                >
                  <Plus className="w-5 h-5 md:w-6 md:h-6" />
                </Button>

                {/* Botão para Desfazer */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-yellow-500/20 hover:text-yellow-400 flex-shrink-0"
                  onClick={handleUndoGpsRuler}
                  title="Desfazer último ponto"
                  disabled={gpsRulerPoints.length === 0}
                >
                  <X className="w-4 h-4" />
                </Button>

                {/* Botão para Limpar */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-slate-700/50 flex-shrink-0"
                  onClick={handleClearGpsRuler}
                  title="Limpar todas as medições"
                  disabled={gpsRulerPoints.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                {/* Botão para fechar */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
                  onClick={() => setGpsRulerMode(false)}
                  title="Fechar régua GPS"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Opções adicionais */}
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="follow-gps"
                    checked={followGps}
                    onChange={(e) => setFollowGps(e.target.checked)}
                    className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="follow-gps" className="text-sm text-gray-300">Seguir GPS</label>
                </div>
                
                {/* Botão para iniciar de um ponto específico */}
                <Button
                  size="sm"
                  variant={isSelectingStartPoint ? 'default' : 'outline'}
                  className={`text-xs h-8 ${isSelectingStartPoint ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700/50 hover:bg-slate-600/50 border-cyan-500 text-cyan-400'}`}
                  onClick={() => {
                    if (gpsRulerPoints.length === 0) {
                      setIsSelectingStartPoint(prev => !prev)
                    }
                  }}
                  title="Iniciar de um ponto específico"
                  disabled={gpsRulerPoints.length > 0} // Desabilita se já houver pontos
                >
                  <MapPinned className="w-4 h-4 mr-1" />
                  {isSelectingStartPoint ? 'Selecione no Mapa' : 'Iniciar de Ponto'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card do traçado de rota nas ruas */}
      {roadTraceMode && (
        <div className="absolute bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto z-10">
          <Card className="bg-gradient-to-br from-orange-900/95 via-red-900/95 to-orange-900/95 backdrop-blur-sm text-white border-orange-700/50 shadow-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 md:gap-3">
                <Navigation className="w-5 h-5 md:w-6 md:h-6 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm text-orange-400">Traçado nas Ruas</p>
                  <p className="text-lg md:text-xl font-bold truncate">{roadTraceDistance.toFixed(2)} m</p>
                  <p className="text-xs text-orange-300">{roadTracePoints.length} pontos</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-yellow-500/20 hover:text-yellow-400 flex-shrink-0"
                  onClick={() => {
                    if (roadTracePoints.length > 0) {
                      const newPoints = roadTracePoints.slice(0, -1)
                      setRoadTracePoints(newPoints)
                      
                      // Recalcular rota
                      if (newPoints.length >= 2) {
                        const coords = newPoints.map(p => `${p.lng},${p.lat}`).join(';')
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

                        fetch(
                          'https://valhalla1.openstreetmap.de/route',
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(valhallaRequest)
                          }
                        )
                          .then(res => res.json())
                          .then(valhallaData => {
                            if (valhallaData.trip && valhallaData.trip.legs) {
                              const shape = valhallaData.trip.legs.map(leg => leg.shape).join('');
                              const decodedPolyline = polyline.decode(shape, 6);
                              setRoadTraceRoute(decodedPolyline);
                              setRoadTraceDistance(valhallaData.trip.summary.length * 1000); // Distância em metros
                            } else {
                              console.error('Erro ao recalcular rota com Valhalla API:', valhallaData);
                            }
                          })
                          .catch(err => console.error('Erro ao recalcular rota com Valhalla API:', err));
                      } else if (newPoints.length === 1) {
                        setRoadTraceRoute([])
                        setRoadTraceDistance(0)
                      } else {
                        setRoadTraceRoute([])
                        setRoadTraceDistance(0)
                      }
                    }
                  }}
                  title="Desfazer último ponto"
                  disabled={roadTracePoints.length === 0}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-orange-700/50 flex-shrink-0"
                  onClick={() => {
                    setRoadTracePoints([])
                    setRoadTraceRoute([])
                    setRoadTraceDistance(0)
                  }}
                  title="Limpar traçado"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 hover:bg-red-500/20 hover:text-red-400 flex-shrink-0"
                  onClick={() => {
                    setRoadTraceMode(false)
                    setRoadTracePoints([])
                    setRoadTraceRoute([])
                    setRoadTraceDistance(0)
                  }}
                  title="Fechar traçado"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultado de distância flutuante */}
      {distanceResult && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-gradient-to-r from-slate-800 to-slate-700 backdrop-blur-sm rounded-xl p-4 shadow-2xl text-white border border-slate-600/50 animate-slide-in-bottom">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-cyan-400 mb-1 flex items-center gap-2">
                <Ruler className="w-4 h-4" />
                {distanceResult.type === 'dois' ? 'Distância entre 2 Postes' : distanceResult.type === 'regua' ? 'Medição por Régua' : 'Distância Total'}
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
              {distanceResult.type === 'regua' && (
                <div className="mt-2">
                  <p className="text-sm text-gray-300 mb-1">
                    {distanceResult.count} marcações selecionadas
                  </p>
                  <p className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
                    {distanceResult.markers.slice(0, 3).join(' → ')}
                    {distanceResult.markers.length > 3 && ` → ... (+${distanceResult.markers.length - 3})`}
                  </p>
                </div>
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
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Adicionar Fotos
                </Button>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveEdit} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
                <Button onClick={handleDeleteMarker} variant="destructive" className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deletar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de adicionar marcação */}
      <Dialog open={showAddMarkerDialog} onOpenChange={setShowAddMarkerDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Adicionar Marcação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 font-medium">Nome *</Label>
              <Input
                value={newMarkerData.name}
                onChange={(e) => setNewMarkerData({ ...newMarkerData, name: e.target.value })}
                className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                placeholder="Nome da marcação"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-300 font-medium">Latitude *</Label>
                <Input
                  value={newMarkerData.lat}
                  onChange={(e) => setNewMarkerData({ ...newMarkerData, lat: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                  placeholder="-9.6658"
                  type="number"
                  step="any"
                />
              </div>
              <div>
                <Label className="text-gray-300 font-medium">Longitude *</Label>
                <Input
                  value={newMarkerData.lng}
                  onChange={(e) => setNewMarkerData({ ...newMarkerData, lng: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                  placeholder="-35.7353"
                  type="number"
                  step="any"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300 font-medium">Bairro</Label>
              <Select
                value={newMarkerData.bairro}
                onValueChange={(value) => setNewMarkerData({ ...newMarkerData, bairro: value })}
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
                value={newMarkerData.descricao}
                onChange={(e) => setNewMarkerData({ ...newMarkerData, descricao: e.target.value })}
                className="bg-slate-800/50 border-slate-700 text-white focus:border-cyan-500 focus:ring-cyan-500/20"
                rows={3}
              />
            </div>
            <Button onClick={handleAddMarker} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de cálculo de rota personalizada */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Calcular Rota Personalizada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">Selecione os marcadores para calcular a rota. Você pode selecionar até 2 marcadores.</p>
            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {filteredMarkers.map(marker => (
                <div
                  key={marker.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer mb-2 transition-all-smooth
                    ${selectedMarkersForRoute.some(m => m.id === marker.id) 
                      ? 'bg-gradient-to-r from-cyan-700/40 to-blue-700/40 border-2 border-cyan-400' 
                      : 'bg-slate-800/50 hover:bg-slate-800 border-2 border-transparent'}`}
                  onClick={() => {
                    if (selectedMarkersForRoute.some(m => m.id === marker.id)) {
                      setSelectedMarkersForRoute(prev => prev.filter(m => m.id !== marker.id))
                    } else if (selectedMarkersForRoute.length < 2) {
                      setSelectedMarkersForRoute(prev => [...prev, marker])
                    } else {
                      alert('Você já selecionou 2 marcadores. Desmarque um para selecionar outro.')
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedMarkersForRoute.some(m => m.id === marker.id)}
                      readOnly
                      className="form-checkbox h-4 w-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                    />
                    <span className="text-white font-medium">{marker.name}</span>
                  </div>
                  {marker.bairro && <span className="text-xs text-gray-400 bg-slate-700/50 px-2 py-1 rounded">{marker.bairro}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={async () => {
                  if (selectedMarkersForRoute.length === 2) {
                    setCalculatingRoute(true)
                    const [m1, m2] = selectedMarkersForRoute
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
                    setShowRouteDialog(false)
                    setSelectedMarkersForRoute([])
                    setSidebarOpen(false)
                  } else {
                    alert('Selecione exatamente 2 marcadores para calcular a rota.')
                  }
                }}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg"
                disabled={selectedMarkersForRoute.length !== 2 || calculatingRoute}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Calcular Rota
              </Button>
              <Button
                onClick={() => {
                  setShowRouteDialog(false)
                  setSelectedMarkersForRoute([])
                }}
                variant="outline"
                className="border-slate-700 text-gray-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Dialog de medição por régua */}
      <Dialog open={showRulerDialog} onOpenChange={setShowRulerDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
              <Ruler className="w-5 h-5" />
              Medição por Régua
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">Selecione as marcações na ordem desejada para medir a distância. Você pode selecionar múltiplas marcações.</p>
            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {filteredMarkers.map((marker, index) => {
                const selectedIndex = selectedMarkersForRuler.findIndex(m => m.id === marker.id)
                const isSelected = selectedIndex !== -1
                return (
                  <div
                    key={marker.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer mb-2 transition-all-smooth
                      ${isSelected
                        ? 'bg-gradient-to-r from-purple-700/40 to-pink-700/40 border-2 border-purple-400' 
                        : 'bg-slate-800/50 hover:bg-slate-800 border-2 border-transparent'}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedMarkersForRuler(prev => prev.filter(m => m.id !== marker.id))
                      } else {
                        setSelectedMarkersForRuler(prev => [...prev, marker])
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="form-checkbox h-4 w-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                        />
                        {isSelected && (
                          <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {selectedIndex + 1}
                          </span>
                        )}
                      </div>
                      <span className="text-white font-medium">{marker.name}</span>
                    </div>
                    {marker.bairro && <span className="text-xs text-gray-400 bg-slate-700/50 px-2 py-1 rounded">{marker.bairro}</span>}
                  </div>
                )
              })}
            </div>
            {selectedMarkersForRuler.length > 0 && (
              <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-3">
                <p className="text-sm text-purple-300 font-medium mb-1">Ordem de medição:</p>
                <p className="text-xs text-gray-300">
                  {selectedMarkersForRuler.map((m, i) => `${i + 1}. ${m.name}`).join(' → ')}
                </p>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleCalculateRulerDistance}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg"
                disabled={selectedMarkersForRuler.length < 2 || calculatingRoute}
              >
                <Ruler className="w-4 h-4 mr-2" />
                Medir Distância
              </Button>
              <Button
                onClick={() => {
                  setShowRulerDialog(false)
                  setSelectedMarkersForRuler([])
                }}
                variant="outline"
                className="border-slate-700 text-gray-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
            </div>
            <Button
              onClick={() => {
                setShowRulerDialog(false)
                setRulerMode(true)
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Ativar Régua Manual no Mapa
            </Button>
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
    </div>
  )
}

export default App

