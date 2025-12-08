import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'jamaaw_pro_db';

class DatabaseService {
  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.db = null;
  }
  
  // Inicializa o banco e cria tabelas se não existirem
  async init() {
    if (this.db) return;
    
    try {
      // Cria conexão (no Android/iOS usa banco nativo)
      this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      
      await this.db.open();
      
      // Schema robusto
      const schema = `
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          total_distance REAL,
          bairro TEXT,
          points TEXT, -- JSON stringificado
          synced INTEGER DEFAULT 0, -- 0: Pendente, 1: Salvo na Nuvem
          updated_at TEXT
        );
        
        -- Tabela para guardar preferências e caches diversos
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `;
      
      await this.db.execute(schema);
      console.log('🔋 SQLite Nativo Inicializado com Sucesso');
    } catch (e) {
      console.error('Erro fatal SQLite:', e);
    }
  }
  
  // Salva ou Atualiza um Projeto
  async saveProject(project, synced = 0) {
    if (!this.db) await this.init();
    
    const pointsJson = JSON.stringify(project.points || []);
    const userId = project.user_id || 'offline_user';
    const query = `
      INSERT OR REPLACE INTO projects (id, user_id, name, total_distance, bairro, points, synced, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    
    await this.db.run(query, [
      project.id,
      userId,
      project.name,
      project.totalDistance || project.total_distance || 0,
      project.bairro || 'Vários',
      pointsJson,
      synced, // 1 se veio do Supabase, 0 se foi criado offline
      new Date().toISOString()
    ]);
  }
  
  // Busca todos os projetos (Ordenados por data)
  async getProjects(userId) {
    if (!this.db) await this.init();
    
    // Se tiver userId, filtra. Se não, traz tudo (modo offline genérico)
    const sql = userId ?
      'SELECT * FROM projects WHERE user_id = ? OR user_id = "offline" ORDER BY updated_at DESC' :
      'SELECT * FROM projects ORDER BY updated_at DESC';
    
    const values = userId ? [userId] : [];
    const result = await this.db.query(sql, values);
    
    return result.values.map(p => ({
      ...p,
      points: JSON.parse(p.points),
      total_distance: p.total_distance,
      // Converte 1/0 para boolean para o React entender
      synced: p.synced === 1
    }));
  }
  
  // Deleta Projeto
  async deleteProject(id) {
    if (!this.db) await this.init();
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
  }
  
  // Limpa tudo (Logout)
  async clearAll() {
    if (!this.db) await this.init();
    await this.db.execute('DELETE FROM projects; DELETE FROM kv_store;');
  }
}

const dbService = new DatabaseService();
export default dbService;
