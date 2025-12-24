import { supabase } from '../lib/supabase';

const LOCK_DURATION_MINUTES = 5;

const ProjectLockService = {
  // Tenta adquirir o bloqueio
  async acquireLock(projectId, userId) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_DURATION_MINUTES);

    // Tenta atualizar se: Ninguém tem lock OU o lock expirou OU eu já sou o dono
    const { data, error } = await supabase
      .from('projetos')
      .update({ 
        locked_by: userId, 
        lock_expires_at: expiresAt.toISOString() 
      })
      .eq('id', projectId)
      .or(`locked_by.is.null,lock_expires_at.lt.${new Date().toISOString()},locked_by.eq.${userId}`)
      .select();

    if (error) {
      console.error("Erro ao travar projeto:", error);
      return false;
    }

    // Se retornou dados, conseguimos o lock.
    return data && data.length > 0;
  },

  // Mantém o bloqueio ativo (Heartbeat)
  async heartbeat(projectId, userId) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_DURATION_MINUTES);

    const { error } = await supabase
      .from('projetos')
      .update({ lock_expires_at: expiresAt.toISOString() })
      .eq('id', projectId)
      .eq('locked_by', userId);

    return !error;
  },

  // Libera o bloqueio ao sair/salvar
  async releaseLock(projectId, userId) {
    await supabase
      .from('projetos')
      .update({ 
        locked_by: null, 
        lock_expires_at: null 
      })
      .eq('id', projectId)
      .eq('locked_by', userId);
  },

  // Verifica status atual (para UI de Read-Only)
  async checkLockStatus(projectId, currentUserId) {
    const { data } = await supabase
      .from('projetos')
      .select('locked_by, lock_expires_at')
      .eq('id', projectId)
      .single();

    if (!data) return { isLocked: false };

    const now = new Date();
    const expires = new Date(data.lock_expires_at);
    const isExpired = expires < now;

    if (data.locked_by && !isExpired && data.locked_by !== currentUserId) {
      // Aqui poderíamos buscar o email do usuário se quisesse mostrar o nome
      return { isLocked: true, lockedBy: 'outro usuário' };
    }
    
    return { isLocked: false };
  }
};

export default ProjectLockService;