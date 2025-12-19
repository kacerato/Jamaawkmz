import React, { useState, useEffect } from 'react';
import { Users, Shield, UserX, Calendar, Crown, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '../supabase'; // IMPORTANTE: Verifique se o caminho do seu supabase.js está correto aqui

const ProjectMembersDialog = ({ isOpen, onClose, projectId, currentUserId, isOwner }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isOpen && projectId) {
      fetchMembers();
    }
  }, [isOpen, projectId]);
  
  const fetchMembers = async () => {
    setLoading(true);
    try {
      // 1. Busca os membros na tabela de junção
      const { data: memberData, error } = await supabase
        .from('project_members')
        .select('user_id, role, joined_at')
        .eq('project_id', projectId);
      
      if (error) throw error;
      
      if (memberData && memberData.length > 0) {
        // 2. Busca os detalhes do perfil para cada membro (Email, Nome)
        // Nota: Isso evita joins complexos se as tabelas não estiverem perfeitamente linkadas
        const userIds = memberData.map(m => m.user_id);
        
        const { data: profilesData } = await supabase
          .from('profiles') // Assumindo que você tem uma tabela profiles. Se não, terá que ajustar.
          .select('id, email, full_name')
          .in('id', userIds);
        
        // Mescla os dados
        const fullMembers = memberData.map(member => {
          const profile = profilesData?.find(p => p.id === member.user_id);
          return {
            ...member,
            email: profile?.email || 'Email oculto',
            name: profile?.full_name || 'Usuário'
          };
        });
        
        setMembers(fullMembers);
      } else {
        setMembers([]);
      }
    } catch (e) {
      console.error("Erro ao buscar membros:", e);
    } finally {
      setLoading(false);
    }
  };
  
  const removeMember = async (userId) => {
    if (!confirm("Tem certeza que deseja remover este usuário do projeto?")) return;
    
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Remove da lista local visualmente
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      
    } catch (error) {
      alert("Erro ao remover membro.");
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10020] top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-slate-950 border border-slate-800 text-white w-[90vw] max-w-md rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="text-cyan-400" /> Membros do Projeto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mb-2"></div>
               <p>Carregando equipe...</p>
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-slate-500 py-6">
                Nenhum membro encontrado (além do dono).
            </p>
          ) : (
            members.map((member) => (
              <div key={member.user_id} className="group flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  {/* Avatar com Iniciais */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner
                    ${member.role === 'owner' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-white/5'}
                  `}>
                    {member.email ? member.email[0].toUpperCase() : 'U'}
                  </div>
                  
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      {member.name || member.email.split('@')[0]}
                      {member.role === 'owner' && <Crown size={12} className="text-amber-500 fill-amber-500" />}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Mail size={10} /> {member.email}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(member.joined_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Botão de Remover (Só aparece se eu for o dono e o alvo não for o dono) */}
                {isOwner && member.role !== 'owner' && member.user_id !== currentUserId && (
                  <button 
                    onClick={() => removeMember(member.user_id)}
                    className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Remover acesso"
                  >
                    <UserX size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectMembersDialog;