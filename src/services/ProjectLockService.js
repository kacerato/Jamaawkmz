// services/ProjectLockService.js

export class ProjectLockService {
  static locks = new Map();
  static timeouts = new Map();
  
  static async acquireLock(projectId, userId) {
    try {
      const now = Date.now();
      const lockKey = `lock:${projectId}`;
      const currentLock = this.locks.get(lockKey);
      
      if (currentLock && currentLock.userId !== userId) {
        const timeDiff = now - currentLock.timestamp;
        // Se o lock tem mais de 5 minutos, libera (timeout)
        if (timeDiff > 300000) {
          this.releaseLock(projectId, currentLock.userId);
        } else {
          return false;
        }
      }
      
      this.locks.set(lockKey, {
        userId,
        timestamp: now
      });
      
      // Limpa timeout anterior se existir
      if (this.timeouts.has(lockKey)) {
        clearTimeout(this.timeouts.get(lockKey));
      }
      
      // Configura timeout para liberar automaticamente após 10 minutos
      const timeoutId = setTimeout(() => {
        this.releaseLock(projectId, userId);
      }, 600000);
      
      this.timeouts.set(lockKey, timeoutId);
      
      return true;
    } catch (error) {
      console.error('Erro ao adquirir lock:', error);
      return false;
    }
  }
  
  static async releaseLock(projectId, userId) {
    try {
      const lockKey = `lock:${projectId}`;
      const currentLock = this.locks.get(lockKey);
      
      if (currentLock && currentLock.userId === userId) {
        this.locks.delete(lockKey);
        
        if (this.timeouts.has(lockKey)) {
          clearTimeout(this.timeouts.get(lockKey));
          this.timeouts.delete(lockKey);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao liberar lock:', error);
      return false;
    }
  }
  
  static async checkLockStatus(projectId, currentUserId) {
    try {
      const lockKey = `lock:${projectId}`;
      const lock = this.locks.get(lockKey);
      
      if (!lock) {
        return { isLocked: false };
      }
      
      const now = Date.now();
      const timeDiff = now - lock.timestamp;
      
      // Se o lock expirou (>10 minutos), libera
      if (timeDiff > 600000) {
        this.locks.delete(lockKey);
        if (this.timeouts.has(lockKey)) {
          clearTimeout(this.timeouts.get(lockKey));
          this.timeouts.delete(lockKey);
        }
        return { isLocked: false };
      }
      
      return {
        isLocked: true,
        lockedBy: lock.userId,
        lockedSince: new Date(lock.timestamp),
        timeElapsed: timeDiff
      };
    } catch (error) {
      console.error('Erro ao verificar status do lock:', error);
      return { isLocked: false };
    }
  }
  
  static async heartbeat(projectId, userId) {
    try {
      const lockKey = `lock:${projectId}`;
      const lock = this.locks.get(lockKey);
      
      if (lock && lock.userId === userId) {
        // Atualiza timestamp do lock
        lock.timestamp = Date.now();
        this.locks.set(lockKey, lock);
        
        // Renova o timeout
        if (this.timeouts.has(lockKey)) {
          clearTimeout(this.timeouts.get(lockKey));
        }
        
        const timeoutId = setTimeout(() => {
          this.releaseLock(projectId, userId);
        }, 600000);
        
        this.timeouts.set(lockKey, timeoutId);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro no heartbeat:', error);
      return false;
    }
  }
  
  static cleanup() {
    const now = Date.now();
    
    for (const [lockKey, lock] of this.locks.entries()) {
      const timeDiff = now - lock.timestamp;
      
      if (timeDiff > 600000) { // 10 minutos
        this.locks.delete(lockKey);
        
        if (this.timeouts.has(lockKey)) {
          clearTimeout(this.timeouts.get(lockKey));
          this.timeouts.delete(lockKey);
        }
      }
    }
  }
}

// Limpeza automática a cada 5 minutos
setInterval(() => {
  ProjectLockService.cleanup();
}, 300000);