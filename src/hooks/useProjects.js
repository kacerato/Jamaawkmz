import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Helper para remover duplicatas (caso apareça nos dois lugares)
const deduplicateProjects = (projectsList) => {
  const uniqueMap = new Map();
  // Ordena por data mais recente
  projectsList.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  projectsList.forEach(p => { 
    if (!uniqueMap.has(p.id)) uniqueMap.set(p.id, p); 
  });
  return Array.from(uniqueMap.values());
};

export function useProjects(user, isOnline) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // 1. Carregar do LocalStorage (Cache Instantâneo)
      const localRaw = localStorage.getItem(`jamaaw_projects_${user.id}`); // <--- Use ID do user na key
      const localProjects = localRaw ? JSON.parse(localRaw) : [];
      
      let cloudProjects = [];
      let sharedProjects = [];

      if (isOnline) {
        // 2. BUSCA 1: Projetos que EU SOU O DONO
        const { data: myData, error: myError } = await supabase
          .from('projetos')
          .select('*')
          .eq('user_id', user.id); // <--- Apenas meus
        
        if (!myError && myData) cloudProjects = myData;

        // 3. BUSCA 2: Projetos que SOU MEMBRO (Compartilhados)
        // Precisamos consultar a tabela de junção (provavelmente 'project_members')
        // Se você não tiver essa tabela mapeada diretamente, usamos uma técnica de "Busca por IDs"
        
        try {
          // Busca IDs dos projetos onde sou membro
          const { data: memberData, error: memberError } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user.id);

          if (!memberError && memberData && memberData.length > 0) {
            const projectIds = memberData.map(m => m.project_id);
            
            // Busca os detalhes desses projetos
            const { data: sharedData, error: sharedError } = await supabase
              .from('projetos')
              .select('*')
              .in('id', projectIds); // <--- Busca projetos por lista de IDs

            if (!sharedError && sharedData) {
              sharedProjects = sharedData;
            }
          }
        } catch (err) {
          console.warn("Erro ao buscar projetos compartilhados (talvez tabela não exista ainda):", err);
        }
      }
      
      // 4. MESTURAR TUDO (Meus + Compartilhados + Locais)
      const allCloud = [...cloudProjects, ...sharedProjects];
      const merged = deduplicateProjects([...allCloud, ...localProjects]);
      
      setProjects(merged);
      
      // Salva no cache
      localStorage.setItem(`jamaaw_projects_${user.id}`, JSON.stringify(merged));
      
    } catch (err) {
      console.error("Erro geral ao carregar projetos:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);
  
  // Função de Renomear
  const renameProject = async (projectId, newName) => {
    // Atualização Otimista
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, name: newName, updated_at: new Date().toISOString() } : p);
      localStorage.setItem(`jamaaw_projects_${user?.id}`, JSON.stringify(updated));
      return updated;
    });
    
    if (isOnline) {
      await supabase
        .from('projetos')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', projectId);
    }
  };
  
  // Função de Deletar
  const deleteProject = async (projectId) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== projectId);
      localStorage.setItem(`jamaaw_projects_${user?.id}`, JSON.stringify(updated));
      return updated;
    });
    
    if (isOnline && !projectId.toString().startsWith('offline_')) {
      // Tenta deletar (Se for dono deleta projeto, se for membro sai do projeto)
      // Idealmente o backend (RLS) decide isso, mas podemos tentar delete direto
      const { error } = await supabase.from('projetos').delete().eq('id', projectId);
      
      if (error) {
          // Se falhar (ex: erro de chave estrangeira ou permissão), talvez precise sair da tabela de membros
          // Mas geralmente o 'cascade' ou a permissão de delete resolve
          console.error("Erro ao deletar na nuvem:", error);
      }
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
