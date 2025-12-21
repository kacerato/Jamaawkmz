import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { storage } from '../utils/storage';
import { generateUUID, calculateTotalProjectDistance } from '../utils/geoUtils';
import JSZip from 'jszip';

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

export function useProjectsManager(user, isOnline) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [importStatus, setImportStatus] = useState({
    progress: 0,
    step: 0,
    action: '',
    error: null,
    success: false,
    active: false
  });
  
  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      return;
    }
    
    setLoading(true);
    try {
      const localProjects = storage.loadProjects(user.id);
      
      if (isOnline) {
        const { data: cloudProjects, error } = await supabase
          .from('projetos')
          .select('*')
          .or(`user_id.eq.${user.id},id.in.(select project_id from project_members where user_id.eq.${user.id})`)
          .order('updated_at', { ascending: false });
        
        if (!error && cloudProjects) {
          const merged = deduplicateProjects([...cloudProjects, ...localProjects]);
          setProjects(merged);
          storage.saveProjects(user.id, merged);
        } else {
          setProjects(localProjects);
        }
      } else {
        setProjects(localProjects);
      }
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);
  
  const syncOfflineProjects = useCallback(async () => {
    if (!user || !isOnline) return;
    
    const localProjects = storage.loadProjects(user.id);
    const offlineProjects = localProjects.filter(p => p.id.toString().startsWith('offline_'));
    
    if (offlineProjects.length === 0) return;
    
    for (const project of offlineProjects) {
      try {
        const { id, ...projectData } = project;
        const payload = {
          ...projectData,
          user_id: user.id,
        };
        
        const { data, error } = await supabase
          .from('projetos')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        
        const updatedLocal = localProjects.map(p =>
          p.id === id ? data : p
        );
        storage.saveProjects(user.id, updatedLocal);
        
      } catch (err) {
        console.error(`Erro ao sincronizar:`, err);
      }
    }
    loadProjects();
  }, [user, isOnline, loadProjects]);
  
  useEffect(() => {
    loadProjects();
    if (isOnline) syncOfflineProjects();
  }, [loadProjects, syncOfflineProjects, isOnline]);
  
  // --- CORREÇÃO AQUI ---
  // extraConnections é argumento, não dependência de estado.
  const importProjectFromKML = useCallback(async (file, extraConnections = []) => {
    if (!file) return;
    
    setImportStatus({ active: true, progress: 0, step: 1, action: 'Iniciando...', error: null, success: false });
    
    try {
      const fileName = file.name.toLowerCase();
      let kmlText;
      
      if (fileName.endsWith('.kmz')) {
        setImportStatus(s => ({ ...s, progress: 20, step: 2, action: 'Descompactando KMZ...' }));
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const kmlFile = Object.keys(contents.files).find(name => name.toLowerCase().endsWith('.kml'));
        if (!kmlFile) throw new Error('KML não encontrado no KMZ');
        kmlText = await contents.files[kmlFile].async('text');
      } else {
        setImportStatus(s => ({ ...s, progress: 20, step: 2, action: 'Lendo KML...' }));
        kmlText = await file.text();
      }
      
      setImportStatus(s => ({ ...s, progress: 50, step: 3, action: 'Processando XML...' }));
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML inválido');
      }
      
      const nameElement = xmlDoc.getElementsByTagName('name')[0];
      const projectName = nameElement?.textContent || file.name.replace(/\.k(m[lz])$/i, '');
      
      const points = [];
      const placemarks = xmlDoc.getElementsByTagName('Placemark');
      const lineStrings = xmlDoc.getElementsByTagName('LineString');
      
      // Extração Robusta
      const extractCoords = (str) => {
        if (!str) return [];
        return str.trim().split(/\s+/).map(c => {
          const parts = c.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
          }
          return null;
        }).filter(Boolean);
      };
      
      for (let i = 0; i < lineStrings.length; i++) {
        const coords = lineStrings[i].getElementsByTagName('coordinates')[0]?.textContent;
        const extracted = extractCoords(coords);
        extracted.forEach(p => points.push({ id: generateUUID(), ...p, timestamp: Date.now() }));
      }
      
      if (points.length === 0) {
        for (let i = 0; i < placemarks.length; i++) {
          const coords = placemarks[i].getElementsByTagName('coordinates')[0]?.textContent;
          const extracted = extractCoords(coords);
          extracted.forEach(p => points.push({ id: generateUUID(), ...p, timestamp: Date.now() }));
        }
      }
      
      if (points.length === 0) throw new Error('Nenhum ponto válido encontrado.');
      
      setImportStatus(s => ({ ...s, progress: 80, step: 4, action: 'Calculando geometria...' }));
      
      // Garante que é array antes de calcular
      const safeConnections = Array.isArray(extraConnections) ? extraConnections : [];
      const totalDist = calculateTotalProjectDistance(points, safeConnections);
      
      const newProject = {
        id: isOnline ? undefined : `offline_${Date.now()}`,
        name: projectName,
        points: points,
        extra_connections: safeConnections,
        total_distance: totalDist,
        totalDistance: totalDist, // Compatibilidade legado
        tracking_mode: 'manual',
        bairro: 'Importado',
        created_at: new Date().toISOString(),
        user_id: user.id
      };
      
      setImportStatus(s => ({ ...s, progress: 90, step: 5, action: 'Salvando...' }));
      
      if (isOnline) {
        const { data, error } = await supabase.from('projetos').insert([newProject]).select().single();
        if (error) throw error;
        setProjects(prev => [data, ...prev]);
        storage.saveProjects(user.id, [data, ...projects]);
        setImportStatus({ active: false, success: true, progress: 100, step: 5, action: 'Concluído!', error: null });
        return data;
      } else {
        setProjects(prev => [newProject, ...prev]);
        storage.saveProjects(user.id, [newProject, ...projects]);
        setImportStatus({ active: false, success: true, progress: 100, step: 5, action: 'Salvo Offline!', error: null });
        return newProject;
      }
      
    } catch (error) {
      console.error('Erro Import:', error);
      setImportStatus(s => ({ ...s, error: error.message, action: 'Falha.', active: true }));
      return null;
    }
  }, [user, isOnline, projects]); // <--- REMOVIDO extraConnections DAQUI
  
  const deleteProject = useCallback(async (projectId) => {
    const oldProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== projectId));
    storage.deleteProject(user?.id, projectId);
    
    if (isOnline && !projectId.toString().startsWith('offline_')) {
      try {
        const { error } = await supabase.from('projetos').delete().eq('id', projectId);
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao deletar na nuvem:', err);
        setProjects(oldProjects);
        storage.saveProjects(user?.id, oldProjects);
        return false;
      }
    }
    return true;
  }, [projects, user, isOnline]);
  
  return {
    projects,
    loading,
    loadProjects,
    importProjectFromKML,
    deleteProject,
    importStatus,
    setImportStatus
  };
}