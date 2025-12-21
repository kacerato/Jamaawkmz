import React, { useState, useEffect, useMemo } from 'react';
import { Users, Crown, Activity, MapPin, TrendingUp, BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Project, Member } from '@/types';

interface ProjectMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  currentUserId: string;
}

const ProjectMembersDialog: React.FC<ProjectMembersDialogProps> = ({ isOpen, onClose, project, currentUserId }) => {
    // @ts-ignore
    console.log(currentUserId);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Calcula estatísticas por usuário
    const userStats = useMemo(() => {
        if (!project || !project.points) return {};
        
        const stats: Record<string, { points: number, distance: number }> = {};
        
        project.points.forEach(point => {
            // Fallback: se o ponto não tem ID do criador, atribui ao dono do projeto
            const creatorId = point.created_by || point.user_id || project.user_id;
            
            if (!stats[creatorId]) {
                stats[creatorId] = { points: 0, distance: 0 };
            }
            stats[creatorId].points += 1;
        });
        
        return stats;
    }, [project]);
    
    useEffect(() => {
        if (isOpen && project?.id) {
            fetchMembers();
        } else {
            setMembers([]); // Limpa se fechar ou não tiver projeto
        }
    }, [isOpen, project]);
    
    const fetchMembers = async () => {
        if (!project) return;
        setLoading(true);
        setError(null);
        try {
            console.log(`[ProjectMembers] Fetching members for project: ${project.id}`);

            const { data: memberData, error: dbError } = await supabase
                .from('project_members')
                .select('user_id, role, joined_at')
                .eq('project_id', project.id);
            
            if (dbError) {
                console.error('[ProjectMembers] Database Error:', dbError);
                throw new Error(dbError.message);
            }
            
            // Adiciona o Dono na lista se ele não estiver na tabela de membros
            let allMembers: Partial<Member>[] = memberData || [];

            // Verifica se o dono já está na lista (para evitar duplicatas)
            const ownerExists = allMembers.find(m => m.user_id === project.user_id);
            
            if (!ownerExists) {
                allMembers.unshift({
                    user_id: project.user_id,
                    role: 'owner',
                    joined_at: project.created_at || new Date().toISOString()
                });
            }
            
            if (allMembers.length > 0) {
                const userIds = allMembers.map(m => m.user_id).filter((id): id is string => !!id);

                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, email, full_name')
                    .in('id', userIds);

                if (profilesError) {
                     console.warn('[ProjectMembers] Could not fetch profiles:', profilesError);
                     // Não quebra, apenas mostra sem nomes
                }
                
                const fullMembers = allMembers.map(member => {
                    const profile = profilesData?.find((p: any) => p.id === member.user_id);
                    return {
                        ...member,
                        email: profile?.email || 'Email oculto',
                        name: profile?.full_name || 'Usuário',
                        // Injeta as estatísticas calculadas
                        stats: member.user_id ? (userStats[member.user_id] || { points: 0, distance: 0 }) : { points: 0, distance: 0 }
                    } as Member;
                });
                
                setMembers(fullMembers);
            } else {
                setMembers([]);
            }
        } catch (e: any) {
            console.error("Erro CRÍTICO ao buscar membros:", e);
            setError(e.message || "Falha ao carregar membros.");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10020] top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-slate-950 border border-slate-800 text-white w-[95vw] max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col p-0 overflow-hidden outline-none">
        
        {/* Header Bonito */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b border-white/5 flex justify-between items-center shrink-0">
            <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                    <Activity className="text-cyan-400" /> Hub do Projeto
                </DialogTitle>
                <p className="text-sm text-slate-400 mt-1 truncate max-w-[200px]">{project?.name}</p>
            </div>
            
            {/* Mini Resumo no Topo */}
            <div className="flex gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Pontos Totais</p>
                    <p className="text-lg font-mono text-white">{project?.points?.length || 0}</p>
                </div>
            </div>
        </div>

        <Tabs defaultValue="members" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-4 shrink-0">
                <TabsList className="bg-slate-900 border border-white/10 w-full justify-start h-auto p-1">
                    <TabsTrigger value="members" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white py-2"><Users size={14} className="mr-2"/> Equipe</TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2"><BarChart3 size={14} className="mr-2"/> Produtividade</TabsTrigger>
                </TabsList>
            </div>

            {/* ABA DE MEMBROS (ESTILO LISTA) */}
            <TabsContent value="members" className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-3">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-500 text-sm">Carregando equipe...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-400 p-6 text-center border border-red-900/30 bg-red-950/10 rounded-2xl">
                        <AlertCircle size={32} className="mb-2 opacity-80" />
                        <p className="font-bold mb-1">Erro ao carregar membros</p>
                        <p className="text-xs text-red-300/70 mb-4 font-mono bg-black/20 p-2 rounded max-w-full break-all">{error}</p>
                        <Button variant="outline" size="sm" onClick={fetchMembers} className="border-red-500/30 hover:bg-red-500/20 text-red-300">
                            <RefreshCw size={14} className="mr-2" /> Tentar Novamente
                        </Button>
                    </div>
                ) : (
                    members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner shrink-0
                                ${member.role === 'owner' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-white/5'}
                            `}>
                                {member.email ? member.email[0].toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                                <p className="text-base font-bold text-white flex items-center gap-2 truncate">
                                    {member.name || (member.email ? member.email.split('@')[0] : 'Desconhecido')}
                                    {member.role === 'owner' && <Crown size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
                                </p>
                                <p className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-xs">{member.email}</p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                             <span className={`text-xs px-2 py-1 rounded-full border ${member.role === 'owner' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-slate-600 text-slate-400'}`}>
                                {member.role === 'owner' ? 'Administrador' : 'Colaborador'}
                             </span>
                        </div>
                    </div>
                )))}

                {!loading && !error && members.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                        <Users size={32} className="mx-auto mb-2 opacity-20" />
                        <p>Nenhum membro encontrado.</p>
                    </div>
                )}
            </TabsContent>

            {/* ABA DE ESTATÍSTICAS (DASHBOARD COMPLEXO) */}
            <TabsContent value="stats" className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Card Geral */}
                     <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center gap-2"><MapPin size={14}/> Distribuição de Pontos</h4>
                        {members.map(m => {
                            if (!m.stats) return null;
                            const percent = project?.points?.length ? (m.stats.points / project.points.length) * 100 : 0;
                            return (
                                <div key={m.user_id} className="mb-4">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-white">{m.name || (m.email ? m.email.split('@')[0] : 'U')}</span>
                                        <span className="text-cyan-400 font-mono">{m.stats.points} pts</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-500" style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                     </div>

                     {/* Card Detalhes */}
                     <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center gap-2"><TrendingUp size={14}/> Atividade Recente</h4>
                        <div className="space-y-3">
                             {/* Aqui você poderia listar as ultimas 5 ações se tivesse um log */}
                             <p className="text-sm text-slate-500 italic">Histórico detalhado em breve...</p>
                        </div>
                     </div>
                </div>
            </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
    );
};

export default ProjectMembersDialog;
