// src/utils/MapboxStatic.js

export const getStaticMapUrl = (points, width = 800, height = 400) => {
    if (!points || points.length === 0) return null;

    const accessToken = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

    // 1. CONSTRUÇÃO INTELIGENTE DO TRAÇADO (RAMIFICAÇÕES)
    // Em vez de uma linha única, criamos segmentos baseados na conexão
    const segments = [];

    points.forEach((point, index) => {
        // Lógica de Ramificação: Se tem pai (connectedFrom), desenha linha do Pai -> Filho
        if (point.connectedFrom) {
            const parent = points.find(p => p.id === point.connectedFrom);
            if (parent) {
                segments.push([
                    [parent.lng, parent.lat],
                    [point.lng, point.lat]
                ]);
            }
        } 
        // Lógica Sequencial: Se não é ramificação e não é o primeiro, conecta no anterior
        else if (index > 0) {
            const prev = points[index - 1];
            // Apenas se o anterior também não for o início de um galho desconectado
            if (!point.connectedFrom) { 
                segments.push([
                    [prev.lng, prev.lat],
                    [point.lng, point.lat]
                ]);
            }
        }
    });

    // Se não gerou segmentos (ex: apenas 1 ponto), não desenha linha
    if (segments.length === 0 && points.length > 1) {
        // Fallback simples sequencial
        for(let i=0; i<points.length-1; i++) {
            segments.push([[points[i].lng, points[i].lat], [points[i+1].lng, points[i+1].lat]]);
        }
    }

    // 2. CRIAÇÃO DO GEOJSON (MultiLineString)
    // O Mapbox Static aceita GeoJSON customizado. Isso permite desenhar qualquer forma.
    const geojson = {
        type: 'Feature',
        properties: {
            'stroke': '#06b6d4', // Cyan
            'stroke-width': 4,
            'stroke-opacity': 0.9
        },
        geometry: {
            type: 'MultiLineString',
            coordinates: segments
        }
    };

    // 3. DEFINIÇÃO DE MARCADORES (Início e Fim)
    // Precisamos simplificar para não estourar a URL, então pegamos só Start/End
    const start = points[0];
    const end = points[points.length - 1];
    
    // pin-s-label+color(lng,lat)
    const markerStart = `pin-s-a+10b981(${start.lng},${start.lat})`;
    const markerEnd = `pin-s-b+ef4444(${end.lng},${end.lat})`;

    // 4. MONTAGEM DA URL
    // Codificamos o GeoJSON para URL
    const geojsonStr = encodeURIComponent(JSON.stringify(geojson));
    
    // Adicionamos o GeoJSON como overlay
    const overlayGeojson = `geojson(${geojsonStr})`;
    
    // Junta tudo: GeoJSON + Marcadores
    // Nota: Se a URL ficar muito grande, o Mapbox retorna 413. 
    // Nesse caso, o PDF vai mostrar sem traçado ou precisamos simplificar mais.
    const overlays = [overlayGeojson, markerStart, markerEnd].join(',');

    const styleId = 'mapbox/satellite-streets-v12';

    return `https://api.mapbox.com/styles/v1/${styleId}/static/${overlays}/auto/${width}x${height}@2x?padding=40&access_token=${accessToken}`;
};