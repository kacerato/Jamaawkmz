import React, { useState, useEffect, useMemo } from 'react';
import { Users, Crown, Activity, TrendingUp, BarChart3, AlertCircle, RefreshCw, X, Shield, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Project, Member } from '@/types';
import { motion } from 'framer-motion';

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
            setMembers([]);
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

            let allMembers: Partial<Member>[] = memberData || [];
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
                }

                const fullMembers = allMembers.map(member => {
                    const profile = profilesData?.find((p: any) => p.id === member.user_id);
                    return {
                        ...member,
                        email: profile?.email || 'Email oculto',
                        name: profile?.full_name || 'Usuário',
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
      <DialogContent className="fixed z-[10020] top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-[80vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">

        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="flex flex-col h-full bg-slate-950/80 backdrop-blur-[30px] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5 relative"
        >
             {/* Background Effects */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none"></div>

            {/* Header */}
            <div className="flex-none p-6 pb-2 relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-900/50 to-slate-900 flex items-center justify-center border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                            <Activity className="text-purple-400" size={20}/>
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                             Hub do Projeto
                        </span>
                    </DialogTitle>
                    <button
                        onClick={onClose}
                        className="bg-white/5 hover:bg-red-500/20 p-2 rounded-full text-slate-400 hover:text-white transition-all backdrop-blur-md border border-white/5"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 mb-4 flex justify-between items-center shadow-inner">
                    <div>
                         <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">PROJETO ATUAL</p>
                         <p className="text-white font-bold truncate max-w-[200px]">{project?.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-cyan-400 font-bold bg-cyan-950/50 px-2 py-1 rounded-full border border-cyan-500/20">
                            {project?.points?.length || 0} PONTOS
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="members" className="w-full">
                    <TabsList className="bg-black/20 backdrop-blur-md p-1 rounded-xl flex border border-white/5 w-full">
                        <TabsTrigger
                            value="members"
                            className="flex-1 rounded-lg text-xs font-bold py-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"
                        >
                            <Users size={14} className="mr-2"/> EQUIPE
                        </TabsTrigger>
                        <TabsTrigger
                            value="stats"
                            className="flex-1 rounded-lg text-xs font-bold py-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white transition-all"
                        >
                            <BarChart3 size={14} className="mr-2"/> DADOS
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-4 h-[calc(100%-220px)] overflow-hidden relative">
                        <TabsContent value="members" className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-10">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-slate-500 text-sm">Sincronizando equipe...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center p-6 text-center border border-red-500/20 bg-red-500/5 rounded-2xl m-2">
                                    <AlertCircle size={24} className="text-red-400 mb-2" />
                                    <p className="text-red-300 font-medium text-sm mb-3">Falha ao carregar</p>
                                    <Button size="sm" variant="outline" onClick={fetchMembers} className="border-red-500/30 text-red-300 hover:bg-red-500/10 h-8 text-xs">
                                        <RefreshCw size={12} className="mr-2"/> Tentar Novamente
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {members.map((member, i) => (
                                        <motion.div
                                            key={member.user_id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={`flex items-center justify-between p-3 rounded-2xl border transition-all hover:scale-[1.01] ${
                                                member.role === 'owner'
                                                ? 'bg-amber-950/10 border-amber-500/20 shadow-[0_0_10px_-5px_rgba(245,158,11,0.2)]'
                                                : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0 ${
                                                    member.role === 'owner' ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-slate-700 text-slate-300'
                                                }`}>
                                                    {member.email ? member.email[0].toUpperCase() : <Users size={16}/>}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                                                        {member.name || (member.email ? member.email.split('@')[0] : 'Desconhecido')}
                                                        {member.role === 'owner' && <Crown size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                                                        <Mail size={10} /> {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                    member.role === 'owner'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    : 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                                                }`}>
                                                    {member.role === 'owner' ? 'Admin' : 'Membro'}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {members.length === 0 && (
                                        <div className="text-center py-8 opacity-40">
                                            <Users size={32} className="mx-auto mb-2"/>
                                            <p className="text-sm">Ninguém aqui além de você.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="stats" className="h-full overflow-y-auto custom-scrollbar pr-2 pb-10">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                    <h4 className="text-slate-400 text-[10px] font-bold uppercase mb-4 flex items-center gap-2 tracking-wider">
                                        <TrendingUp size={12} className="text-cyan-400"/> Contribuição (Pontos)
                                    </h4>
                                    <div className="space-y-4">
                                        {members.map((m, i) => {
                                            if (!m.stats) return null;
                                            const total = project?.points?.length || 1;
                                            const percent = (m.stats.points / total) * 100;

                                            return (
                                                <div key={m.user_id} className="group">
                                                    <div className="flex justify-between text-xs mb-1.5">
                                                        <span className="text-white font-medium">{m.name || m.email?.split('@')[0]}</span>
                                                        <span className="text-cyan-400 font-mono text-[10px] bg-cyan-950/30 px-1.5 rounded">{m.stats.points} pts</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${percent}%` }}
                                                            transition={{ duration: 1, delay: i * 0.1 }}
                                                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="bg-purple-900/10 p-4 rounded-2xl border border-purple-500/10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-purple-300 font-bold">Acesso Seguro</p>
                                            <p className="text-[10px] text-purple-400/60 leading-tight mt-0.5">
                                                Apenas membros listados têm acesso aos dados deste projeto.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </motion.div>
      </DialogContent>
    </Dialog>
    );
};

export default ProjectMembersDialog;
