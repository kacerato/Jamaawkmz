import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Archive, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Cloud,
  HardDrive,
  Clock,
  FileText,
  Shield
} from 'lucide-react';
import { backupService } from '../services/backupService';

const BackupManager = ({ open, onOpenChange, user, projects, markers, onStatusChange }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreOptions, setRestoreOptions] = useState({
    restoreProjects: true,
    restoreMarkers: true,
    restoreSettings: true,
    createRestorePoint: true
  });
  const [backupDescription, setBackupDescription] = useState('');
  const [saveToCloud, setSaveToCloud] = useState(true);
  const [operationStatus, setOperationStatus] = useState(null);

  // Carregar backups quando o diálogo abrir
  useEffect(() => {
    if (open && user) {
      loadBackups();
    }
  }, [open, user]);

  // Notificar status das operações
  useEffect(() => {
    if (onStatusChange && activeOperation) {
      onStatusChange(activeOperation);
    }
  }, [activeOperation, onStatusChange]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const backupList = await backupService.listBackups(user?.id);
      setBackups(backupList);
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
      showStatus('error', 'Erro ao carregar backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!user) {
      showStatus('error', 'Usuário não autenticado');
      return;
    }

    setActiveOperation('backing_up');
    setOperationStatus({ type: 'info', message: 'Criando backup...' });

    try {
      const result = await backupService.createBackup(
        user, 
        projects, 
        markers, 
        {
          description: backupDescription || 'Backup manual',
          saveToCloud: saveToCloud && navigator.onLine
        }
      );

      if (result.success) {
        showStatus('success', `Backup criado com sucesso! ID: ${result.backupId}`);
        setBackupDescription('');
        await loadBackups();
      } else {
        showStatus('error', `Erro ao criar backup: ${result.error}`);
      }
    } catch (error) {
      showStatus('error', `Erro inesperado: ${error.message}`);
    } finally {
      setActiveOperation(null);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    if (!backupId || !user) return;

    setActiveOperation('restoring');
    setOperationStatus({ type: 'info', message: 'Restaurando backup...' });

    try {
      const result = await backupService.restoreBackup(backupId, restoreOptions);

      if (result.success) {
        showStatus('success', 'Backup restaurado com sucesso!');
        
        // Recarregar a página para aplicar as mudanças
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showStatus('error', `Erro ao restaurar backup: ${result.error}`);
      }
    } catch (error) {
      showStatus('error', `Erro inesperado: ${error.message}`);
    } finally {
      setActiveOperation(null);
      setSelectedBackup(null);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!backupId) return;

    setActiveOperation('deleting');
    setOperationStatus({ type: 'info', message: 'Excluindo backup...' });

    try {
      const result = await backupService.deleteBackup(backupId);

      if (result.success) {
        showStatus('success', 'Backup excluído com sucesso!');
        await loadBackups();
      } else {
        showStatus('error', `Erro ao excluir backup: ${result.error}`);
      }
    } catch (error) {
      showStatus('error', `Erro inesperado: ${error.message}`);
    } finally {
      setActiveOperation(null);
    }
  };

  const handleExportBackup = async (backupId, format = 'zip') => {
    setActiveOperation('exporting');
    setOperationStatus({ type: 'info', message: 'Exportando backup...' });

    try {
      const result = await backupService.exportBackup(backupId, format);

      if (result.success) {
        showStatus('success', `Backup exportado como ${result.filename}`);
      } else {
        showStatus('error', `Erro ao exportar backup: ${result.error}`);
      }
    } catch (error) {
      showStatus('error', `Erro inesperado: ${error.message}`);
    } finally {
      setActiveOperation(null);
    }
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setActiveOperation('importing');
    setOperationStatus({ type: 'info', message: 'Importando backup...' });

    try {
      const result = await backupService.importBackup(file);

      if (result.success) {
        showStatus('success', 'Backup importado com sucesso!');
        await loadBackups();
      } else {
        showStatus('error', `Erro ao importar backup: ${result.error}`);
      }
    } catch (error) {
      showStatus('error', `Erro inesperado: ${error.message}`);
    } finally {
      setActiveOperation(null);
      event.target.value = ''; // Reset input
    }
  };

  const showStatus = (type, message) => {
    setOperationStatus({ type, message });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        setOperationStatus(null);
      }, 5000);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const getLocationIcon = (location) => {
    return location === 'cloud' ? <Cloud className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />;
  };

  const getLocationColor = (location) => {
    return location === 'cloud' ? 'text-blue-400' : 'text-green-400';
  };

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'info': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 text-2xl font-bold flex items-center gap-3">
            <Shield className="w-6 h-6" />
            Gerenciador de Backup & Restauração
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            Proteja seus dados com backups regulares e restaure quando necessário
          </DialogDescription>
        </DialogHeader>

        {/* Status da Operação */}
        {operationStatus && (
          <div className={`p-4 rounded-lg border ${
            operationStatus.type === 'success' ? 'bg-green-500/20 border-green-500/30' :
            operationStatus.type === 'error' ? 'bg-red-500/20 border-red-500/30' :
            operationStatus.type === 'warning' ? 'bg-yellow-500/20 border-yellow-500/30' :
            'bg-blue-500/20 border-blue-500/30'
          }`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(operationStatus.type)}
              <span className="flex-1 text-sm font-medium">{operationStatus.message}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[70vh] overflow-hidden">
          
          {/* Coluna 1: Criar Backup */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  Criar Backup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="backup-description" className="text-gray-300">
                    Descrição (opcional)
                  </Label>
                  <Input
                    id="backup-description"
                    value={backupDescription}
                    onChange={(e) => setBackupDescription(e.target.value)}
                    placeholder="Ex: Backup antes da atualização"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <span className="text-gray-300 text-sm font-medium">Salvar na nuvem</span>
                    <p className="text-gray-400 text-xs">
                      {navigator.onLine ? 'Disponível (online)' : 'Indisponível (offline)'}
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={saveToCloud && navigator.onLine}
                      onChange={() => setSaveToCloud(!saveToCloud)}
                      disabled={!navigator.onLine}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600/50">
                  <p className="text-sm text-gray-300 font-medium mb-2">Dados incluídos:</p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      {projects.length} projetos
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      {markers.length} marcações
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      Configurações do usuário
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleCreateBackup}
                  disabled={activeOperation || !user || projects.length + markers.length === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3"
                >
                  {activeOperation === 'backing_up' ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Criando Backup...
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4 mr-2" />
                      Criar Backup Agora
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Importar Backup */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Importar Backup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-400">
                  Importe um backup anteriormente exportado (.json ou .zip)
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="import-file" className="text-gray-300 text-sm">
                    Selecione o arquivo de backup
                  </Label>
                  <Input
                    id="import-file"
                    type="file"
                    accept=".json,.zip"
                    onChange={handleImportBackup}
                    className="bg-slate-700/50 border-slate-600 text-white text-sm"
                    disabled={activeOperation}
                  />
                </div>

                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-400 text-sm font-medium">Atenção</p>
                      <p className="text-yellow-500 text-xs">
                        A importação substituirá os dados atuais. Recomendamos criar um backup antes.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 2: Lista de Backups */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800/50 border-slate-700/50 h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Meus Backups ({backups.length})
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadBackups}
                  disabled={loading}
                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              
              <CardContent className="max-h-[500px] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-12">
                    <Archive className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">Nenhum backup encontrado</h3>
                    <p className="text-gray-500 text-sm">
                      Crie seu primeiro backup para proteger seus dados
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:border-cyan-500/30 transition-all group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {getLocationIcon(backup.location)}
                            <div className={`text-xs font-medium ${getLocationColor(backup.location)}`}>
                              {backup.location === 'cloud' ? 'Nuvem' : 'Local'}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {formatDate(backup.timestamp)}
                            </div>
                          </div>
                          
                          <p className="text-sm font-medium text-white truncate mb-1">
                            {backup.id}
                          </p>
                          
                          {backup.size && (
                            <p className="text-xs text-gray-400">
                              Tamanho: {formatFileSize(backup.size)}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExportBackup(backup.id, 'zip')}
                            disabled={activeOperation}
                            className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                            title="Exportar backup"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedBackup(backup)}
                            disabled={activeOperation}
                            className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                            title="Restaurar backup"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteBackup(backup.id)}
                            disabled={activeOperation}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            title="Excluir backup"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Diálogo de Confirmação de Restauração */}
        <Dialog open={!!selectedBackup} onOpenChange={(open) => !open && setSelectedBackup(null)}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Confirmar Restauração
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-medium mb-2">Atenção!</p>
                <p className="text-yellow-500 text-xs">
                  Esta ação substituirá seus dados atuais pelos do backup. 
                  Esta operação não pode ser desfeita.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-300">Backup selecionado:</p>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <p className="text-white text-sm font-medium">{selectedBackup?.id}</p>
                  <p className="text-gray-400 text-xs">
                    {selectedBackup && formatDate(selectedBackup.timestamp)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-300">Opções de restauração:</p>
                <div className="space-y-2">
                  {Object.entries(restoreOptions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setRestoreOptions(prev => ({
                          ...prev,
                          [key]: e.target.checked
                        }))}
                        className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/20"
                      />
                      <span className="text-sm text-gray-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setSelectedBackup(null)}
                  className="flex-1 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleRestoreBackup(selectedBackup?.id)}
                  disabled={activeOperation}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white"
                >
                  {activeOperation === 'restoring' ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Restaurando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Confirmar Restauração
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export { BackupManager };
export default BackupManager;