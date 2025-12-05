import mapboxgl from 'mapbox-gl'; // Apenas para usar utilitários se necessário, ou use polyline encoder

// Algoritmo simples para codificar geometria (Polyline) para URL
// Isso reduz o tamanho da URL drasticamente
const encodePolyline = (coordinates) => {
  // Simplificação extrema para URL não estourar (Mapbox Static API tem limite)
  // Pegamos a cada X pontos dependendo do tamanho
  const step = Math.max(1, Math.floor(coordinates.length / 80));
  let reducedCoords = coordinates.filter((_, i) => i % step === 0);
  
  // Fallback: se ainda for muito grande, retorna null (o PDF vai focar no centro)
  if (reducedCoords.length > 100) return null;
  
  // Retorna formato: {lng},{lat};{lng},{lat}...
  return reducedCoords.map(p => `${p.lng},${p.lat}`).join(';');
};

export const getStaticMapUrl = (points, width = 600, height = 400) => {
  if (!points || points.length === 0) return null;
  
  const accessToken = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';
  
  // Calcula centro
  const lngs = points.map(p => p.lng);
  const lats = points.map(p => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  // Fit Bounds automático
  const pathString = `path-5+06b6d4-0.8(${encodeURIComponent(encodePolyline(points))})`;
  
  // Se o path for muito longo, usamos 'auto' apenas com markers no inicio e fim
  // URL format: https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom}/{width}x{height}?access_token={token}
  
  // Usando estilo Satellite Streets para ver as ruas
  const styleId = 'mapbox/satellite-streets-v12';
  
  // Overlay: Path em Ciano + Marker Verde (Inicio) + Marker Vermelho (Fim)
  const start = points[0];
  const end = points[points.length - 1];
  
  // Construção segura da URL
  // Nota: A API Static tem limites de caracteres. Se o projeto for gigante,
  // desenhamos apenas os markers e focamos no bbox.
  
  let overlays = [];
  
  // Marker Início (Verde)
  overlays.push(`pin-s-a+10b981(${start.lng},${start.lat})`);
  // Marker Fim (Vermelho)
  overlays.push(`pin-s-b+ef4444(${end.lng},${end.lat})`);
  
  // Tenta adicionar o path se não for gigante
  const polyline = encodePolyline(points);
  if (polyline) {
    // Syntax: path-{strokeWidth}+{strokeColor}-{strokeOpacity}({polyline})
    // Usamos raw coordinates separados por ; para simplificar se o polyline encoder falhar
    const rawCoords = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 50)) === 0)
      .map(p => `${p.lng},${p.lat}`).join(',');
    
    overlays.push(`path-4+06b6d4-0.9(${rawCoords})`);
  }
  
  const overlayString = overlays.join(',');
  
  // Usamos 'auto' para o Mapbox calcular o zoom e centro baseado nos overlays
  return `https://api.mapbox.com/styles/v1/${styleId}/static/${overlayString}/auto/${width}x{height}@2x?padding=40&access_token=${accessToken}`;
};