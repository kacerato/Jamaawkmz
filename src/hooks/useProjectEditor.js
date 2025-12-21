import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Ajuste o caminho se necessário
import { storage } from '../utils/storage';
import { 
  calculateTotalProjectDistance, 
  generateUUID, 
  generateRandomColor 
} from '../utils/geoUtils';
import ProjectLockService from '../services/ProjectLockService';

export function useProjectEditor(user, isOnline) {
  // Estados Principais do Editor
  const [currentProject, setCurrentProject] = useState(null);
  const [manualPoints, setManualPoints] = useState([]);
  const [extraConnections, setExtraConnections] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [selectedStartPoint, setSelectedStartPoint] = useState(null);
  const [projectName, setProjectName] = useState('');
  
  // Estados de Controle
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- CÁLCULO AUTOMÁTICO ---
  // Sempre que pontos ou conexões mudam, recalcula a distância
  useEffect(() => {
    const total = calculateTotalProjectDistance(manualPoints, extraConnections);
    setTotalDistance(total);
  }, [manualPoints, extraConnections]);

  // --- AÇÕES DO EDITOR ---

  // 1. Adicionar Ponto
  const addPoint = useCallback((position) => {
    if (!position) return;

    const newPoint = {
      ...position,
      id: generateUUID(),
      timestamp: Date.now(),
      connectedFrom: selectedStartPoint ? selectedStartPoint.id : null,
      user_id: user?.id,
      spans: 1, // Padrão 1AG
    };

    setManualPoints(prev => [...prev, newPoint]);
    
    // Se estivermos desenhando um traçado, o novo ponto vira o novo "pai"
    if (selectedStartPoint) {
      setSelectedStartPoint(newPoint);
    }
    
    return newPoint;
  }, [selectedStartPoint, user]);

  // 2. Desfazer Último Ponto
  const undoLastPoint = useCallback(() => {
    setManualPoints(prev => {
      if (prev.length === 0) return prev;
      
      const newPoints = prev.slice(0, -1);
      const removedPoint = prev[prev.length - 1];
      
      // Lógica inteligente para resetar o ponto inicial
      if (selectedStartPoint && selectedStartPoint.id === removedPoint.id) {
        if (newPoints.length > 0) {
          // Tenta voltar para o pai do ponto removido
          const parent = removedPoint.connectedFrom 
            ? newPoints.find(p => p.id === removedPoint.connectedFrom)
            : newPoints[newPoints.length - 1];
          setSelectedStartPoint(parent || null);
        } else {
          setSelectedStartPoint(null);
        }
      }
      
      return newPoints;
    });
  }, [selectedStartPoint]);

  // 3. Carregar Projeto para Edição
  const loadProjectIntoEditor = useCallback(async (project) => {
    // Limpeza prévia
    setManualPoints([]);
    setExtraConnections([]);
    
    if (currentProject && isOnline && user) {
      await ProjectLockService.releaseLock(currentProject.id, user.id);
    }

    setCurrentProject(project);
    setProjectName(project.name);
    setManualPoints(project.points || []);
    setExtraConnections(project.extra_connections || []);
    setTracking(false);
    setPaused(false);
    
    // Define o último ponto como ativo para continuar traçando
    if (project.points && project.points.length > 0) {
      setSelectedStartPoint(project.points[project.points.length - 1]);
    } else {
      setSelectedStartPoint(null);
    }

    return true;
  }, [currentProject, isOnline, user]);

  // 4. Limpar/Novo Projeto
  const clearEditor = useCallback(async () => {
    if (currentProject && isOnline && user) {
      await ProjectLockService.releaseLock(currentProject.id, user.id);
    }
    setCurrentProject(null);
    setProjectName('');
    setManualPoints([]);
    setExtraConnections([]);
    setSelectedStartPoint(null);
    setTracking(false);
    setPaused(false);
  }, [currentProject, isOnline, user]);

  // 5. Salvar Projeto (A Lógica Pesada)
  const saveProject = useCallback(async (customName = null, autoSave = false) => {
    if (!user) return { success: false, error: 'Usuário não logado' };
    if (manualPoints.length === 0 && !currentProject) return { success: false, error: 'Sem pontos para salvar' };

    setIsSaving(true);
    try {
      const nameToUse = customName || projectName || currentProject?.name || `Projeto Sem Nome ${new Date().toLocaleDateString()}`;
      
      const projectData = {
        name: nameToUse.trim(),
        points: manualPoints,
        extra_connections: extraConnections,
        total_distance: totalDistance,
        updated_at: new Date().toISOString(),
        tracking_mode: 'manual',
        bairro: currentProject?.bairro || 'Vários'
      };

      let savedData;

      if (currentProject?.id && !currentProject.id.toString().startsWith('offline_')) {
        // ATUALIZAR EXISTENTE (ONLINE)
        if (isOnline) {
          const { data, error } = await supabase
            .from('projetos')
            .update(projectData)
            .eq('id', currentProject.id)
            .select()
            .single();
            
          if (error) throw error;
          savedData = data;
        } else {
          // Fallback Offline para projeto online (salva localmente até sincronizar)
          savedData = { ...currentProject, ...projectData };
        }
      } else {
        // CRIAR NOVO ou ATUALIZAR OFFLINE
        if (isOnline) {
          const { data, error } = await supabase
            .from('projetos')
            .insert([{ ...projectData, user_id: user.id }])
            .select()
            .single();
            
          if (error) throw error;
          savedData = data;
        } else {
          // Criar puramente offline
          savedData = {
            ...projectData,
            id: currentProject?.id || `offline_${Date.now()}`,
            user_id: user.id,
            created_at: new Date().toISOString()
          };
        }
      }

      // Atualiza estado local e Storage
      setCurrentProject(savedData);
      setProjectName(savedData.name);
      
      // Salva no LocalStorage para persistência
      const allProjects = storage.loadProjects(user.id);
      const otherProjects = allProjects.filter(p => p.id !== savedData.id);
      storage.saveProjects(user.id, [...otherProjects, savedData]);

      if (!autoSave) {
        // Se não for auto-save, libera o lock
        if (isOnline && savedData.id) {
           try { await ProjectLockService.releaseLock(savedData.id, user.id); } catch (e) { console.warn(e); }
        }
      }

      return { success: true, project: savedData };

    } catch (error) {
      console.error('Erro ao salvar:', error);
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, manualPoints, extraConnections, totalDistance, projectName, user, isOnline]);

  return {
    // Estado
    currentProject,
    projectName, setProjectName,
    manualPoints, setManualPoints,
    extraConnections, setExtraConnections,
    totalDistance,
    selectedStartPoint, setSelectedStartPoint,
    tracking, setTracking,
    paused, setPaused,
    isSaving,
    
    // Ações
    addPoint,
    undoLastPoint,
    loadProjectIntoEditor,
    clearEditor,
    saveProject
  };
}