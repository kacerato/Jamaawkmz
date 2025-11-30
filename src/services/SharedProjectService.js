import { supabase } from '../lib/supabase';

// Gera um código aleatório tipo "JMW-X92Z"
const generateShareCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'JMW-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const SharedProjectService = {
  // Cria ou recupera o código de compartilhamento
  async getOrCreateShareCode(projectId, userId) {
    try {
      // 1. Tenta buscar existente
      const { data: existing } = await supabase
        .from('project_shares')
        .select('share_code')
        .eq('project_id', projectId)
        .single();
      
      if (existing) return existing.share_code;
      
      // 2. Se não existe, cria novo (apenas o dono consegue devido ao RLS)
      const newCode = generateShareCode();
      const { data, error } = await supabase
        .from('project_shares')
        .insert([{ project_id: projectId, share_code: newCode }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Log da criação
      await this.logAction(projectId, 'CREATE_SHARE', 'Criou link de compartilhamento');
      
      return data.share_code;
    } catch (error) {
      console.error('Erro ao gerar share code:', error);
      throw error;
    }
  },
  
  // ATUALIZADA: Entra em um projeto usando a função SQL segura
  async joinProject(shareCode, userId) {
    try {
      const { data, error } = await supabase.rpc('join_project_via_code', {
        code_input: shareCode,
        user_id_input: userId
      });
      
      if (error) throw error;
      
      // Se a RPC retornou o projeto, retorna sucesso
      if (data && data.id) {
        return {
          success: true,
          project: data,
          message: 'Projeto adicionado com sucesso!'
        };
      } else {
        return {
          success: false,
          message: 'Projeto não encontrado ou código inválido'
        };
      }
    } catch (error) {
      console.error('Erro ao entrar no projeto:', error);
      return {
        success: false,
        message: error.message || 'Erro ao processar código'
      };
    }
  },
  
  // Busca o histórico (Apenas Dono)
  async getProjectHistory(projectId) {
    const { data, error } = await supabase
      .from('project_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  // Registra uma ação
  async logAction(projectId, actionType, details) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('project_logs').insert([{
        project_id: projectId,
        user_id: user.id,
        user_email: user.email,
        action_type: actionType,
        details: details
      }]);
    } catch (error) {
      console.error('Erro silencioso ao logar:', error);
    }
  }
};