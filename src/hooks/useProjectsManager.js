import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { storage } from '../utils/storage';
import { generateUUID, calculateTotalProjectDistance } from '../utils/geoUtils';
import JSZip from 'jszip'; // Certifique-se de ter instalado: npm install jszip

// Função auxiliar local para remover duplicatas
const deduplicateProjects = (projectsList) => {
  const uniqueMap = new Map();
  // Ordena por data mais recente
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
  
  // Estados de Importação (Progresso)
  const [importStatus, setImportStatus] = useState({
    progress: 0,
    step: 0,
    action: '',
    error: null,
    success: false,
    active: false
  });
  
  // 1. CARREGAR PROJETOS (Load)
  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      return;
    }
    
    setLoading(true);
    try {
      // Carrega do Cache Local primeiro (Instantâneo)
      const localProjects = storage.loadProjects(user.id);
      
      if (isOnline) {
        // Busca da Nuvem
        const { data: cloudProjects, error } = await supabase
          .from('projetos')
          .select('*')
          .or(`user_id.eq.${user.id},id.in.(select project_id from project_members where user_id.eq.${user.id})`)
          .order('updated_at', { ascending: false });
        
        if (!error && cloudProjects) {
          // Mescla Nuvem + Local (Priorizando Nuvem)
          const merged = deduplicateProjects([...cloudProjects, ...localProjects]);
          setProjects(merged);
          storage.saveProjects(user.id, merged); // Atualiza cache
        } else {
          setProjects(localProjects);
        }
      } else {
        // Modo Offline
        setProjects(localProjects);
      }
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);
  
  // 2. SINCRONIZAR OFFLINE (Sync)
  const syncOfflineProjects = useCallback(async () => {
    if (!user || !isOnline) return;
    
    const localProjects = storage.loadProjects(user.id);
    const offlineProjects = localProjects.filter(p => p.id.toString().startsWith('offline_'));
    
    if (offlineProjects.length === 0) return;
    
    console.log(`Sincronizando ${offlineProjects.length} projetos offline...`);
    
    for (const project of offlineProjects) {
      try {
        // Remove o ID temporário e prepara para insert
        const { id, ...projectData } = project;
        const payload = {
          ...projectData,
          user_id: user.id,
          // Garante que o ID temporário não vá para o banco
        };
        
        const { data, error } = await supabase
          .from('projetos')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualiza o projeto local com o ID real da nuvem
        const updatedLocal = localProjects.map(p =>
          p.id === id ? data : p
        );
        storage.saveProjects(user.id, updatedLocal);
        
      } catch (err) {
        console.error(`Erro ao sincronizar projeto ${project.name}:`, err);
      }
    }
    
    // Recarrega tudo após sincronizar
    loadProjects();
  }, [user, isOnline, loadProjects]);
  
  // Efeito para carregar e sincronizar
  useEffect(() => {
    loadProjects();
    if (isOnline) syncOfflineProjects();
  }, [loadProjects, syncOfflineProjects, isOnline]);
  
  // 3. IMPORTAR KML (A lógica pesada movida para cá)
  const importProjectFromKML = useCallback(async (file, extraConnections = []) => {
    if (!file) return;
    
    setImportStatus({ active: true, progress: 0, step: 1, action: 'Iniciando...', error: null, success: false });
    
    try {
      const fileName = file.name.toLowerCase();
      let kmlText;
      
      // Leitura do Arquivo
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
      
      // Parsing
      setImportStatus(s => ({ ...s, progress: 50, step: 3, action: 'Processando XML...' }));
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML inválido');
      }
      
      // Extração de Dados
      const nameElement = xmlDoc.getElementsByTagName('name')[0];
      const projectName = nameElement?.textContent || file.name.replace(/\.k(m[lz])$/i, '');
      
      const points = [];
      // (Lógica simplificada de extração - adapte se precisar da sua lógica específica de LineString vs Placemark)
      const placemarks = xmlDoc.getElementsByTagName('Placemark');
      const lineStrings = xmlDoc.getElementsByTagName('LineString');
      
      // Extrai de LineStrings (Traçados)
      for (let i = 0; i < lineStrings.length; i++) {
        const coords = lineStrings[i].getElementsByTagName('coordinates')[0]?.textContent;
        if (coords) {
          const list = coords.trim().split(/\s+/);
          list.forEach(c => {
            const [lng, lat] = c.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              points.push({ id: generateUUID(), lat, lng, timestamp: Date.now() });
            }
          });
        }
      }
      
      // Se não achou linhas, tenta pontos soltos
      if (points.length === 0) {
        for (let i = 0; i < placemarks.length; i++) {
          const coords = placemarks[i].getElementsByTagName('coordinates')[0]?.textContent;
          if (coords) {
            const [lng, lat] = coords.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              points.push({ id: generateUUID(), lat, lng, timestamp: Date.now() });
            }
          }
        }
      }
      
      if (points.length === 0) throw new Error('Nenhum ponto válido encontrado.');
      
      setImportStatus(s => ({ ...s, progress: 80, step: 4, action: 'Calculando geometria...' }));
      const totalDist = calculateTotalProjectDistance(points, extraConnections);
      
      // Criação do Objeto Projeto
      const newProject = {
        id: isOnline ? undefined : `offline_${Date.now()}`, // ID indefinido para o Supabase gerar, ou temp offline
        name: projectName,
        points: points,
        extra_connections: extraConnections,
        total_distance: totalDist,
        totalDistance: totalDist,
        tracking_mode: 'manual',
        bairro: 'Importado',
        created_at: new Date().toISOString(),
        user_id: user.id
      };
      
      // Salvamento
      setImportStatus(s => ({ ...s, progress: 90, step: 5, action: 'Salvando...' }));
      
      if (isOnline) {
        const { data, error } = await supabase.from('projetos').insert([newProject]).select().single();
        if (error) throw error;
        setProjects(prev => [data, ...prev]);
        storage.saveProjects(user.id, [data, ...projects]);
        setImportStatus({ active: false, success: true, progress: 100, step: 5, action: 'Concluído!', error: null });
        return data; // Retorna o projeto criado
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
  }, [user, isOnline, projects, extraConnections]); // Note: extraConnections pode vir de fora ou ser padrão
  
  // 4. DELETAR PROJETO
  const deleteProject = useCallback(async (projectId) => {
    // Otimistic Update
    const oldProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== projectId));
    storage.deleteProject(user?.id, projectId);
    
    if (isOnline && !projectId.toString().startsWith('offline_')) {
      try {
        const { error } = await supabase.from('projetos').delete().eq('id', projectId);
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao deletar na nuvem:', err);
        // Reverte em caso de erro (opcional, ou apenas avisa)
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
    importStatus, // Para mostrar barra de progresso na UI
    setImportStatus // Para limpar o status
  };
}