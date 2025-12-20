import React, { useState, useEffect, useMemo } from 'react';
import { Users, Shield, UserX, Calendar, Crown, Mail, Activity, MapPin, TrendingUp, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '../supabase'; // Verifique o caminho
import { calculateTotalProjectDistance } from '../utils/geoUtils'; // Importe a função mestra

const ProjectMembersDialog = ({ isOpen, onClose, project, currentUserId }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Calcula estatísticas por usuário
    const userStats = useMemo(() => {
        if (!project || !project.points) return {};
        
        const stats = {};
        
        // Processa os pontos para saber quem criou o que
        // Nota: Seu objeto 'points' precisa ter um campo 'user_id' ou similar. 
        // Se não tiver, o app assumirá que todos os pontos são do dono ou não atribuídos.
        // Vamos assumir uma distribuição baseada no 'created_by' se existir, senão fica geral.
        
        project.points.forEach(point => {
            // Fallback: se o ponto não tem ID do criador, atribui ao dono do projeto
            const creatorId = point.created_by || point.user_id || project.user_id;
            
            if (!stats[creatorId]) {
                stats[creatorId] = { points: 0, distance: 0 };
            }
            stats[creatorId].points += 1;
            // Distância é complexa de atribuir por ponto único, mas podemos estimar pela ramificação
            // Simplificação: Atribuímos a distância deste ponto ao anterior para este usuário
        });
        
        return stats;
    }, [project]);
    
    useEffect(() => {
        if (isOpen && project?.id) {
            fetchMembers();
        }
    }, [isOpen, project]);
    
    const fetchMembers = async () => {
        setLoading(true);
        try {
            const { data: memberData, error } = await supabase
                .from('project_members')
                .select('user_id, role, joined_at')
                .eq('project_id', project.id);
            
            if (error) throw error;
            
            // Adiciona o Dono na lista se ele não estiver na tabela de membros
            let allMembers = memberData || [];
            const ownerExists = allMembers.find(m => m.user_id === project.user_id);
            
            if (!ownerExists) {
                allMembers.unshift({
                    user_id: project.user_id,
                    role: 'owner',
                    joined_at: project.created_at
                });
            }
            
            if (allMembers.length > 0) {
                const userIds = allMembers.map(m => m.user_id);
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, email, full_name')
                    .in('id', userIds);
                
                const fullMembers = allMembers.map(member => {
                    const profile = profilesData?.find(p => p.id === member.user_id);
                    return {
                        ...member,
                        email: profile?.email || 'Email oculto',
                        name: profile?.full_name || 'Usuário',
                        // Injeta as estatísticas calculadas
                        stats: userStats[member.user_id] || { points: 0, distance: 0 }
                    };
                });
                
                setMembers(fullMembers);
            }
        } catch (e) {
            console.error("Erro ao buscar membros:", e);
        } finally {
            setLoading(false);
        }
    };
    
    const isOwner = project?.user_id === currentUserId;
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10020] top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-slate-950 border border-slate-800 text-white w-[95vw] max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col p-0 overflow-hidden">
        
        {/* Header Bonito */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b border-white/5 flex justify-between items-center">
            <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                    <Activity className="text-cyan-400" /> Hub do Projeto
                </DialogTitle>
                <p className="text-sm text-slate-400 mt-1">{project?.name}</p>
            </div>
            
            {/* Mini Resumo no Topo */}
            <div className="flex gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Pontos Totais</p>
                    <p className="text-lg font-mono text-white">{project?.points?.length || 0}</p>
                </div>
            </div>
        </div>

        <Tabs defaultValue="members" className="flex-1 flex flex-col">
            <div className="px-6 pt-4">
                <TabsList className="bg-slate-900 border border-white/10 w-full justify-start">
                    <TabsTrigger value="members" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white"><Users size={14} className="mr-2"/> Equipe</TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"><BarChart3 size={14} className="mr-2"/> Produtividade</TabsTrigger>
                </TabsList>
            </div>

            {/* ABA DE MEMBROS (ESTILO LISTA) */}
            <TabsContent value="members" className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {loading ? <p className="text-center text-slate-500">Carregando...</p> : members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner
                                ${member.role === 'owner' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-white/5'}
                            `}>
                                {member.email ? member.email[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                                <p className="text-base font-bold text-white flex items-center gap-2">
                                    {member.name || member.email.split('@')[0]}
                                    {member.role === 'owner' && <Crown size={14} className="text-amber-500 fill-amber-500" />}
                                </p>
                                <p className="text-xs text-slate-500">{member.email}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <span className={`text-xs px-2 py-1 rounded-full border ${member.role === 'owner' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-slate-600 text-slate-400'}`}>
                                {member.role === 'owner' ? 'Administrador' : 'Colaborador'}
                             </span>
                        </div>
                    </div>
                ))}
            </TabsContent>

            {/* ABA DE ESTATÍSTICAS (DASHBOARD COMPLEXO) */}
            <TabsContent value="stats" className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Card Geral */}
                     <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center gap-2"><MapPin size={14}/> Distribuição de Pontos</h4>
                        {members.map(m => {
                            const percent = project?.points?.length ? (m.stats.points / project.points.length) * 100 : 0;
                            return (
                                <div key={m.user_id} className="mb-4">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-white">{m.name || m.email.split('@')[0]}</span>
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