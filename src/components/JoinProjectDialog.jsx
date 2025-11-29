import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Hash, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const JoinProjectDialog = ({ isOpen, onClose, onJoinSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleJoin = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    
    try {
      // CHAMA A RPC OTIMIZADA DO SUPABASE
      const { data, error: rpcError } = await supabase.rpc('join_project_by_code', {
        input_code: code
      });
      
      if (rpcError) throw rpcError;
      
      if (data.success) {
        onJoinSuccess();
        onClose();
        setCode('');
        alert(data.message); // Ou use um toast bonito
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error(err);
      setError('Erro de conexão ao tentar entrar.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border border-slate-700 text-white max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-center pb-2">Entrar em Projeto</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              value={code}
              onChange={(e) => {
                setError('');
                setCode(e.target.value.toUpperCase()); // Força maiúsculo
              }}
              maxLength={6}
              placeholder="Digite o código (ex: X9A2B1)"
              className="pl-10 h-12 bg-slate-950 border-slate-700 text-center text-lg tracking-[0.2em] font-mono uppercase focus:border-cyan-500 focus:ring-cyan-500/20 transition-all placeholder:tracking-normal placeholder:normal-case placeholder:text-sm"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs text-center bg-red-500/10 p-2 rounded border border-red-500/20">
              {error}
            </div>
          )}

          <Button 
            onClick={handleJoin}
            disabled={loading || code.length < 3}
            className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-900/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                Entrar Agora <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinProjectDialog;