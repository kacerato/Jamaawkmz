import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, History, Share2, ShieldAlert, CheckCircle, Users } from 'lucide-react';
import { SharedProjectService } from '../services/SharedProjectService'; // Ajuste o caminho

const ShareModal = ({ isOpen, onClose, project, user }) => {
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('share'); // 'share' or 'history'
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  
  const isOwner = project?.user_id === user?.id;
  
  useEffect(() => {
    if (isOpen && project) {
      loadShareCode();
      if (isOwner) loadHistory();
    }
  }, [isOpen, project]);
  
  const loadShareCode = async () => {
    setLoading(true);
    try {
      const code = await SharedProjectService.getOrCreateShareCode(project.id, user.id);
      setShareCode(code);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadHistory = async () => {
    try {
      const history = await SharedProjectService.getProjectHistory(project.id);
      setLogs(history || []);
    } catch (error) {
      console.error('Erro ao carregar histórico', error);
    }
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 text-white max-w-md shadow-[0_0_50px_rgba(6,182,212,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            {viewMode === 'share' ? <Share2 className="text-cyan-400" /> : <History className="text-purple-400" />}
            {viewMode === 'share' ? 'Compartilhar Projeto' : 'Histórico de Alterações'}
          </DialogTitle>
        </DialogHeader>

        {viewMode === 'share' && (
          <div className="space-y-6 py-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2 block">
                Código de Acesso Permanente
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    value={loading ? 'Gerando...' : shareCode} 
                    readOnly 
                    className="bg-slate-900 border-cyan-500/30 text-cyan-400 font-mono text-center text-lg tracking-widest h-12 focus-visible:ring-cyan-500"
                  />
                  {loading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80"><span className="animate-spin h-4 w-4 border-2 border-cyan-500 rounded-full border-t-transparent"></span></div>}
                </div>
                <Button 
                  onClick={handleCopy}
                  className={`h-12 w-12 ${copied ? 'bg-green-500 hover:bg-green-600' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                >
                  {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Qualquer pessoa com este código terá acesso total de edição.
              </p>
            </div>

            {isOwner && (
              <Button 
                variant="outline" 
                onClick={() => setViewMode('history')}
                className="w-full border-slate-700 hover:bg-slate-800 hover:text-purple-400 transition-all"
              >
                <History className="w-4 h-4 mr-2" />
                Ver Log de Auditoria
              </Button>
            )}
          </div>
        )}

        {viewMode === 'history' && (
          <div className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {logs.length === 0 ? (
                <p className="text-center text-slate-500 py-4">Nenhum registro encontrado.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                        log.action_type === 'UPDATE' ? 'bg-blue-500/20 text-blue-400' :
                        log.action_type === 'JOIN' ? 'bg-green-500/20 text-green-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {log.action_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-slate-300 font-medium">{log.details}</p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {log.user_email}
                    </p>
                  </div>
                ))
              )}
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('share')}
              className="w-full text-slate-400 hover:text-white"
            >
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;