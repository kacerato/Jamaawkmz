import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Project, Point, Connection, LockStatus } from '../types';
import ProjectLockService from '../services/ProjectLockService';
import {
  calculateTotalProjectDistance,
  generateRandomColor,
  normalizeSpans
} from '../utils/geoUtils';

// Define strict types for storage to avoid 'any'
interface StorageInterface {
  loadProjects: (userId: string) => Project[];
  saveProjects: (userId: string, projects: Project[]) => void;
}

const storage: StorageInterface = {
  saveProjects: (userId, projects) => {
    localStorage.setItem(`jamaaw_projects_${userId}`, JSON.stringify(projects));
  },
  loadProjects: (userId) => {
    const data = localStorage.getItem(`jamaaw_projects_${userId}`);
    return data ? JSON.parse(data) : [];
  }
};

const deduplicateProjects = (projectsList: Project[]): Project[] => {
  const uniqueMap = new Map();
  // Sort by update/create time desc
  const sorted = [...projectsList].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  sorted.forEach(p => {
    if (!uniqueMap.has(p.id)) {
      uniqueMap.set(p.id, p);
    }
  });
  return Array.from(uniqueMap.values());
};

export const useProjectSync = (user: { id: string; email?: string } | null, isOnline: boolean) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadedProjects, setLoadedProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [manualPoints, setManualPoints] = useState<Point[]>([]);
  const [extraConnections, setExtraConnections] = useState<Connection[]>([]);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lockStatus, setLockStatus] = useState<LockStatus>({ isLocked: false });

  // Use ref for interval to clear it properly
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load projects from Storage and Supabase
  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Load Local
      const localProjects = storage.loadProjects(user.id);
      let allProjects = [...localProjects];

      // 2. Load Remote if online
      if (isOnline) {
        const { data, error } = await supabase
          .from('projetos')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Error loading projects from Supabase:', error);
        } else if (data) {
          // Merge remote projects
          const remoteProjects = data as unknown as Project[];
          allProjects = [...allProjects, ...remoteProjects];
        }
      }

      // 3. Deduplicate and Set
      const uniqueProjects = deduplicateProjects(allProjects);
      setProjects(uniqueProjects);

      // Update local storage with merged list
      storage.saveProjects(user.id, uniqueProjects);

    } catch (e) {
      console.error("Error in loadProjects:", e);
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user, loadProjects]);

  // Realtime subscription for current project
  useEffect(() => {
    if (!currentProject?.id || !isOnline) return;

    const channel = supabase
      .channel(`project-tracking-${currentProject.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projetos',
          filter: `id=eq.${currentProject.id}`
        },
        (payload) => {
          const updatedProject = payload.new as unknown as Project;

          setCurrentProject(prev => prev ? ({ ...prev, ...updatedProject }) : null);

          if (updatedProject.points) {
            setManualPoints(updatedProject.points);
            setTotalDistance(updatedProject.total_distance);
          }

          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, isOnline]);

  // Heartbeat Logic
  useEffect(() => {
    // Clear existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (currentProject && isOnline && user && !currentProject.id.toString().startsWith('offline_')) {
      // Initial heartbeat
      ProjectLockService.heartbeat(currentProject.id, user.id);

      // Set interval
      heartbeatIntervalRef.current = setInterval(async () => {
        const success = await ProjectLockService.heartbeat(currentProject.id, user.id);
        if (!success) {
          console.warn('Failed to send heartbeat for project lock');
        }
      }, 120000); // 2 minutes
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [currentProject?.id, isOnline, user]);

  const saveProject = useCallback(async (
    projectName: string,
    points: Point[],
    connections: Connection[],
    bairro: string = 'Vários'
  ) => {
    if (!user) return null;

    try {
      // Normalize spans
      const finalPoints = normalizeSpans(points);
      const calculatedDistance = calculateTotalProjectDistance(finalPoints, connections);
      const nowISO = new Date().toISOString();

      const projectData: Partial<Project> = {
        name: projectName.trim(),
        points: finalPoints,
        extra_connections: connections,
        total_distance: calculatedDistance,
        bairro,
        tracking_mode: 'manual',
        updated_at: nowISO,
        user_id: user.id
      };

      let savedProject: Project;
      const targetId = currentProject?.id;

      // Update or Insert
      if (targetId) {
         if (isOnline && !targetId.toString().startsWith('offline_')) {
           const { data, error } = await supabase
             .from('projetos')
             .update(projectData)
             .eq('id', targetId)
             .select();

           if (error) throw error;
           savedProject = data[0] as unknown as Project;
         } else {
           // Offline update
           savedProject = {
             ...currentProject,
             ...projectData,
             id: targetId
           } as Project;
         }
      } else {
        // New Insert
        if (isOnline) {
          const { data, error } = await supabase.from('projetos').insert([projectData]).select();
          if (error) throw error;
          savedProject = data[0] as unknown as Project;
        } else {
          // Offline Insert
          savedProject = {
            ...projectData,
            id: `offline_${Date.now()}`,
            created_at: nowISO,
            totalDistance: calculatedDistance // Legacy compat
          } as Project;
        }
      }

      // Update Local State
      const localProjectObj = {
        ...savedProject,
        totalDistance: calculatedDistance
      };

      if (currentProject && currentProject.id === localProjectObj.id) {
        setCurrentProject(localProjectObj);
      }

      setProjects(prev => {
        const filtered = prev.filter(p => p.id !== localProjectObj.id);
        return [localProjectObj, ...filtered];
      });

      setLoadedProjects(prev => {
        const exists = prev.find(p => p.id === localProjectObj.id);
        if (exists) return prev.map(p => p.id === localProjectObj.id ? localProjectObj : p);
        return [...prev, localProjectObj];
      });

      setManualPoints(finalPoints);
      setTotalDistance(calculatedDistance);

      // Cache
      const userProjects = storage.loadProjects(user.id);
      const otherProjects = userProjects.filter(p => p.id !== localProjectObj.id);
      storage.saveProjects(user.id, [localProjectObj, ...otherProjects]);

      // Note: We don't release lock here usually, as user might continue editing.
      // App.jsx releases lock on "stopTracking" or explicit exit.

      return localProjectObj;

    } catch (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }, [user, currentProject, isOnline]);

  const deleteProject = useCallback(async (projectId: string | number) => {
    if (!user) return;

    // Optimistic update
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setLoadedProjects(prev => prev.filter(p => p.id !== projectId));

    // Local Storage
    const userProjects = storage.loadProjects(user.id);
    const updatedUserProjects = userProjects.filter(p => p.id !== projectId);
    storage.saveProjects(user.id, updatedUserProjects);

    if (currentProject?.id === projectId) {
      setCurrentProject(null);
      setManualPoints([]);
      setTotalDistance(0);
      setExtraConnections([]);
    }

    if (isOnline && !projectId.toString().startsWith('offline_')) {
      const { error } = await supabase
        .from('projetos')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) console.error("Error deleting project from Supabase:", error);
    }
  }, [user, isOnline, currentProject]);

  const loadProjectIntoView = useCallback(async (project: Project): Promise<boolean> => {
    // Check lock if online
    if (isOnline && user && !project.id.toString().startsWith('offline_')) {
       // Try acquire
       const hasLock = await ProjectLockService.acquireLock(project.id, user.id);
       if (!hasLock) {
         const status = await ProjectLockService.checkLockStatus(project.id, user.id);
         setLockStatus(status);
         if (status.isLocked) {
           console.warn(`Project locked by ${status.lockedBy}`);
           return false; // Locked by someone else
         }
       } else {
         setLockStatus({ isLocked: false });
       }
    }

    // Unload current lock if switching projects
    if (currentProject && isOnline && user && currentProject.id !== project.id && !currentProject.id.toString().startsWith('offline_')) {
        await ProjectLockService.releaseLock(currentProject.id, user.id);
    }

    setCurrentProject(project);
    setManualPoints(project.points || []);
    setExtraConnections(project.extra_connections || []);
    setTotalDistance(project.total_distance || 0);

    // Add to loaded projects if not present
    setLoadedProjects(prev => {
      if (prev.find(p => p.id === project.id)) return prev;
      return [...prev, { ...project, color: project.color || generateRandomColor() }];
    });

    return true;

  }, [isOnline, user, currentProject]);

  const releaseCurrentLock = useCallback(async () => {
    if (currentProject && isOnline && user && !currentProject.id.toString().startsWith('offline_')) {
      await ProjectLockService.releaseLock(currentProject.id, user.id);
    }
  }, [currentProject, isOnline, user]);

  return {
    projects,
    loadedProjects,
    currentProject,
    manualPoints,
    extraConnections,
    totalDistance,
    loading,
    lockStatus,
    setManualPoints,
    setExtraConnections,
    setCurrentProject,
    setLoadedProjects,
    loadProjects,
    saveProject,
    deleteProject,
    loadProjectIntoView,
    releaseCurrentLock
  };
};
