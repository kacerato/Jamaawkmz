import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, X, MapPin, Activity, Calendar, User, Clock, Hash, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { FileOpener } from '@capacitor-community/file-opener';
import { calculateTotalProjectDistance } from '../utils/geoUtils';

// --- FUNÇÃO DE MAPA ROBUSTA (EMBUTIDA PARA GARANTIR INTEGRIDADE DA URL) ---
const getRobustStaticMapUrl = (points, pointIndexMap, width = 800, height = 400) => {
  if (!points || points.length === 0) return null;

  const accessToken = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';
  const styleId = 'mapbox/satellite-streets-v12';
  const MAX_URL_LENGTH = 7500; // Limite de segurança (Mapbox aceita ~8k)

  // 1. Constrói o GeoJSON do Traçado (MultiLineString)
  const segments = [];
  points.forEach((point, index) => {
    if (point.connectedFrom) {
      const parent = points.find(p => p.id === point.connectedFrom);
      if (parent) segments.push([[parent.lng, parent.lat], [point.lng, point.lat]]);
    } else if (index > 0) {
      const prev = points[index - 1];
      if (!point.connectedFrom) segments.push([[prev.lng, prev.lat], [point.lng, point.lat]]);
    }
  });

  // Fallback se não houver segmentos lógicos
  if (segments.length === 0 && points.length > 1) {
    for(let i=0; i<points.length-1; i++) {
        segments.push([[points[i].lng, points[i].lat], [points[i+1].lng, points[i+1].lat]]);
    }
  }

  const geojson = {
    type: 'Feature',
    properties: { 'stroke': '#06b6d4', 'stroke-width': 4, 'stroke-opacity': 0.9 },
    geometry: { type: 'MultiLineString', coordinates: segments }
  };
  
  const geojsonStr = encodeURIComponent(JSON.stringify(geojson));
  const overlayGeojson = `geojson(${geojsonStr})`;

  // 2. Adiciona Marcadores com Números (Com verificação de limite)
  let markers = [];
  let currentUrlLength = `https://api.mapbox.com/styles/v1/${styleId}/static//auto/${width}x${height}@2x?padding=40&access_token=${accessToken}`.length + overlayGeojson.length;

  // Lógica de Amostragem: Se tiver muitos pontos, pula números para não quebrar
  // Tenta mostrar todos. Se projected length > max, aumenta o 'step'.
  let step = 1;
  const avgMarkerLength = 45; // Comprimento médio de string de um marcador
  const projectedLength = currentUrlLength + (points.length * avgMarkerLength);
  
  if (projectedLength > MAX_URL_LENGTH) {
    // Calcula um step seguro
    const spaceAvailable = MAX_URL_LENGTH - currentUrlLength;
    const markersPossible = Math.floor(spaceAvailable / avgMarkerLength);
    step = Math.ceil(points.length / markersPossible);
    // Garante que o step não seja 0
    if (step < 1) step = 1;
  }

  points.forEach((p, idx) => {
    // Sempre mostra o primeiro e o último, e os intermediários baseados no step
    if (idx === 0 || idx === points.length - 1 || idx % step === 0) {
        const globalNum = pointIndexMap.get(p.id);
        // Mapbox aceita 'pin-s-n+{number}' para números até 99, depois vira texto menor ou clipa
        // Cor: Verde p/ inicio, Vermelho p/ fim, Azul p/ meio
        let color = '0ea5e9'; // Azul default
        if (idx === 0) color = '10b981'; // Verde
        if (idx === points.length - 1) color = 'ef4444'; // Vermelho
        
        // Formato: pin-s-n+<numero>+<cor>(lng,lat)
        markers.push(`pin-s-n+${globalNum}+${color}(${p.lng},${p.lat})`);
    }
  });

  const overlays = [overlayGeojson, ...markers].join(',');

  return `https://api.mapbox.com/styles/v1/${styleId}/static/${overlays}/auto/${width}x${height}@2x?padding=40&access_token=${accessToken}`;
};

// --- FUNÇÃO AUXILIAR DISTÂNCIA ---
function calcDist(p1, p2) {
  if (!p1 || !p2) return 0;
  const R = 6371e3;
  const φ1 = p1.lat * Math.PI / 180;
  const φ2 = p2.lat * Math.PI / 180;
  const a = Math.sin((p2.lat-p1.lat) * Math.PI / 180/2)**2 + Math.cos(φ1)*Math.cos(φ2) * Math.sin((p2.lng-p1.lng) * Math.PI / 180/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const ProjectReport = ({ isOpen, onClose, project, mapImage, currentUserEmail }) => {
  const [staticMapUrl, setStaticMapUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- PROCESSAMENTO DE DADOS ---
  const stats = useMemo(() => {
    if (!project || !project.points) return null;

    // 1. MAPA DE ÍNDICES GLOBAIS (Fundamental para Poste 1, Poste 2...)
    const pointIndexMap = new Map();
    project.points.forEach((p, index) => {
        pointIndexMap.set(p.id, index + 1); // 1-based index
    });

    const groups = {};
    const userResponsibility = {};
    let totalSpans = 0;
    let maxSpansPerSegment = 0;

    const calculatedTotalDistance = calculateTotalProjectDistance(
      project.points || [], 
      project.extra_connections || []
    );

    project.points.forEach((p, idx) => {
      const dateObj = new Date(p.timestamp || p.created_at);
      const date = dateObj.toLocaleDateString('pt-BR');
      
      if (!groups[date]) {
        groups[date] = { 
          points: [], 
          distance: 0,
          startTime: dateObj, 
          endTime: dateObj,
          users: new Set(),
          spans: 0
        };
      }
      
      const group = groups[date];
      group.points.push(p);
      
      if (dateObj < group.startTime) group.startTime = dateObj;
      if (dateObj > group.endTime) group.endTime = dateObj;

      let previousPoint = null;
      if (p.connectedFrom) {
        previousPoint = project.points.find(pt => pt.id === p.connectedFrom);
      } else if (idx > 0) {
        previousPoint = project.points[idx - 1];
      }

      const spans = (p.spans !== undefined && p.spans !== null && !isNaN(p.spans)) ? Math.max(1, Number(p.spans)) : 1;

      if (previousPoint) {
        const segmentMeters = calcDist(previousPoint, p);
        const totalSegmentMeters = segmentMeters * spans;
        group.distance += totalSegmentMeters;
      }

      group.spans += spans;
      totalSpans += spans;
      if (spans > maxSpansPerSegment) maxSpansPerSegment = spans;

      const user = p.user_email || currentUserEmail || 'Desconhecido';
      group.users.add(user.split('@')[0]); 
      if (!userResponsibility[user]) userResponsibility[user] = 0;
      userResponsibility[user]++;
    });

    return {
      groups,
      userResponsibility,
      totalDistance: calculatedTotalDistance,
      totalSpans,
      maxSpansPerSegment,
      totalPoints: project.points.length,
      pointIndexMap, // EXPORTANDO O MAPA
      lastUpdate: new Date(project.updated_at || Date.now()).toLocaleString('pt-BR'),
      hasBranches: project.points.some(p => p.connectedFrom),
      hasExtraConnections: project.extra_connections && project.extra_connections.length > 0
    };
  }, [project, currentUserEmail]);

  useEffect(() => {
    if (isOpen && project?.points?.length > 0 && stats?.pointIndexMap) {
      // Usando a função robusta interna
      const url = getRobustStaticMapUrl(project.points, stats.pointIndexMap, 800, 400); 
      setStaticMapUrl(url);
    }
  }, [isOpen, project, stats]);

  if (!project || !stats) return null;

  const formatDist = (m) => {
    if (m < 1) return `${(m * 100).toFixed(0)} cm`;
    if (m < 1000) return `${m.toFixed(1)} m`;
    return `${(m/1000).toFixed(3)} km`;
  };

  const generateAndOpenPDF = async () => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      const originalAddPage = doc.addPage;
      doc.addPage = function() {
        const ret = originalAddPage.call(this);
        this.setFillColor(15, 23, 42); 
        this.rect(0, 0, width, height, 'F');
        return ret;
      };

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, width, height, 'F');

      let y = 15;

      // Cabeçalho
      doc.setTextColor(34, 211, 238); 
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO TÉCNICO - JAMAAW", 15, y);
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); 
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, y + 6);
      doc.text("Sistema de Mapeamento de Redes", width - 15, y, { align: 'right' });

      y += 15;

      // Imagem do Mapa
      if (staticMapUrl) {
        try {
          const response = await fetch(staticMapUrl);
          const blob = await response.blob();
          const base64 = await new Promise((r) => { 
            const reader = new FileReader(); 
            reader.onload = () => r(reader.result); 
            reader.readAsDataURL(blob); 
          });
          
          doc.addImage(base64, 'JPEG', 15, y, 180, 90);
          doc.setDrawColor(34, 211, 238);
          doc.setLineWidth(0.5);
          doc.rect(15, y, 180, 90);
          y += 95;
        } catch (e) {
          console.error("Erro ao baixar mapa", e);
          doc.setTextColor(239, 68, 68);
          doc.text("Erro ao carregar imagem do mapa", 15, y + 10);
          y += 20;
        }
      }

      // Card Resumo
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(15, y, 180, 35, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(project.name.toUpperCase(), 20, y + 10);
      
      doc.setFontSize(10);
      doc.setTextColor(34, 211, 238);
      doc.text(`EXTENSÃO TOTAL: ${formatDist(stats.totalDistance)}`, 20, y + 20);
      doc.text(`PONTOS: ${stats.totalPoints}`, 90, y + 20);
      doc.text(`BAIRRO: ${project.bairro || 'N/A'}`, 140, y + 20);
      
      doc.setTextColor(168, 85, 247); 
      doc.text(`VÃOS: ${stats.totalSpans}`, 20, y + 30);
      doc.text(`RASTREAMENTO: ${project.tracking_mode || 'manual'}`, 90, y + 30);
      doc.text(`ATUALIZADO: ${new Date(project.updated_at).toLocaleDateString('pt-BR')}`, 140, y + 30);
      
      y += 45;

      // Detalhamento Diário
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("DETALHAMENTO DIÁRIO (POSTE A POSTE)", 15, y);
      y += 5;

      const detailData = [];
      Object.entries(stats.groups).forEach(([date, groupData]) => {
        detailData.push([
          { 
            content: `${date} - Produção: ${formatDist(groupData.distance)} (${groupData.spans} vãos)`, 
            colSpan: 4, 
            styles: { 
              fillColor: [51, 65, 85], 
              fontStyle: 'bold', 
              textColor: [34, 211, 238], 
              halign: 'left' 
            } 
          }
        ]);
        
        groupData.points.forEach((p) => {
          const globalNum = stats.pointIndexMap.get(p.id); // NUMERO DO POSTE GLOBAL
          const spans = (p.spans !== undefined && p.spans !== null && !isNaN(p.spans)) ? 
                       Math.max(1, Number(p.spans)) : 1;
          
          detailData.push([
            `Poste ${globalNum}`, // Mostra "Poste 15"
            new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
            `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
            `${p.user_email?.split('@')[0] || '---'} (${spans} AG)`
          ]);
        });
      });

      autoTable(doc, {
        startY: y,
        head: [['POSTE', 'HORA', 'COORDENADAS', 'TÉCNICO (VÃOS)']],
        body: detailData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [34, 211, 238], lineColor: [34, 211, 238] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [39, 51, 71] },
        margin: { left: 15, right: 15 },
        styles: { textColor: [255, 255, 255] }
      });

      // Análise de Vãos por Segmento
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, width, height, 'F');
      
      y = 20;
      doc.setFontSize(16);
      doc.setTextColor(34, 211, 238);
      doc.text("ANÁLISE DE VÃOS POR SEGMENTO", 15, y);
      
      y += 10;
      
      const spanAnalysisData = [];
      let segmentCount = 0;
      
      if (project.points && project.points.length > 1) {
        for (let i = 1; i < project.points.length; i++) {
          const current = project.points[i];
          let previous = null;
          
          if (current.connectedFrom) {
             previous = project.points.find(p => p.id === current.connectedFrom);
          } else {
             previous = project.points[i - 1];
          }

          if (previous) {
            const spans = (current.spans !== undefined && current.spans !== null && !isNaN(current.spans)) ? 
                        Math.max(1, Number(current.spans)) : 1;
            
            segmentCount++;
            const segmentDist = calcDist(previous, current);
            const totalDist = segmentDist * spans;
            
            // PEGAR NÚMEROS GLOBAIS
            const prevNum = stats.pointIndexMap.get(previous.id);
            const currNum = stats.pointIndexMap.get(current.id);

            spanAnalysisData.push([
                segmentCount,
                `Poste ${prevNum} - Poste ${currNum}`, // COLUNA TRECHO
                formatDist(segmentDist), // Distância Base
                `${spans} AG`,           // Formato "3 AG"
                formatDist(totalDist)    // Distância Multiplicada
            ]);
          }
        }
      }
      
      autoTable(doc, {
        startY: y,
        head: [['#', 'TRECHO', 'DIST BASE', 'VÃOS', 'DIST TOTAL']],
        body: spanAnalysisData,
        theme: 'grid',
        headStyles: { fillColor: [168, 85, 247], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 'auto' },
            2: { halign: 'right' },
            3: { halign: 'center' },
            4: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 }
      });

      // Rodapé Final
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${pageCount}`, width - 20, height - 10, { align: 'right' });
        doc.text("Jamaaw Geo System © 2024", 15, height - 10);
      }

      const safeName = `Relatorio_${project.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.pdf`;
      
      if (Capacitor.getPlatform() === 'web') {
        doc.save(safeName);
      } else {
        const base64Data = doc.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: safeName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        try {
            await FileOpener.open({
                filePath: savedFile.uri,
                contentType: 'application/pdf',
                openWithDefault: false
            });
        } catch (openerError) {
            alert(`Salvo em Documentos. Erro ao abrir: ${openerError.message}`);
        }
      }

    } catch (e) {
      console.error(e);
      alert("Erro ao gerar PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-[90vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
          
          {/* Header */}
          <div className="flex-none p-5 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400 w-5 h-5" /> Relatório Detalhado
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase">
                    {project.name}
                  </span>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400 -mr-2">
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* Conteúdo Visual (Dashboard) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {/* Preview do Mapa */}
            <div className="relative w-full aspect-[21/9] bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
              {staticMapUrl ? (
                <img src={staticMapUrl} className="w-full h-full object-cover opacity-80" alt="Mapa" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">Carregando mapa...</div>
              )}
              {/* Legenda sobre o Mapa */}
              <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur">
                 Postes: Verde (Início), Vermelho (Fim), Azul (Intermediários)
              </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-cyan-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <MapPin className="text-cyan-400 w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-white font-mono tracking-tight">{formatDist(stats.totalDistance)}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Extensão Total</span>
              </div>
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-purple-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <Hash className="text-purple-400 w-6 h-6" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tracking-tight">{stats.totalSpans}</span>
                  <span className="text-sm text-purple-400">vãos (AG)</span>
                </div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Total de Vãos</span>
              </div>
            </div>

            {/* Lista Histórico */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                   <Calendar size={14} /> Resumo Diário
                </h3>
              </div>
              
              {Object.entries(stats.groups).map(([date, groupData]) => (
                <div key={date} className="bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-4 pl-5">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-sm font-bold text-white mb-0.5">{date}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock size={10} /> 
                                {groupData.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                {groupData.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-cyan-400 font-mono">{formatDist(groupData.distance)}</div>
                            <div className="text-[10px] text-slate-500">
                              {groupData.points.length} pontos
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-none p-4 bg-slate-900 border-t border-white/10">
            <Button 
              onClick={generateAndOpenPDF}
              disabled={isDownloading || !staticMapUrl}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              {isDownloading ? (
                "Gerando PDF..."
              ) : (
                <div className="flex items-center gap-2"><Download size={18} /> Baixar Relatório PDF</div>
              )}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;