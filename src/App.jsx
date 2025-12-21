import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl';
import { Network } from '@capacitor/network';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

// --- ÍCONES E UI ---
import { Menu, X, MapPinned, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// --- COMPONENTES VISUAIS ---
import Auth from './components/Auth';
import MapControls from './components/MapControls';
import ProjectManager from './components/ProjectManager';
import ProjectMembersDialog from './components/ProjectMembersDialog';
import GlowNotification from './components/GlowNotification';
import ToolsDock from './components/ToolsDock';
import ControlesRastreamento from './components/ControlesRastreamento';
import ModernPopup from './components/ModernPopup';
import ImportProgressPopup from './components/ImportProgressPopup';
import ProjectReport from './components/ProjectReport';
import ARCamera from './components/ARCamera';
import LoadedProjectsManager from './components/LoadedProjectsManager';

// --- HOOKS INTELIGENTES (A Mágica Acontece Aqui) ---
import { useAuth } from './hooks/useAuth';
import { useGPS } from './hooks/useGPS';
import { useProjectEditor } from './hooks/useProjectEditor';
import { useProjectsManager } from './hooks/useProjectsManager';

// --- UTILS & SERVICES ---
import { RoadSnappingService, calculateDistance } from './utils/geoUtils';
import { RoutingService } from './services/RoutingService';
import electricPoleIcon from './assets/electric-pole.png';

// --- CONFIGURAÇÃO ---
// DICA: Em produção, mova isso para .env (import.meta.env.VITE_MAPBOX_TOKEN)
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2V2dHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

const MAP_STYLES = {
  streets: { name: 'Ruas', url: 'mapbox://styles/mapbox/streets-v11' },
  satellite: { name: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v11' },
  dark: { name: 'Escuro', url: 'mapbox://styles/mapbox/dark-v10' },
  light: { name: 'Claro', url: 'mapbox://styles/mapbox/light-v10' },
};

function App() {
  // 1. INFRAESTRUTURA (Auth, GPS, Rede)
  const { user, loading: authLoading, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  
  // Monitor de Rede
  useEffect(() => {
    Network.getStatus().then(s => setIsOnline(s.connected));
    const listener = Network.addListener('networkStatusChange', s => setIsOnline(s.connected));
    return () => listener.remove && listener.remove();
  }, []);

  // GPS (Sempre ativo para mostrar o "blue dot", mas otimizado internamente)
  const { currentPosition, accuracy, speed, history: positionHistory } = useGPS(true, false);

  // 2. GERENCIADORES (Hooks Customizados)
  // Gerencia a lista de projetos, imports e exclusões
  const projectManager = useProjectsManager(user, isOnline);
  
  // Gerencia o projeto ATUAL (edição, traçado, undo/redo)
  const editor = useProjectEditor(user, isOnline);

  // 3. ESTADOS DE UI (Apenas visual)
  const mapRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [inspectingProject, setInspectingProject] = useState(null);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [notification, setNotification] = useState(null);
  const [popupMarker, setPopupMarker] = useState(null);
  const [arMode, setArMode] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [trackingInputMode, setTrackingInputMode] = useState('gps');
  
  // Estado temporário para marcadores soltos (importados via kml simples ou manuais fora de projeto)
  const [markers, setMarkers] = useState([]); 

  // --- EFEITOS DE SINCRONIZAÇÃO VISUAL ---

  // Centralizar mapa no usuário ao iniciar
  useEffect(() => {
    if (currentPosition && mapRef.current && !editor.tracking) {
      // Só centraliza automaticamente na primeira vez ou se o usuário pedir
      // Implementação simplificada: não força centralização constante para não irritar
    }
  }, [currentPosition]);

  // Se o editor estiver rastreando, segue o GPS
  useEffect(() => {
    if (editor.tracking && !editor.paused && currentPosition && mapRef.current) {
      mapRef.current.flyTo({
        center: [currentPosition.lng, currentPosition.lat],
        zoom: 18,
        speed: 2,
        curve: 1
      });
      
      // Adiciona ponto automático se estiver em modo GPS
      if (trackingInputMode === 'gps') {
         editor.addPoint(currentPosition);
      }
    }
  }, [currentPosition, editor.tracking, editor.paused, trackingInputMode]);

  // --- HANDLERS (CONECTORES) ---

  const showFeedback = (title, message, type = 'success') => {
    setNotification({ title, message, type });
  };

  const handleStartTracking = (mode) => {
    if (projectManager.projects.some(p => p.id === editor.currentProject?.id)) {
        // Já tem projeto carregado, apenas continua
    } else {
        // Novo projeto limpo
        editor.clearEditor();
    }
    setTrackingInputMode(mode);
    editor.setTracking(true);
    editor.setPaused(false);
    setSidebarOpen(false);
    showFeedback('Iniciado', `Rastreamento ${mode === 'gps' ? 'via GPS' : 'por Toque'} ativado.`);
  };

  const handleSaveProject = async () => {
    const result = await editor.saveProject();
    if (result.success) {
      showFeedback('Salvo', 'Projeto salvo com sucesso!', 'success');
      projectManager.loadProjects(); // Recarrega a lista
      setShowProjectManager(true); // Abre a lista
    } else {
      showFeedback('Erro', result.error, 'error');
    }
  };

  const handleLoadProject = (project) => {
    editor.loadProjectIntoEditor(project);
    setShowProjectManager(false);
    
    // Voa para o projeto
    if (project.points && project.points.length > 0 && mapRef.current) {
        const p = project.points[0];
        mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 16 });
    }
  };

  // No App.jsx
const handleImportKML = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // NÃO passe extraConnections aqui se não tiver, o hook já tem valor padrão []
  const newProject = await projectManager.importProjectFromKML(file);
  
  if (newProject) {
    handleLoadProject(newProject);
    showFeedback('Importado', 'Projeto carregado do KML.', 'success');
  }
  // Reseta o input para permitir importar o mesmo arquivo de novo se quisers
  e.target.value = '';
};

  const handleMapClick = async (e) => {
    // 1. Evita clique se estiver clicando em controles
    if (e.originalEvent.defaultPrevented) return;

    // 2. Se estiver rastreando por toque, adiciona ponto
    if (editor.tracking && trackingInputMode === 'touch' && !editor.paused) {
      const { lat, lng } = e.lngLat;
      let pos = { lat, lng };

      if (snappingEnabled) {
        const snap = await RoadSnappingService.snapToRoad(lat, lng);
        if (snap.snapped) pos = { lat: snap.lat, lng: snap.lng };
      }
      
      editor.addPoint(pos);
      return;
    }

    // 3. Detecção de clique em Marcadores (Features)
    const features = e.target.queryRenderedFeatures(e.point, {
        layers: ['markers-layer', 'segment-badge-bg'] // Camadas interativas
    });

    if (features.length > 0) {
        const feature = features[0];
        // Lógica de abrir popup do marcador...
        // Simplificado para o exemplo:
        console.log("Clicou em:", feature.properties);
        // setPopupMarker(...)
    }
  };

  // --- RENDERIZAÇÃO ---

  if (authLoading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-cyan-400">Carregando Sistema...</div>;
  if (!user) return <Auth />;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      
      {/* 1. MAPA */}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -35.7, latitude: -9.6, zoom: 12 }}
        mapStyle={MAP_STYLES[mapStyle].url}
        mapboxAccessToken={MAPBOX_TOKEN}
        onClick={handleMapClick}
        onStyleLoad={(e) => {
            // Carregamento Seguro do 3D
            const map = e.target;
            try {
                if (!map.getSource('mapbox-dem')) {
                    map.addSource('mapbox-dem', {
                        'type': 'raster-dem',
                        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                        'tileSize': 512,
                        'maxzoom': 14
                    });
                }
                map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
            } catch(err) { console.warn("3D Terrain indisponível"); }
        }}
      >
        <NavigationControl position="top-right" />
        
        {/* Layer do Céu */}
        <Layer id="sky" type="sky" paint={{ 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0.0, 0.0], 'sky-atmosphere-sun-intensity': 15 }} />

        {/* Marcador do Usuário */}
        {currentPosition && (
           <Marker longitude={currentPosition.lng} latitude={currentPosition.lat}>
             <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg pulse-animation"></div>
           </Marker>
        )}

        {/* Renderização do Projeto Atual (Pontos e Linhas) */}
        {/* Aqui usamos os dados do hook 'editor' */}
        {editor.manualPoints.length > 0 && (
           <>
             {/* Linhas */}
             <Source id="current-line" type="geojson" data={{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: editor.manualPoints.map(p => [p.lng, p.lat]) // Simplificado, ideal usar lógica de árvore
                }
             }}>
                <Layer id="line-layer" type="line" paint={{ 'line-color': '#06b6d4', 'line-width': 4 }} />
             </Source>

             {/* Pontos (Postes) */}
             {editor.manualPoints.map((p, idx) => (
                <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); /* Abrir popup */ }}>
                    <div className="flex flex-col items-center">
                        <img src={electricPoleIcon} className="w-8 h-8 drop-shadow-md" />
                        <span className="bg-slate-900/80 text-white text-[10px] px-1 rounded mt-[-5px]">{idx + 1}</span>
                    </div>
                </Marker>
             ))}
           </>
        )}
      </Map>

      {/* 2. INTERFACE FLUTUANTE (OVERLAYS) */}
      
      {/* Menu Lateral */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button size="icon" className="absolute top-4 left-4 z-10 bg-slate-950/90 border border-white/10 text-cyan-400">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-slate-950 border-r border-white/10 text-white">
            <div className="p-4">
                <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2"><MapPinned /> Jamaaw</h2>
                <div className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start" onClick={() => { setSidebarOpen(false); setShowProjectManager(true); }}>
                        <Layers className="mr-2 h-4 w-4" /> Projetos ({projectManager.projects.length})
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-red-400" onClick={logout}>
                        Sair
                    </Button>
                </div>
            </div>
        </SheetContent>
      </Sheet>

      {/* Controles do Mapa (GPS, Estilo) */}
      <MapControls 
        onCenterMap={() => currentPosition && mapRef.current?.flyTo({ center: [currentPosition.lng, currentPosition.lat], zoom: 16 })}
        currentMapStyle={mapStyle}
        onChangeStyle={setMapStyle}
        isTrackingActive={editor.tracking}
      />

      {/* Dock de Ferramentas (Rodapé) */}
      <ToolsDock 
        active={editor.tracking}
        onStartGPS={() => handleStartTracking('gps')}
        onStartTouch={() => handleStartTracking('touch')}
        onStartAR={() => setArMode(true)}
        onNewProject={() => editor.clearEditor()}
      />

      {/* Controles de Rastreamento (Quando ativo) */}
      {editor.tracking && (
         <ControlesRastreamento 
            tracking={editor.tracking}
            paused={editor.paused}
            pauseTracking={() => editor.setPaused(p => !p)}
            stopTracking={() => editor.setTracking(false)}
            addManualPoint={() => currentPosition && editor.addPoint(currentPosition)}
            manualPoints={editor.manualPoints}
            totalDistance={editor.totalDistance}
            undoLastPoint={editor.undoLastPoint}
            gpsAccuracy={accuracy}
            speed={speed}
            // Passamos a função de salvar do editor
            setShowProjectDialog={() => handleSaveProject()} 
         />
      )}

      {/* 3. MODAIS E DIÁLOGOS */}
      
      {/* Gerenciador de Projetos */}
      <ProjectManager 
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        projects={projectManager.projects}
        currentUserId={user?.id}
        onLoadProject={handleLoadProject}
        onDeleteProject={projectManager.deleteProject}
        onExportProject={(p) => {/* Lógica de exportar KML */}}
        onOpenMembers={(p) => { setInspectingProject(p); setShowMembersDialog(true); }}
        onOpenReport={(p) => setReportData({ project: p, image: null })}
      />

      {/* Hub de Equipe */}
      <ProjectMembersDialog 
        isOpen={showMembersDialog}
        onClose={() => { setShowMembersDialog(false); setInspectingProject(null); }}
        project={inspectingProject || editor.currentProject}
        currentUserId={user?.id}
      />

      {/* Relatório */}
      <ProjectReport 
        isOpen={!!reportData}
        onClose={() => setReportData(null)}
        project={reportData?.project}
        currentUserEmail={user?.email}
      />

      {/* Progresso de Importação */}
      <ImportProgressPopup 
        isOpen={projectManager.importStatus.active}
        progress={projectManager.importStatus.progress}
        currentAction={projectManager.importStatus.action}
        success={projectManager.importStatus.success}
        error={projectManager.importStatus.error}
        onClose={() => projectManager.setImportStatus(s => ({...s, active: false}))}
      />

      {/* Realidade Aumentada */}
      {arMode && (
        <ARCamera 
            onClose={() => setArMode(false)}
            manualPoints={editor.manualPoints}
            currentPosition={currentPosition}
        />
      )}

      {/* Notificações */}
      <GlowNotification notification={notification} onClose={() => setNotification(null)} />
      
      {/* Input de Arquivo (Hidden) */}
      <input 
         type="file" 
         id="kml-import" 
         className="hidden" 
         accept=".kml,.kmz" 
         onChange={handleImportKML}
      />

    </div>
  );
}

export default App;