import { supabase } from '../lib/supabase';
import { LockStatus } from '../types';

const LOCK_DURATION_MINUTES = 5;

// Define a shape for the Supabase response to avoid 'any'
// Kept for documentation/extensibility even if not strictly used in current logic flow
// interface SupabaseUpdateResponse<T> {
//   data: T[] | null;
//   error: unknown;
// }

// interface ProjectLockData {
//   id: string;
//   locked_by: string | null;
//   lock_expires_at: string | null;
// }

const ProjectLockService = {
  // Tries to acquire the lock
  async acquireLock(projectId: string | number, userId: string): Promise<boolean> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_DURATION_MINUTES);

    // Try to update if: Nobody has lock OR lock expired OR I already own the lock
    const { data, error } = await supabase
      .from('projetos')
      .update({
        locked_by: userId,
        lock_expires_at: expiresAt.toISOString()
      })
      .eq('id', projectId)
      .or(`locked_by.is.null,lock_expires_at.lt.${new Date().toISOString()},locked_by.eq.${userId}`)
      .select();

    if (error) {
      console.error("Error locking project:", error);
      return false;
    }

    // If data returned, we got the lock.
    return !!(data && data.length > 0);
  },

  // Keeps the lock active (Heartbeat)
  async heartbeat(projectId: string | number, userId: string): Promise<boolean> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_DURATION_MINUTES);

    const { error } = await supabase
      .from('projetos')
      .update({ lock_expires_at: expiresAt.toISOString() })
      .eq('id', projectId)
      .eq('locked_by', userId);

    return !error;
  },

  // Releases the lock on exit/save
  async releaseLock(projectId: string | number, userId: string): Promise<void> {
    await supabase
      .from('projetos')
      .update({
        locked_by: null,
        lock_expires_at: null
      })
      .eq('id', projectId)
      .eq('locked_by', userId);
  },

  // Checks current status (for Read-Only UI)
  async checkLockStatus(projectId: string | number, currentUserId: string): Promise<LockStatus> {
    const { data } = await supabase
      .from('projetos')
      .select('locked_by, lock_expires_at')
      .eq('id', projectId)
      .single();

    if (!data) return { isLocked: false };

    // Cast data to known shape since single() returns an object or null
    const lockData = data as unknown as { locked_by: string | null, lock_expires_at: string | null };

    if (!lockData.lock_expires_at) return { isLocked: false };

    const now = new Date();
    const expires = new Date(lockData.lock_expires_at);
    const isExpired = expires < now;

    if (lockData.locked_by && !isExpired && lockData.locked_by !== currentUserId) {
      // Here we could fetch user email if we wanted to show the name
      return { isLocked: true, lockedBy: 'another user' };
    }

    return { isLocked: false };
  }
};

export default ProjectLockService;
