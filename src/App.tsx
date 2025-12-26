import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { useGeolocation } from './hooks/useGeolocation';
import { useProjectSync } from './hooks/useProjectSync';
import { generateUUID } from './utils/geoUtils';
import { Point, Project, MarkerData } from './types';

// Components
import MapView from './components/Map/MapView';
import ToolsDock from './components/ToolsDock';
// @ts-ignore
import ProjectManager from './components/ProjectManager';
import GlowNotification from './components/GlowNotification';
// @ts-ignore
import Auth from './components/Auth'; // Legacy Component
// @ts-ignore
import ControlesRastreamento from './components/ControlesRastreamento'; // Legacy Component
// @ts-ignore
import ProjectReport from './components/ProjectReport'; // Legacy Component

import './App.css';

interface User {
  id: string;
  email?: string;
}

interface NotificationState {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- UI STATE ---
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [reportProject, setReportProject] = useState<Project | null>(null);

  // --- MARKERS STATE (Legacy compatibility) ---
  const [markers] = useState<MarkerData[]>([]);

  // --- HOOKS ---
  // GPS & Tracking Logic
  const {
    currentPosition,
    gpsAccuracy,
    speed,
    isTracking,
    trackingMode,
    paused,
    startTracking,
    stopTracking,
    togglePause
  } = useGeolocation();

  // Project & Data Sync Logic
  const {
    projects,
    loadedProjects,
    currentProject,
    manualPoints,
    totalDistance,
    setManualPoints,
    deleteProject,
    loadProjectIntoView
  } = useProjectSync(user, true); // Assuming online for now

  // --- AUTH EFFECT ---
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setAuthLoading(false);
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- TRACKING EFFECT: SYNC GPS TO POINTS ---
  useEffect(() => {
    if (isTracking && !paused && currentPosition) {
      const newPoint: Point = {
        id: generateUUID(),
        lat: currentPosition.lat,
        lng: currentPosition.lng,
        timestamp: Date.now(),
        // Simple sequential connection logic
        connectedFrom: manualPoints.length > 0 ? manualPoints[manualPoints.length - 1].id : null,
        spans: 1, // Default span
        user_id: user?.id
      };

      // Append point to current project state
      setManualPoints(prev => [...prev, newPoint]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, isTracking, paused]);
  // Dependency on manualPoints.length would cause loop, but we use callback form of setManualPoints

  // --- HANDLERS ---

  const handleNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ title, message, type });
  };

  const handleStartGPS = useCallback(() => {
    startTracking('gps');
    handleNotification('Rastreamento Iniciado', 'Modo GPS ativado', 'success');
  }, [startTracking]);

  const handleStartTouch = useCallback(() => {
    startTracking('touch');
    handleNotification('Modo Toque', 'Toque no mapa para adicionar postes', 'info');
  }, [startTracking]);

  // Touch/Map Click Handler (Bridge)
  const handleMapClick = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    if (isTracking && trackingMode === 'touch' && !paused) {
      const { lat, lng } = e.lngLat;
      const newPoint: Point = {
        id: generateUUID(),
        lat,
        lng,
        timestamp: Date.now(),
        connectedFrom: manualPoints.length > 0 ? manualPoints[manualPoints.length - 1].id : null,
        spans: 1,
        user_id: user?.id
      };
      setManualPoints(prev => [...prev, newPoint]);
    }
  }, [isTracking, trackingMode, paused, manualPoints, user, setManualPoints]);

  const handlePointClick = useCallback((point: Point, project?: Project) => {
    console.log("Point clicked", point, project);
    // Future: Open detail popup
  }, []);

  const handleStopTracking = useCallback(async () => {
    if (manualPoints.length > 0) {
      // Auto-save logic could go here
      // For now, just stop
    }
    stopTracking();
    setManualPoints([]); // Clear transient points
    handleNotification('Parado', 'Rastreamento finalizado', 'warning');
  }, [manualPoints, stopTracking, setManualPoints]);

  const handleNewProject = useCallback(() => {
    stopTracking();
    setManualPoints([]);
    handleNotification('Novo Projeto', 'Pronto para iniciar', 'info');
  }, [stopTracking, setManualPoints]);

  // --- RENDER ---

  if (authLoading) return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-cyan-500">Carregando...</div>;
  if (!user) return <Auth onAuthSuccess={(u: User) => setUser(u)} />;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">

      {/* 1. MAP LAYER (Bottom) */}
      <div className="absolute inset-0 z-0">
        <MapView
          mapboxToken="pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q"
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          initialViewState={{
            longitude: -35.7353,
            latitude: -9.6658,
            zoom: 13
          }}
          markers={markers}
          loadedProjects={loadedProjects}
          manualPoints={manualPoints}
          currentPosition={currentPosition}
          selectedStartPoint={manualPoints.length > 0 ? manualPoints[manualPoints.length - 1] : null}
          tracking={isTracking}
          trackingInputMode={trackingMode}
          paused={paused}
          onMapClick={handleMapClick}
          onMarkerClick={() => {}}
          onPointClick={handlePointClick}
        />
      </div>

      {/* 2. UI OVERLAY LAYER (Top) */}

      {/* Top Bar / Menu Trigger would go here */}
      <div className="absolute top-4 left-4 z-20">
         <button
           onClick={() => setShowProjectManager(true)}
           className="h-10 w-10 bg-slate-900/80 backdrop-blur rounded-xl border border-white/10 flex items-center justify-center text-cyan-400 shadow-lg"
         >
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
         </button>
      </div>

      {/* Tracking Controls (Legacy Component Integration) */}
      {isTracking && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
          <ControlesRastreamento
            tracking={isTracking}
            paused={paused}
            pauseTracking={togglePause}
            stopTracking={handleStopTracking}
            totalDistance={totalDistance}
            speed={speed}
            gpsAccuracy={gpsAccuracy}
            manualPoints={manualPoints}
            addManualPoint={() => {}} // Not needed for GPS/Touch auto logic
            formatDistanceDetailed={(d: number) => `${d.toFixed(1)}m`}
            setShowProjectDialog={() => {}} // Placeholder
            setShowProjectDetails={() => {}} // Placeholder
            trackingMode={trackingMode}
            currentPosition={currentPosition}
            currentProject={currentProject} // Added missing prop
            snappingEnabled={true}
            onToggleSnapping={() => {}}
            handleRemovePoints={() => {}}
            showProjectDialog={false}
            undoLastPoint={() => {}}
            selectedStartPoint={null}
            resetStartPoint={() => {}}
          />
        </div>
      )}

      {/* Tools Dock (Main Navigation) */}
      <ToolsDock
        active={isTracking}
        onStartGPS={handleStartGPS}
        onStartTouch={handleStartTouch}
        onStartAR={() => handleNotification("AR", "Em breve", "info")}
        onNewProject={handleNewProject}
      />

      {/* Modals & Dialogs */}
      <ProjectManager
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        projects={projects}
        currentUserId={user.id}
        onLoadProject={(p: Project) => {
          loadProjectIntoView(p);
          setShowProjectManager(false);
        }}
        onDeleteProject={deleteProject}
        onExportProject={() => {}}
        onJoinProject={() => {}}
        onRenameProject={() => {}}
        onOpenReport={(p: Project) => setReportProject(p)}
      />

      {reportProject && (
        <ProjectReport
          isOpen={true}
          onClose={() => setReportProject(null)}
          project={reportProject}
          currentUserEmail={user.email}
        />
      )}

      <GlowNotification
        notification={notification}
        onClose={() => setNotification(null)}
      />

    </div>
  );
}

export default App;
