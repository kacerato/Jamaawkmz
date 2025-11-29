// BairroDetectionService.jsx
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
        return `${bairros[0]} e outros`;
      }
      
      return 'Vários';
    } catch (error) {
      console.error('Erro ao detectar bairro do projeto:', error);
      return 'Vários';
    }
  }
}

export default BairroDetectionService;