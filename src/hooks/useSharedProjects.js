// hooks/useSharedProjects.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useSharedProjects = (user) => {
  const [sharedProjects, setSharedProjects] = useState([]);
  const [realTimeChannel, setRealTimeChannel] = useState(null);
  
  // Carregar projetos compartilhados
  const loadSharedProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('project_access')
        .select(`
          permission_level,
          projetos (*)
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const projects = data
        .filter(item => item.projetos)
        .map(item => ({
          ...item.projetos,
          permission_level: item.permission_level,
          is_shared: item.perjetos.user_id !== user.id
        }));
      
      setSharedProjects(projects);
    } catch (error) {
      console.error('Erro ao carregar projetos compartilhados:', error);
    }
  }, [user]);
  
  // Configurar realtime
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projetos',
          filter: `id=in.(${sharedProjects.map(p => p.id).join(',')})`
        },
        (payload) => {
          console.log('Mudança realtime no projeto:', payload);
          
          if (payload.eventType === 'UPDATE') {
            setSharedProjects(prev =>
              prev.map(project =>
                project.id === payload.new.id ?
                { ...project, ...payload.new } :
                project
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setSharedProjects(prev =>
              prev.filter(project => project.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();
    
    setRealTimeChannel(channel);
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, sharedProjects]);
  
  // Adicionar projeto por código
  const addProjectByCode = async (shareCode) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Buscar projeto pelo código
      const { data: project, error: projectError } = await supabase
        .from('projetos')
        .select('*')
        .eq('share_code', shareCode.toUpperCase())
        .single();
      
      if (projectError) throw new Error('Projeto não encontrado');
      
      // Verificar se já tem acesso
      const { data: existingAccess } = await supabase
        .from('project_access')
        .select('*')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .single();
      
      if (existingAccess) {
        throw new Error('Você já tem acesso a este projeto');
      }
      
      // Adicionar acesso
      const { error: accessError } = await supabase
        .from('project_access')
        .insert({
          project_id: project.id,
          user_id: user.id,
          permission_level: 'view'
        });
      
      if (accessError) throw accessError;
      
      await loadSharedProjects();
      return project;
    } catch (error) {
      throw error;
    }
  };
  
  // Compartilhar projeto
  const shareProject = async (projectId, permissionLevel = 'view') => {
    if (!user) return;
    
    try {
      // Buscar código do projeto
      const { data: project, error } = await supabase
        .from('projetos')
        .select('share_code')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      
      return project.share_code;
    } catch (error) {
      throw error;
    }
  };
  
  // Remover acesso
  const removeAccess = async (projectId, targetUserId = null) => {
    if (!user) return;
    
    try {
      const query = supabase
        .from('project_access')
        .delete()
        .eq('project_id', projectId);
      
      if (targetUserId) {
        query.eq('user_id', targetUserId);
      } else {
        query.eq('user_id', user.id);
      }
      
      const { error } = await query;
      if (error) throw error;
      
      await loadSharedProjects();
    } catch (error) {
      throw error;
    }
  };
  
  useEffect(() => {
    loadSharedProjects();
  }, [loadSharedProjects]);
  
  return {
    sharedProjects,
    addProjectByCode,
    shareProject,
    removeAccess,
    loadSharedProjects
  };
};