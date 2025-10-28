/**
 * Serviço de Backup e Versionamento para Jamaaw App
 * Sistema completo de backup, restauração e versionamento
 */

import { supabase } from '../lib/supabase';
import { Preferences } from '@capacitor/preferences';
import JSZip from 'jszip';

class BackupService {
  constructor() {
    this.version = '1.0.0';
    this.maxBackups = 10; // Número máximo de backups mantidos
  }

  /**
   * Cria um backup completo dos dados do usuário
   */
  async createBackup(user, projects, markers, options = {}) {
    try {
      const timestamp = new Date().toISOString();
      const backupId = `backup_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      
      const backupData = {
        id: backupId,
        version: this.version,
        timestamp: timestamp,
        user: {
          id: user.id,
          email: user.email
        },
        data: {
          projects: this.sanitizeProjects(projects),
          markers: this.sanitizeMarkers(markers),
          settings: await this.getUserSettings(user.id)
        },
        metadata: {
          projectCount: projects.length,
          markerCount: markers.length,
          totalSize: this.calculateBackupSize(projects, markers),
          description: options.description || 'Backup automático'
        }
      };

      // Compressão dos dados
      const compressedBackup = await this.compressBackup(backupData);
      
      // Salvar backup localmente
      await this.saveLocalBackup(backupId, compressedBackup);
      
      // Se online, tentar salvar na nuvem também
      let cloudBackup = null;
      if (options.saveToCloud && navigator.onLine) {
        cloudBackup = await this.saveCloudBackup(user.id, backupId, compressedBackup);
      }

      // Gerenciar limite de backups
      await this.cleanupOldBackups();

      return {
        success: true,
        backupId,
        timestamp,
        local: true,
        cloud: !!cloudBackup,
        metadata: backupData.metadata
      };

    } catch (error) {
      console.error('Erro ao criar backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restaura um backup específico
   */
  async restoreBackup(backupId, options = {}) {
    try {
      // Carregar backup
      const backup = await this.loadBackup(backupId);
      if (!backup) {
        throw new Error('Backup não encontrado');
      }

      const backupData = await this.decompressBackup(backup.data);

      // Validar dados do backup
      if (!this.validateBackupData(backupData)) {
        throw new Error('Dados do backup corrompidos ou inválidos');
      }

      const restoreResults = {
        projects: { success: 0, failed: 0, total: 0 },
        markers: { success: 0, failed: 0, total: 0 },
        settings: { success: false }
      };

      // Restaurar projetos
      if (options.restoreProjects && backupData.data.projects) {
        const projectResults = await this.restoreProjects(backupData.data.projects);
        restoreResults.projects = projectResults;
      }

      // Restaurar marcações
      if (options.restoreMarkers && backupData.data.markers) {
        const markerResults = await this.restoreMarkers(backupData.data.markers);
        restoreResults.markers = markerResults;
      }

      // Restaurar configurações
      if (options.restoreSettings && backupData.data.settings) {
        const settingsResult = await this.restoreSettings(backupData.user.id, backupData.data.settings);
        restoreResults.settings = settingsResult;
      }

      // Criar ponto de restauração antes da restauração
      if (options.createRestorePoint) {
        await this.createRestorePoint('antes_da_restauracao');
      }

      return {
        success: true,
        backupId,
        timestamp: backupData.timestamp,
        results: restoreResults
      };

    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Lista todos os backups disponíveis
   */
  async listBackups(userId = null) {
    try {
      const backups = [];

      // Buscar backups locais
      const localBackups = await this.getLocalBackups();
      backups.push(...localBackups);

      // Buscar backups na nuvem (se online e usuário logado)
      if (userId && navigator.onLine) {
        try {
          const cloudBackups = await this.getCloudBackups(userId);
          backups.push(...cloudBackups);
        } catch (error) {
          console.warn('Não foi possível carregar backups da nuvem:', error);
        }
      }

      // Ordenar por timestamp (mais recente primeiro)
      return backups.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

    } catch (error) {
      console.error('Erro ao listar backups:', error);
      return [];
    }
  }

  /**
   * Exclui um backup específico
   */
  async deleteBackup(backupId) {
    try {
      let results = {
        local: false,
        cloud: false
      };

      // Excluir backup local
      results.local = await this.deleteLocalBackup(backupId);

      // Tentar excluir da nuvem também
      if (navigator.onLine) {
        try {
          results.cloud = await this.deleteCloudBackup(backupId);
        } catch (error) {
          console.warn('Não foi possível excluir backup da nuvem:', error);
        }
      }

      return {
        success: results.local || results.cloud,
        details: results
      };

    } catch (error) {
      console.error('Erro ao excluir backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cria um ponto de restauração rápido
   */
  async createRestorePoint(name = 'ponto_restauracao') {
    try {
      const userData = await this.getCurrentUserData();
      if (!userData.user) return { success: false, error: 'Usuário não autenticado' };

      const restorePoint = {
        id: `restore_point_${Date.now()}`,
        name,
        timestamp: new Date().toISOString(),
        data: userData
      };

      await Preferences.set({
        key: `jamaaw_restore_point_${name}`,
        value: JSON.stringify(restorePoint)
      });

      // Manter apenas os 5 pontos de restauração mais recentes
      await this.cleanupRestorePoints();

      return {
        success: true,
        restorePointId: restorePoint.id
      };

    } catch (error) {
      console.error('Erro ao criar ponto de restauração:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Exporta backup para arquivo
   */
  async exportBackup(backupId, format = 'json') {
    try {
      const backup = await this.loadBackup(backupId);
      if (!backup) {
        throw new Error('Backup não encontrado');
      }

      const backupData = await this.decompressBackup(backup.data);
      
      let exportData;
      let filename;
      let mimeType;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(backupData, null, 2);
          filename = `jamaaw_backup_${backupId}.json`;
          mimeType = 'application/json';
          break;

        case 'zip':
          const zip = new JSZip();
          zip.file('backup.json', JSON.stringify(backupData, null, 2));
          zip.file('metadata.txt', this.generateMetadataText(backupData));
          exportData = await zip.generateAsync({ type: 'blob' });
          filename = `jamaaw_backup_${backupId}.zip`;
          mimeType = 'application/zip';
          break;

        default:
          throw new Error('Formato de exportação não suportado');
      }

      // Criar e disparar download
      this.downloadFile(exportData, filename, mimeType);

      return {
        success: true,
        filename,
        format,
        size: exportData.size || new Blob([exportData]).size
      };

    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Importa backup de arquivo
   */
  async importBackup(file, options = {}) {
    try {
      let backupData;

      if (file.name.endsWith('.zip')) {
        backupData = await this.importFromZip(file);
      } else if (file.name.endsWith('.json')) {
        backupData = await this.importFromJson(file);
      } else {
        throw new Error('Formato de arquivo não suportado. Use .json ou .zip');
      }

      // Validar estrutura do backup
      if (!this.validateBackupData(backupData)) {
        throw new Error('Arquivo de backup inválido ou corrompido');
      }

      // Salvar backup importado
      const backupId = `imported_${Date.now()}`;
      const compressedBackup = await this.compressBackup(backupData);
      await this.saveLocalBackup(backupId, compressedBackup);

      return {
        success: true,
        backupId,
        timestamp: backupData.timestamp,
        metadata: backupData.metadata
      };

    } catch (error) {
      console.error('Erro ao importar backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  /**
   * Sanitiza projetos para backup
   */
  sanitizeProjects(projects) {
    return projects.map(project => ({
      id: project.id,
      name: project.name,
      points: project.points.map(point => ({
        lat: point.lat,
        lng: point.lng,
        timestamp: point.timestamp,
        id: point.id
      })),
      total_distance: project.total_distance || project.totalDistance,
      bairro: project.bairro,
      tracking_mode: project.tracking_mode || project.trackingMode,
      created_at: project.created_at,
      updated_at: project.updated_at || new Date().toISOString()
    }));
  }

  /**
   * Sanitiza marcações para backup
   */
  sanitizeMarkers(markers) {
    return markers.map(marker => ({
      id: marker.id,
      name: marker.name,
      lat: marker.lat,
      lng: marker.lng,
      descricao: marker.descricao,
      bairro: marker.bairro,
      rua: marker.rua,
      fotos: marker.fotos || [],
      created_at: marker.created_at
    }));
  }

  /**
   * Calcula tamanho aproximado do backup
   */
  calculateBackupSize(projects, markers) {
    const projectsSize = JSON.stringify(projects).length;
    const markersSize = JSON.stringify(markers).length;
    return projectsSize + markersSize;
  }

  /**
   * Comprime dados do backup
   */
  async compressBackup(data) {
    try {
      // Usar compressão simples (poderia usar LZString em produção)
      const compressed = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      return compressed;
    } catch (error) {
      console.warn('Falha na compressão, usando dados não comprimidos:', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Descomprime dados do backup
   */
  async decompressBackup(data) {
    try {
      // Tentar descompressão
      if (typeof data === 'string' && data.length > 0) {
        try {
          const decompressed = JSON.parse(decodeURIComponent(escape(atob(data))));
          return decompressed;
        } catch (e) {
          // Se falhar, assumir que não está comprimido
          return JSON.parse(data);
        }
      }
      return JSON.parse(data);
    } catch (error) {
      throw new Error('Falha ao descomprimir dados do backup');
    }
  }

  /**
   * Salva backup localmente
   */
  async saveLocalBackup(backupId, data) {
    const timestamp = new Date().toISOString();
    
    const backupInfo = {
      id: backupId,
      timestamp,
      location: 'local',
      size: data.length
    };

    // Salvar dados do backup
    await Preferences.set({
      key: `jamaaw_backup_${backupId}`,
      value: data
    });

    // Atualizar lista de backups
    const backupsList = await this.getBackupsList();
    backupsList.push(backupInfo);
    
    await Preferences.set({
      key: 'jamaaw_backups_list',
      value: JSON.stringify(backupsList)
    });

    return true;
  }

  /**
   * Salva backup na nuvem
   */
  async saveCloudBackup(userId, backupId, data) {
    try {
      const { error } = await supabase
        .from('backups')
        .insert({
          user_id: userId,
          backup_id: backupId,
          data: data,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;

    } catch (error) {
      console.error('Erro ao salvar backup na nuvem:', error);
      throw error;
    }
  }

  /**
   * Carrega backup específico
   */
  async loadBackup(backupId) {
    // Tentar carregar localmente primeiro
    try {
      const { value } = await Preferences.get({ key: `jamaaw_backup_${backupId}` });
      if (value) {
        return {
          id: backupId,
          data: value,
          location: 'local'
        };
      }
    } catch (error) {
      console.warn('Backup local não encontrado:', backupId);
    }

    // Tentar carregar da nuvem
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('backups')
          .select('*')
          .eq('backup_id', backupId)
          .single();

        if (error) throw error;
        
        return {
          id: backupId,
          data: data.data,
          location: 'cloud',
          cloud_id: data.id
        };

      } catch (error) {
        console.warn('Backup na nuvem não encontrado:', backupId);
      }
    }

    return null;
  }

  /**
   * Obtém lista de backups locais
   */
  async getLocalBackups() {
    try {
      const { value } = await Preferences.get({ key: 'jamaaw_backups_list' });
      if (value) {
        return JSON.parse(value);
      }
    } catch (error) {
      console.warn('Nenhum backup local encontrado');
    }
    return [];
  }

  /**
   * Obtém backups da nuvem
   */
  async getCloudBackups(userId) {
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('backup_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(backup => ({
        id: backup.backup_id,
        timestamp: backup.created_at,
        location: 'cloud'
      }));

    } catch (error) {
      console.error('Erro ao buscar backups da nuvem:', error);
      throw error;
    }
  }

  /**
   * Exclui backup local
   */
  async deleteLocalBackup(backupId) {
    try {
      // Remover dados do backup
      await Preferences.remove({ key: `jamaaw_backup_${backupId}` });

      // Atualizar lista
      const backupsList = await this.getBackupsList();
      const updatedList = backupsList.filter(backup => backup.id !== backupId);
      
      await Preferences.set({
        key: 'jamaaw_backups_list',
        value: JSON.stringify(updatedList)
      });

      return true;

    } catch (error) {
      console.error('Erro ao excluir backup local:', error);
      return false;
    }
  }

  /**
   * Exclui backup da nuvem
   */
  async deleteCloudBackup(backupId) {
    try {
      const { error } = await supabase
        .from('backups')
        .delete()
        .eq('backup_id', backupId);

      if (error) throw error;
      return true;

    } catch (error) {
      console.error('Erro ao excluir backup da nuvem:', error);
      return false;
    }
  }

  /**
   * Obtém lista de backups
   */
  async getBackupsList() {
    try {
      const { value } = await Preferences.get({ key: 'jamaaw_backups_list' });
      return value ? JSON.parse(value) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Limpa backups antigos
   */
  async cleanupOldBackups() {
    try {
      const backups = await this.getBackupsList();
      
      if (backups.length > this.maxBackups) {
        // Ordenar por timestamp (mais antigos primeiro)
        backups.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Manter apenas os mais recentes
        const backupsToKeep = backups.slice(-this.maxBackups);
        const backupsToDelete = backups.slice(0, backups.length - this.maxBackups);

        // Excluir backups antigos
        for (const backup of backupsToDelete) {
          await this.deleteLocalBackup(backup.id);
        }

        console.log(`Limpeza de backups: ${backupsToDelete.length} backups antigos removidos`);
      }
    } catch (error) {
      console.error('Erro na limpeza de backups:', error);
    }
  }

  /**
   * Restaura projetos do backup
   */
  async restoreProjects(projects) {
    let success = 0;
    let failed = 0;

    for (const project of projects) {
      try {
        // Verificar se projeto já existe
        const existingProjects = JSON.parse(localStorage.getItem('jamaaw_projects') || '[]');
        const projectExists = existingProjects.some(p => p.id === project.id);

        if (projectExists) {
          // Atualizar projeto existente
          const updatedProjects = existingProjects.map(p => 
            p.id === project.id ? { ...p, ...project } : p
          );
          localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
        } else {
          // Adicionar novo projeto
          existingProjects.push(project);
          localStorage.setItem('jamaaw_projects', JSON.stringify(existingProjects));
        }

        success++;
      } catch (error) {
        console.error(`Erro ao restaurar projeto ${project.id}:`, error);
        failed++;
      }
    }

    return { success, failed, total: projects.length };
  }

  /**
   * Restaura marcações do backup
   */
  async restoreMarkers(markers) {
    let success = 0;
    let failed = 0;

    for (const marker of markers) {
      try {
        // Esta é uma simplificação - na prática, você precisaria integrar com sua lógica existente
        const existingMarkers = JSON.parse(localStorage.getItem('jamaaw_markers') || '[]');
        const markerExists = existingMarkers.some(m => m.id === marker.id);

        if (!markerExists) {
          existingMarkers.push(marker);
          localStorage.setItem('jamaaw_markers', JSON.stringify(existingMarkers));
        }

        success++;
      } catch (error) {
        console.error(`Erro ao restaurar marcação ${marker.id}:`, error);
        failed++;
      }
    }

    return { success, failed, total: markers.length };
  }

  /**
   * Restaura configurações
   */
  async restoreSettings(userId, settings) {
    try {
      // Salvar configurações no localStorage
      localStorage.setItem(`jamaaw_settings_${userId}`, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Erro ao restaurar configurações:', error);
      return false;
    }
  }

  /**
   * Obtém configurações do usuário
   */
  async getUserSettings(userId) {
    try {
      const settings = localStorage.getItem(`jamaaw_settings_${userId}`);
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Obtém dados atuais do usuário
   */
  async getCurrentUserData() {
    try {
      const user = JSON.parse(localStorage.getItem('jamaaw_user') || 'null');
      const projects = JSON.parse(localStorage.getItem('jamaaw_projects') || '[]');
      const markers = JSON.parse(localStorage.getItem('jamaaw_markers') || '[]');
      const settings = user ? await this.getUserSettings(user.id) : {};

      return {
        user,
        projects,
        markers,
        settings
      };
    } catch (error) {
      return {
        user: null,
        projects: [],
        markers: [],
        settings: {}
      };
    }
  }

  /**
   * Valida dados do backup
   */
  validateBackupData(data) {
    try {
      return data && 
             data.version && 
             data.timestamp && 
             data.user && 
             data.data && 
             (data.data.projects || data.data.markers);
    } catch (error) {
      return false;
    }
  }

  /**
   * Importa de arquivo ZIP
   */
  async importFromZip(file) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    const backupFile = contents.file('backup.json');
    if (!backupFile) {
      throw new Error('Arquivo de backup não encontrado no ZIP');
    }

    const backupContent = await backupFile.async('text');
    return JSON.parse(backupContent);
  }

  /**
   * Importa de arquivo JSON
   */
  async importFromJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target.result));
        } catch (error) {
          reject(new Error('Arquivo JSON inválido'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  }

  /**
   * Gera texto de metadados para exportação
   */
  generateMetadataText(backupData) {
    return `
Jamaaw App - Backup
===================

Data do Backup: ${new Date(backupData.timestamp).toLocaleString('pt-BR')}
Versão: ${backupData.version}
Usuário: ${backupData.user.email}

Estatísticas:
- Projetos: ${backupData.metadata.projectCount}
- Marcações: ${backupData.metadata.markerCount}
- Tamanho: ${(backupData.metadata.totalSize / 1024).toFixed(2)} KB

Descrição: ${backupData.metadata.description}

Este arquivo foi gerado automaticamente pelo Jamaaw App.
    `.trim();
  }

  /**
   * Faz download de arquivo
   */
  downloadFile(data, filename, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Limpa pontos de restauração antigos
   */
  async cleanupRestorePoints() {
    try {
      // Implementação simplificada - manter apenas os 5 mais recentes
      const allKeys = (await Preferences.keys()).keys;
      const restorePointKeys = allKeys.filter(key => key.startsWith('jamaaw_restore_point_'));
      
      if (restorePointKeys.length > 5) {
        // Ordenar por timestamp (implícito no nome)
        restorePointKeys.sort();
        
        // Manter apenas os 5 mais recentes
        const keysToDelete = restorePointKeys.slice(0, restorePointKeys.length - 5);
        
        for (const key of keysToDelete) {
          await Preferences.remove({ key });
        }
      }
    } catch (error) {
      console.error('Erro na limpeza de pontos de restauração:', error);
    }
  }
}

// Exportar instância singleton
export const backupService = new BackupService();
export default backupService;