// src/utils/MapboxStatic.js

// Algoritmo de Google Polyline Encoding (Essencial para URLs curtas)
const encodePolyline = (points) => {
  let str = '';
  let encodeDiff = (diff) => {
    let shifted = diff << 1;
    if (diff < 0) shifted = ~shifted;
    let rem = shifted;
    while (rem >= 0x20) {
      str += String.fromCharCode((0x20 | (rem & 0x1f)) + 63);
      rem >>= 5;
    }
    str += String.fromCharCode(rem + 63);
  };
  
  let lastLat = 0;
  let lastLng = 0;
  
  for (let i = 0; i < points.length; i++) {
    // Reduz precisão para 5 casas decimais (padrão Mapbox/Google)
    let lat = Math.round(points[i].lat * 1e5);
    let lng = Math.round(points[i].lng * 1e5);
    
    encodeDiff(lat - lastLat);
    encodeDiff(lng - lastLng);
    
    lastLat = lat;
    lastLng = lng;
  }
  return str;
};

// Função para simplificar pontos mantendo início e fim
const simplifyPoints = (points, maxPoints = 200) => {
  if (points.length <= maxPoints) return points;
  
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const simplified = points.filter((_, i) => i % step === 0);
  
  // Garante que o primeiro e último pontos estão incluídos
  if (simplified[0] !== points[0]) simplified.unshift(points[0]);
  if (simplified[simplified.length - 1] !== points[points.length - 1]) {
    simplified.push(points[points.length - 1]);
  }
  
  return simplified;
};

export const getStaticMapUrl = (points, width = 800, height = 400) => {
  if (!points || points.length === 0) return null;
  
  // Token público do Mapbox
  const accessToken = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';
  
  // 1. Simplificação de Pontos (Amostragem)
  const simplifiedPoints = simplifyPoints(points, 150); // Máximo 150 pontos para segurança
  
  // 2. Define Marcadores (Início = Verde, Fim = Vermelho)
  const start = points[0];
  const end = points[points.length - 1];
  
  // pin-s-label+color(lng,lat)
  const markerStart = `pin-s-a+10b981(${start.lng},${start.lat})`;
  const markerEnd = `pin-s-b+ef4444(${end.lng},${end.lat})`;
  
  // 3. Tenta codificar o caminho com fallback
  let overlays = [markerStart, markerEnd];
  
  try {
    if (simplifiedPoints.length > 1) {
      const encodedPath = encodePolyline(simplifiedPoints);
      const encodedPathUri = encodeURIComponent(encodedPath);
      
      // Verifica se o caminho codificado é muito longo
      if (encodedPathUri.length < 3000) { // Limite seguro para URL
        const pathOverlay = `path-4+06b6d4-0.9(${encodedPathUri})`;
        overlays.unshift(pathOverlay); // Path primeiro (fundo)
      }
    }
  } catch (error) {
    console.warn('Não foi possível codificar o caminho, usando apenas marcadores:', error);
  }
  
  // 4. Monta a URL final
  const styleId = 'mapbox/satellite-streets-v12';
  const overlayString = overlays.join(',');
  
  // Usa 'auto' para o Mapbox calcular zoom/centro automaticamente
  // Adiciona @2x para alta resolução e padding para não cortar marcadores
  return `https://api.mapbox.com/styles/v1/${styleId}/static/${overlayString}/auto/${width}x${height}@2x?padding=40&access_token=${accessToken}`;
};