// components/ShareProjectDialog.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Share2, Users, Check, X, Globe } from 'lucide-react';

const ShareProjectDialog = ({
  isOpen,
  onClose,
  project,
  onShare,
  onAddByCode
}) => {
  const [shareCode, setShareCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (project?.share_code) {
      setShareCode(project.share_code);
    }
  }, [project]);
  
  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      const code = await onShare(project.id);
      setShareCode(code);
    } catch (error) {
      console.error('Erro ao gerar código:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleImport = async () => {
    if (!importCode.trim()) return;
    
    setLoading(true);
    try {
      await onAddByCode(importCode.toUpperCase());
      setImportCode('');
      onClose();
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/20 text-white shadow-2xl shadow-cyan-500/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 text-xl font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Compartilhar Projeto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção Compartilhar */}
          {project && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-cyan-300">
                <Globe className="w-4 h-4" />
                <span>Compartilhar "{project.name}"</span>
              </div>

              <div className="space-y-3">
                <Label className="text-gray-300 text-sm">Código de Compartilhamento</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareCode}
                    readOnly
                    placeholder="Clique em Gerar Código"
                    className="bg-slate-800/50 border-slate-600 text-white font-mono flex-1"
                  />
                  <Button
                    onClick={handleCopyCode}
                    disabled={!shareCode}
                    className={`transition-all ${
                      copied 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : 'bg-cyan-500 hover:bg-cyan-600'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                
                <Button
                  onClick={handleGenerateCode}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                >
                  {shareCode ? 'Gerar Novo Código' : 'Gerar Código'}
                </Button>
              </div>
            </div>
          )}

          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-2 text-slate-400">OU</span>
            </div>
          </div>

          {/* Seção Importar */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-cyan-300">
              <Users className="w-4 h-4" />
              <span>Importar Projeto Compartilhado</span>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-300 text-sm">Código do Projeto</Label>
              <div className="flex gap-2">
                <Input
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                  placeholder="Digite o código (ex: A1B2C3D4)"
                  className="bg-slate-800/50 border-slate-600 text-white font-mono flex-1 uppercase"
                  maxLength={8}
                />
                <Button
                  onClick={handleImport}
                  disabled={!importCode.trim() || loading}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {loading ? '...' : 'Importar'}
                </Button>
              </div>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
            <h4 className="text-cyan-400 text-sm font-semibold mb-2">Como funciona:</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Compartilhe o código com outros usuários</li>
              <li>• Eles podem importar usando o código</li>
              <li>• Alterações são sincronizadas em tempo real</li>
              <li>• Apenas visualização para usuários convidados</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareProjectDialog;