import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Trash2, Crown, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TeamDashboard = ({ isOpen, onClose, project, isOwner }) => {
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen && project) {
      loadMembers();
    }
  }, [isOpen, project]);
  
  const loadMembers = async () => {
    setLoading(true);
    // Busca dados dos membros (Se tivesse tabela de perfis, faríamos join aqui)
    // Como estamos usando auth básico, pegamos o user_id. 
    // Em um app real, você teria uma tabela 'profiles' para pegar o nome/email.
    const { data } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', project.id);
    setMembers(data || []);
    setLoading(false);
  };
  
  const copyCode = () => {
    navigator.clipboard.writeText(project.share_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const removeMember = async (memberId) => {
    if (!confirm('Remover este membro do projeto?')) return;
    
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);
    
    if (!error) loadMembers();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700 text-white max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden p-0 gap-0 rounded-2xl">
        
        {/* Header Visual */}
        <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-6 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-1">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Painel de Equipe</span>
              <span className="text-2xl font-bold text-white truncate">{project?.name}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Seção do Código (Apenas para donos ou visualização) */}
          <div className="space-y-3">
            <label className="text-sm text-slate-400 font-medium ml-1">Código de Acesso do Projeto</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl flex items-center justify-between px-4 py-3 relative group">
                <span className="text-2xl font-mono font-bold text-cyan-400 tracking-widest">
                  {project?.share_code || '------'}
                </span>
                <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
              </div>
              <Button 
                onClick={copyCode}
                className={`h-auto w-14 rounded-xl transition-all duration-300 ${
                  copied ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-600'
                }`}
              >
                {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-cyan-400" />}
              </Button>
            </div>
            <p className="text-xs text-slate-500 px-1">
              Compartilhe este código para que outros entrem no projeto instantaneamente.
            </p>
          </div>

          <div className="h-px w-full bg-slate-800" />

          {/* Lista de Membros */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm text-slate-400 font-medium">Membros Ativos ({members.length + 1})</label>
              <Button variant="ghost" size="sm" onClick={loadMembers} className="h-6 w-6 p-0 text-slate-500 hover:text-white">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden max-h-[200px] overflow-y-auto custom-scrollbar">
              {/* Dono (Você ou Outro) */}
              <div className="flex items-center justify-between p-3 border-b border-white/5 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Crown className="w-4 h-4 text-white fill-current" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Dono do Projeto</span>
                    <span className="text-[10px] text-amber-400">Administrador Total</span>
                  </div>
                </div>
              </div>

              {/* Lista de Colaboradores */}
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                      <Users className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-200 font-mono">
                        User {member.user_id.slice(0, 4)}...
                      </span>
                      <span className="text-[10px] text-cyan-400/70 bg-cyan-950/30 px-1.5 py-0.5 rounded w-fit">
                        Editor
                      </span>
                    </div>
                  </div>
                  
                  {isOwner && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeMember(member.id)}
                      className="h-8 w-8 text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remover membro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {members.length === 0 && (
                <div className="p-4 text-center text-slate-600 text-xs italic">
                  Nenhum colaborador entrou ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamDashboard;