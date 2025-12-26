// src/components/ProjectReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, X, MapPin, Activity, Calendar, User, Clock, Hash, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { FileOpener } from '@capacitor-community/file-opener';
import { getStaticMapUrl } from '../utils/MapboxStatic';
import { calculateTotalProjectDistance } from '../utils/geoUtils';

// --- FUNÇÃO AUXILIAR ---
function calcDist(p1, p2) {
  if (!p1 || !p2) return 0;
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = p1.lat * Math.PI / 180;
  const φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
  const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const ProjectReport = ({ isOpen, onClose, project, mapImage, currentUserEmail }) => {
  const [staticMapUrl, setStaticMapUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // 1. MAPA DE ÍNDICES GLOBAIS (todos os postes numerados sequencialmente)
  const globalPointIndexMap = useMemo(() => {
    if (!project?.points) return {};
    const map = {};
    project.points.forEach((point, index) => {
      map[point.id] = index + 1; // Poste 1, 2, 3...
    });
    return map;
  }, [project]);

  // 2. DADOS ESTATÍSTICOS com índices globais
  const stats = useMemo(() => {
    if (!project || !project.points) return null;

    const groups = {};
    const userResponsibility = {};
    let totalSpans = 0;
    let maxSpansPerSegment = 0;

    // Distância total global
    const calculatedTotalDistance = calculateTotalProjectDistance(
      project.points || [], 
      project.extra_connections || []
    );

    // Processa os pontos
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
      
      // Horários
      if (dateObj < group.startTime) group.startTime = dateObj;
      if (dateObj > group.endTime) group.endTime = dateObj;

      // Cálculo de distância do segmento
      let previousPoint = null;
      if (p.connectedFrom) {
        previousPoint = project.points.find(pt => pt.id === p.connectedFrom);
      } else if (idx > 0) {
        previousPoint = project.points[idx - 1];
      }

      const spans = (p.spans !== undefined && p.spans !== null && !isNaN(p.spans)) ? 
                   Math.max(1, Number(p.spans)) : 1;

      if (previousPoint) {
        const segmentMeters = calcDist(previousPoint, p);
        const totalSegmentMeters = segmentMeters * spans;
        group.distance += totalSegmentMeters;
      }

      group.spans += spans;
      totalSpans += spans;
      
      if (spans > maxSpansPerSegment) maxSpansPerSegment = spans;

      // Responsabilidade
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
      lastUpdate: new Date(project.updated_at || Date.now()).toLocaleString('pt-BR'),
      hasBranches: project.points.some(p => p.connectedFrom),
      hasExtraConnections: project.extra_connections && project.extra_connections.length > 0
    };
  }, [project, currentUserEmail]);

  // 3. GERAÇÃO DA IMAGEM DO MAPA COM LABELS
  useEffect(() => {
    if (isOpen && project?.points?.length > 0) {
      // Prepara pontos com labels para o mapa estático
      const pointsWithLabels = project.points.map(point => ({
        ...point,
        // Adiciona o número global como label (1, 2, 3...)
        label: globalPointIndexMap[point.id]?.toString() || ''
      }));
      
      const url = getStaticMapUrl(pointsWithLabels, 800, 400);
      setStaticMapUrl(url);
    }
  }, [isOpen, project, globalPointIndexMap]);

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

      // Imagem do mapa
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

      if (stats.hasBranches || stats.hasExtraConnections) {
        doc.setFillColor(51, 65, 85);
        doc.roundedRect(15, y, 180, 15, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        
        let structureText = "ESTRUTURA: ";
        if (stats.hasBranches) structureText += "Com Ramificações ";
        if (stats.hasExtraConnections) structureText += "Com Conexões Extras ";
        
        doc.text(structureText, 20, y + 10);
        y += 25;
      }

      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("EQUIPE TÉCNICA", 15, y);
      y += 5;

      const teamData = Object.entries(stats.userResponsibility).map(([email, count]) => [
        email, 
        count,
        `${((count / stats.totalPoints) * 100).toFixed(1)}%`
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['RESPONSÁVEL', 'PONTOS', '%']],
        body: teamData,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0], fontStyle: 'bold' },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        margin: { left: 15, right: 15 }
      });
      
      y = doc.lastAutoTable.finalY + 15;

      // 4. TABELA DETALHAMENTO DIÁRIO (com número global)
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("DETALHAMENTO DIÁRIO", 15, y);
      y += 5;

      const detailData = [];
      Object.entries(stats.groups).forEach(([date, groupData]) => {
        // Cabeçalho do Dia
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
        
        // Agora usa o número global do poste
        groupData.points.forEach((p) => {
          const spans = (p.spans !== undefined && p.spans !== null && !isNaN(p.spans)) ? 
                       Math.max(1, Number(p.spans)) : 1;
          
          // Número global do poste (1, 2, 3...)
          const globalPostNumber = globalPointIndexMap[p.id];
          
          detailData.push([
            globalPostNumber, // Usa o número global aqui
            new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
            `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
            `${p.user_email?.split('@')[0] || '---'} (${spans} vão${spans > 1 ? 's' : ''})`
          ]);
        });
      });

      autoTable(doc, {
        startY: y,
        head: [['POSTE', 'HORA', 'COORDENADAS', 'TÉCNICO (VÃOS)']], // Alterado de '#' para 'POSTE'
        body: detailData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [34, 211, 238], lineColor: [34, 211, 238] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [39, 51, 71] },
        margin: { left: 15, right: 15 },
        styles: { textColor: [255, 255, 255] }
      });

      // 5. NOVA PÁGINA - ANÁLISE DE VÃOS POR SEGMENTO
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
          
          // Lógica de conexão
          if (current.connectedFrom) {
            previous = project.points.find(p => p.id === current.connectedFrom);
          } else {
            previous = project.points[i - 1];
          }

          if (previous) {
            const spans = (current.spans !== undefined && current.spans !== null && !isNaN(current.spans)) ? 
                        Math.max(1, Number(current.spans)) : 1;
            
            segmentCount++;
            
            // Calcula distâncias
            const segmentDist = calcDist(previous, current);
            const totalDist = segmentDist * spans;
            
            // Obtém números globais dos postes
            const startPostNumber = globalPointIndexMap[previous.id];
            const endPostNumber = globalPointIndexMap[current.id];
            
            // Formata a linha com números de postes
            spanAnalysisData.push([
              segmentCount,
              `Poste ${startPostNumber} - Poste ${endPostNumber}`, // TRECHO formatado
              formatDist(segmentDist),
              `${spans} AG`, // Vãos formatados
              formatDist(totalDist)
            ]);
          }
        }
      }
      
      // Tabela com nova estrutura
      autoTable(doc, {
        startY: y,
        head: [['SEG', 'TRECHO', 'DIST BASE', 'VÃOS', 'DIST TOTAL']], // Cabeçalhos atualizados
        body: spanAnalysisData,
        theme: 'grid',
        headStyles: { fillColor: [168, 85, 247], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        margin: { left: 15, right: 15 },
        columnStyles: {
          0: { cellWidth: 15 }, // SEG
          1: { cellWidth: 60 }, // TRECHO (maior largura)
          2: { cellWidth: 35 }, // DIST BASE
          3: { cellWidth: 25 }, // VÃOS
          4: { cellWidth: 35 }  // DIST TOTAL
        }
      });
      
      y = doc.lastAutoTable.finalY + 15;
      
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(15, y, 180, 40, 3, 3, 'F');
      
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("RESUMO DE VÃOS", 20, y + 10);
      
      doc.setFontSize(9);
      doc.setTextColor(168, 85, 247);
      doc.text(`Total de Vãos: ${stats.totalSpans}`, 20, y + 18);
      doc.text(`Máximo por Segmento: ${stats.maxSpansPerSegment} vãos`, 20, y + 25);
      doc.text(`Segmentos: ${segmentCount}`, 100, y + 18);
      doc.text(`Média por Segmento: ${(stats.totalSpans / (segmentCount || 1)).toFixed(1)} vãos`, 100, y + 25);
      
      y += 50;

      doc.setFontSize(11);
      doc.setTextColor(34, 211, 238);
      doc.text("INFORMAÇÕES TÉCNICAS", 15, y);
      
      y += 5;
      
      const techInfo = [
        [`ID do Projeto:`, project.id],
        [`Criado por:`, project.user_email || currentUserEmail || 'Desconhecido'],
        [`Data de Criação:`, new Date(project.created_at).toLocaleString('pt-BR')],
        [`Última Atualização:`, new Date(project.updated_at || project.created_at).toLocaleString('pt-BR')],
        [`Precisão Média:`, project.avg_accuracy ? `${project.avg_accuracy.toFixed(1)}m` : 'N/A'],
        [`Modo de Captura:`, project.tracking_mode || 'manual']
      ];
      
      autoTable(doc, {
        startY: y,
        body: techInfo,
        theme: 'plain',
        bodyStyles: { 
          fillColor: [30, 41, 59], 
          textColor: [255, 255, 255], 
          lineColor: [51, 65, 85],
          cellPadding: { top: 4, right: 4, bottom: 4, left: 4 }
        },
        columnStyles: {
          0: { textColor: [148, 163, 184], fontStyle: 'bold' },
          1: { textColor: [255, 255, 255] }
        },
        margin: { left: 15, right: 15 }
      });

      // Rodapé
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
                  {stats.hasBranches && (
                    <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded uppercase">
                      Com Ramificações
                    </span>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400 -mr-2">
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* Conteúdo Visual */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {/* Preview do Mapa */}
            <div className="relative w-full aspect-[21/9] bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
              {staticMapUrl ? (
                <img src={staticMapUrl} className="w-full h-full object-cover opacity-80" alt="Mapa" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">Carregando mapa...</div>
              )}
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-cyan-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <MapPin className="text-cyan-400 w-6 h-6" />
                  <span className="text-[10px] text-cyan-400/70 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full">
                    COM VÃOS
                  </span>
                </div>
                <span className="text-2xl font-bold text-white font-mono tracking-tight">{formatDist(stats.totalDistance)}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Extensão Total</span>
              </div>
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-purple-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <Hash className="text-purple-400 w-6 h-6" />
                  <span className="text-[10px] text-purple-400/70 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full">
                    SEGMENTOS
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tracking-tight">{stats.totalSpans}</span>
                  <span className="text-sm text-purple-400">vãos</span>
                </div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Total de Vãos</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-blue-500/20 backdrop-blur-md">
                <Activity className="text-blue-400 mb-2 w-6 h-6" />
                <span className="text-2xl font-bold text-white font-mono tracking-tight">{stats.totalPoints}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Pontos Totais</span>
              </div>
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-green-500/20 backdrop-blur-md">
                <Layers className="text-green-400 mb-2 w-6 h-6" />
                <span className="text-2xl font-bold text-white font-mono tracking-tight">{stats.maxSpansPerSegment}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Máx por Segmento</span>
              </div>
            </div>

            {/* Lista Histórico */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                   <Calendar size={14} /> Histórico de Execução
                </h3>
                <span className="text-[10px] text-slate-500">
                  {Object.keys(stats.groups).length} dias
                </span>
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
                            <div className="text-[10px] text-slate-500 flex gap-2">
                              <span>{groupData.points.length} pontos</span>
                              <span className="text-purple-400">• {groupData.spans} vãos</span>
                            </div>
                        </div>
                    </div>
                    {/* Barra de Progresso */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                        <div 
                            className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                            style={{ width: `${Math.max(5, (groupData.distance / (stats.totalDistance || 1)) * 100)}%` }}
                        ></div>
                    </div>
                    {/* Lista de Responsáveis */}
                    <div className="flex flex-wrap gap-2">
                        {Array.from(groupData.users).map(user => (
                            <div key={user} className="flex items-center gap-1.5 bg-slate-950 border border-white/5 rounded-full px-2.5 py-1">
                                <User size={10} className="text-purple-400" />
                                <span className="text-[10px] text-slate-300 font-medium">{user}</span>
                            </div>
                        ))}
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
                <div className="flex items-center gap-2"><Download size={18} /> Baixar e Abrir PDF</div>
              )}
            </Button>
            <p className="text-[10px] text-slate-500 text-center mt-2">
              PDF inclui análise detalhada de vãos e segmentos
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;