import axios from 'axios';

class BairroDetectionService {
  static async detectBairro(lat, lng) {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'JamaawApp/1.0'
          }
        }
      );
      
      if (response.data && response.data.address) {
        const address = response.data.address;
        
        // Prioridade para diferentes nomes de bairro na resposta
        const bairro = address.suburb ||
          address.neighbourhood ||
          address.quarter ||
          address.city_district ||
          address.village ||
          address.town ||
          '';
        
        return bairro;
      }
      return '';
    } catch (error) {
      console.error('Erro ao detectar bairro:', error);
      return '';
    }
  }
  
  static async detectBairroForProject(points) {
    if (!points || points.length === 0) return 'Vários';
    
    try {
      // Amostra alguns pontos para detectar o bairro
      const samplePoints = points.length > 5 ?
        [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]] :
        [points[0]];
      
      const bairros = [];
      
      for (const point of samplePoints) {
        const bairro = await this.detectBairro(point.lat, point.lng);
        if (bairro && !bairros.includes(bairro)) {
          bairros.push(bairro);
        }
        
        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (bairros.length === 1) {
        return bairros[0];
      } else if (bairros.length > 1) {
        // CORREÇÃO: Se houver múltiplos bairros, verifica se são similares
        const isSameArea = this.checkIfSameArea(bairros);
        if (isSameArea) {
          return bairros[0]; // Retorna o primeiro se forem da mesma área
        }
        return `${bairros[0]} e outros`;
      }
      
      return 'Vários';
    } catch (error) {
      console.error('Erro ao detectar bairro do projeto:', error);
      return 'Vários';
    }
  }

  // NOVA FUNÇÃO: Verifica se bairros são da mesma área
  static checkIfSameArea(bairros) {
    if (bairros.length <= 1) return true;
    
    // Normaliza os nomes dos bairros para comparação
    const normalizedBairros = bairros.map(b => 
      b.toLowerCase()
       .normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '')
       .replace(/\s+/g, ' ')
       .trim()
    );
    
    // Verifica se todos os bairros são similares (mesma raiz ou área)
    const firstBairro = normalizedBairros[0];
    return normalizedBairros.every(bairro => 
      bairro.includes(firstBairro) || 
      firstBairro.includes(bairro) ||
      this.calculateSimilarity(firstBairro, bairro) > 0.7
    );
  }

  // FUNÇÃO AUXILIAR: Calcula similaridade entre strings
  static calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.editDistance(longer, shorter)) / parseFloat(longer.length);
  }

  // FUNÇÃO AUXILIAR: Calcula distância de edição (Levenshtein)
  static editDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    return track[str2.length][str1.length];
  }

  // NOVA FUNÇÃO: Detecta bairro para múltiplos projetos
  static async detectBairroForMultipleProjects(projects) {
    if (!projects || projects.length === 0) return 'Vários';
    
    try {
      const allBairros = [];
      
      // Para cada projeto, detecta o bairro
      for (const project of projects) {
        let projectBairro = project.bairro;
        
        // Se o projeto já tem bairro definido e não é "Vários", usa esse
        if (projectBairro && projectBairro !== 'Vários') {
          allBairros.push(projectBairro);
          continue;
        }
        
        // Caso contrário, detecta o bairro
        projectBairro = await this.detectBairroForProject(project.points);
        allBairros.push(projectBairro);
        
        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Filtra bairros válidos
      const validBairros = allBairros.filter(b => b && b !== 'Vários');
      
      if (validBairros.length === 0) return 'Vários';
      
      // Verifica se todos os bairros são iguais ou similares
      const uniqueBairros = [...new Set(validBairros)];
      
      if (uniqueBairros.length === 1) {
        return uniqueBairros[0];
      }
      
      // Se há múltiplos bairros, verifica se são da mesma área
      const isSameArea = this.checkIfSameArea(uniqueBairros);
      if (isSameArea) {
        return uniqueBairros[0]; // Retorna o primeiro bairro da área
      }
      
      // Se são bairros completamente diferentes
      if (uniqueBairros.length <= 3) {
        return uniqueBairros.join(', ');
      } else {
        return `${uniqueBairros[0]} e mais ${uniqueBairros.length - 1}`;
      }
      
    } catch (error) {
      console.error('Erro ao detectar bairro para múltiplos projetos:', error);
      return 'Vários';
    }
  }
}

export default BairroDetectionService;