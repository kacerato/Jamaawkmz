import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dbService } from '../services/dbService'; // Ajuste o import conforme seu arquivo real

// Helper para remover duplicatas
const deduplicateProjects = (projectsList) => {
  const uniqueMap = new Map();
  projectsList.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  projectsList.forEach(p => { if (!uniqueMap.has(p.id)) uniqueMap.set(p.id, p); });
  return Array.from(uniqueMap.values());
};

export function useProjects(user, isOnline) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // 1. Carregar
  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Local
      const localRaw = localStorage.getItem('jamaaw_projects');
      const localProjects = localRaw ? JSON.parse(localRaw) : [];
      
      // Nuvem
      let cloudProjects = [];
      if (isOnline) {
        const { data, error } = await supabase
          .from('projetos')
          .select('*')
          .eq('user_id', user.id);
        if (!error && data) cloudProjects = data;
      }
      
      const merged = deduplicateProjects([...cloudProjects, ...localProjects]);
      setProjects(merged);
      localStorage.setItem('jamaaw_projects', JSON.stringify(merged));
    } catch (err) {
      console.error("Erro ao carregar projetos:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);
  
  // 2. Renomear (A função nova que você pediu)
  const renameProject = async (projectId, newName) => {
    // Otimistic Update (Atualiza na tela na hora)
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, name: newName, updated_at: new Date().toISOString() } : p);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updated));
      return updated;
    });
    
    if (isOnline) {
      const { error } = await supabase
        .from('projetos')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', projectId);
      
      if (error) {
        console.error("Erro ao renomear na nuvem:", error);
        // Reverteria aqui se fosse crítico, mas vamos manter o local
      }
    }
  };
  
  // 3. Deletar
  const deleteProject = async (projectId) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== projectId);
      localStorage.setItem('jamaaw_projects', JSON.stringify(updated));
      return updated;
    });
    
    if (isOnline && !projectId.toString().startsWith('offline_')) {
      await supabase.from('projetos').delete().eq('id', projectId);
    }
  };
  
  return {
    projects,
    setProjects,
    loadProjects,
    renameProject,
    deleteProject,
    loading
  };
}