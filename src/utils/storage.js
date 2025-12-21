// src/utils/storage.js

export const storage = {
  // Projetos
  saveProjects: (userId, projects) => {
    if (!userId) return;
    localStorage.setItem(`jamaaw_projects_${userId}`, JSON.stringify(projects));
  },
  loadProjects: (userId) => {
    if (!userId) return [];
    const data = localStorage.getItem(`jamaaw_projects_${userId}`);
    return data ? JSON.parse(data) : [];
  },
  
  // Bairros
  saveBairros: (bairros) => {
    localStorage.setItem('jamaaw_bairros', JSON.stringify(bairros));
  },
  loadBairros: () => {
    const data = localStorage.getItem('jamaaw_bairros');
    return data ? JSON.parse(data) : null;
  },
  
  // Favoritos
  saveFavorites: (userId, favorites) => {
    if (!userId) return;
    localStorage.setItem(`jamaaw_favorites_${userId}`, JSON.stringify(favorites));
  },
  loadFavorites: (userId) => {
    if (!userId) return [];
    const data = localStorage.getItem(`jamaaw_favorites_${userId}`);
    return data ? JSON.parse(data) : [];
  },
  
  // Marcadores
  saveMarkers: (userId, markers) => {
    if (!userId) return;
    localStorage.setItem(`jamaaw_markers_${userId}`, JSON.stringify(markers));
  },
  loadMarkers: (userId) => {
    if (!userId) return [];
    const data = localStorage.getItem(`jamaaw_markers_${userId}`);
    return data ? JSON.parse(data) : null;
  },
  
  // Limpar dados
  deleteProject: (userId, projectId) => {
    const projects = storage.loadProjects(userId);
    const updatedProjects = projects.filter(p => p.id !== projectId);
    storage.saveProjects(userId, updatedProjects);
  },
  
  clearUserData: (userId) => {
    if (!userId) return;
    localStorage.removeItem(`jamaaw_projects_${userId}`);
    localStorage.removeItem(`jamaaw_favorites_${userId}`);
    localStorage.removeItem(`jamaaw_markers_${userId}`);
  },
};