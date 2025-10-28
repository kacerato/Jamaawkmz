// Utilitários para gerenciamento de projetos
export const saveProject = async (projectData) => {
  try {
    const projects = await getProjects();
    const newProject = {
      id: Date.now().toString(),
      ...projectData,
      createdAt: new Date().toISOString()
    };
    
    const updatedProjects = [...projects, newProject];
    localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
    
    return newProject;
  } catch (error) {
    console.error('Erro ao salvar projeto:', error);
    throw error;
  }
};

export const getProjects = async () => {
  try {
    const projects = localStorage.getItem('jamaaw_projects');
    return projects ? JSON.parse(projects) : [];
  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    return [];
  }
};

export const deleteProject = async (projectId) => {
  try {
    const projects = await getProjects();
    const updatedProjects = projects.filter(project => project.id !== projectId);
    localStorage.setItem('jamaaw_projects', JSON.stringify(updatedProjects));
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    throw error;
  }
};

export const formatProjectDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};