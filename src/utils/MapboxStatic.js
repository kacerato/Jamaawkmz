// src/utils/MapboxStatic.js

export const getStaticMapUrl = (points, width = 800, height = 400) => {
    if (!points || points.length === 0) return null;

    const accessToken = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

    // 1. CONSTRUÇÃO INTELIGENTE DO TRAÇADO (RAMIFICAÇÕES)
    const segments = [];

    points.forEach((point, index) => {
        if (point.connectedFrom) {
            const parent = points.find(p => p.id === point.connectedFrom);
            if (parent) {
                segments.push([
                    [parent.lng, parent.lat],
                    [point.lng, point.lat]
                ]);
            }
        } else if (index > 0) {
            const prev = points[index - 1];
            if (!point.connectedFrom) { 
                segments.push([
                    [prev.lng, prev.lat],
                    [point.lng, point.lat]
                ]);
            }
        }
    });

    if (segments.length === 0 && points.length > 1) {
        for(let i = 0; i < points.length - 1; i++) {
            segments.push([[points[i].lng, points[i].lat], [points[i + 1].lng, points[i + 1].lat]]);
        }
    }

    // 2. CRIAÇÃO DO GEOJSON (MultiLineString)
    const geojson = {
        type: 'Feature',
        properties: {
            'stroke': '#06b6d4',
            'stroke-width': 4,
            'stroke-opacity': 0.9
        },
        geometry: {
            type: 'MultiLineString',
            coordinates: segments
        }
    };

    // 3. DEFINIÇÃO DE MARCADORES COM LABELS INTELIGENTE
    // Para evitar URL muito longa, limitamos a quantidade de marcadores
    // Estratégia: Pegar marcadores a cada N pontos + início e fim
    const getMarkersWithLabels = () => {
        const markers = [];
        
        // Sempre adiciona início e fim
        const start = points[0];
        const end = points[points.length - 1];
        
        // Adiciona marcador do início com label "1" (se existir)
        if (start.label) {
            markers.push(`pin-s-${start.label}+10b981(${start.lng},${start.lat})`);
        } else {
            markers.push(`pin-s-a+10b981(${start.lng},${start.lat})`);
        }
        
        // Adiciona marcador do fim com label (se existir)
        if (end.label) {
            markers.push(`pin-s-${end.label}+ef4444(${end.lng},${end.lat})`);
        } else {
            markers.push(`pin-s-b+ef4444(${end.lng},${end.lat})`);
        }
        
        // Para projetos com até 10 pontos, adiciona todos os marcadores
        if (points.length <= 10) {
            for (let i = 1; i < points.length - 1; i++) {
                const point = points[i];
                if (point.label) {
                    // Usa a label fornecida (número do poste)
                    markers.push(`pin-s-${point.label}+3b82f6(${point.lng},${point.lat})`);
                } else {
                    // Fallback para letras sequenciais (c, d, e...)
                    const letter = String.fromCharCode(99 + ((i - 1) % 23)); // c até z
                    markers.push(`pin-s-${letter}+3b82f6(${point.lng},${point.lat})`);
                }
            }
        } else {
            // Para projetos maiores, amostragem inteligente:
            // Adiciona marcadores a cada N pontos, priorizando pontos com labels
            const sampleRate = Math.ceil(points.length / 15); // Máximo ~15 marcadores
            const sampledIndices = new Set();
            
            // Garante início e fim já incluídos
            sampledIndices.add(0);
            sampledIndices.add(points.length - 1);
            
            // Amostra pontos intermediários
            for (let i = sampleRate; i < points.length - 1; i += sampleRate) {
                sampledIndices.add(i);
            }
            
            // Adiciona marcadores amostrados
            Array.from(sampledIndices).sort((a, b) => a - b).forEach(index => {
                const point = points[index];
                if (index === 0 || index === points.length - 1) {
                    // Já adicionado acima
                    return;
                }
                
                if (point.label) {
                    markers.push(`pin-s-${point.label}+3b82f6(${point.lng},${point.lat})`);
                } else {
                    // Usa número baseado no índice
                    const labelNum = (index + 1) % 10; // 0-9
                    markers.push(`pin-s-${labelNum}+3b82f6(${point.lng},${point.lat})`);
                }
            });
        }
        
        return markers;
    };

    // 4. MONTAGEM DA URL
    const geojsonStr = encodeURIComponent(JSON.stringify(geojson));
    const overlayGeojson = `geojson(${geojsonStr})`;
    
    // Obtém marcadores com labels
    const markers = getMarkersWithLabels();
    
    // Combina overlays (GeoJSON + marcadores)
    // Nota: A API do Mapbox tem limite de URL. Se houver muitos marcadores,
    // priorizamos o traçado (GeoJSON) e reduzimos marcadores
    let overlays = [overlayGeojson];
    
    // Se a URL estiver ficando muito longa, limita marcadores
    const estimatedUrlLength = geojsonStr.length + markers.join('').length;
    if (estimatedUrlLength < 6000) { // Limite seguro para evitar erro 413
        overlays = [...overlays, ...markers];
    } else {
        // Adiciona apenas início e fim se a URL estiver muito longa
        const start = points[0];
        const end = points[points.length - 1];
        const minimalMarkers = [
            start.label ? `pin-s-${start.label}+10b981(${start.lng},${start.lat})` : `pin-s-a+10b981(${start.lng},${start.lat})`,
            end.label ? `pin-s-${end.label}+ef4444(${end.lng},${end.lat})` : `pin-s-b+ef4444(${end.lng},${end.lat})`
        ];
        overlays = [...overlays, ...minimalMarkers];
    }
    
    const finalOverlays = overlays.join(',');
    const styleId = 'mapbox/satellite-streets-v12';

    return `https://api.mapbox.com/styles/v1/${styleId}/static/${finalOverlays}/auto/${width}x${height}@2x?padding=40&access_token=${accessToken}`;
};