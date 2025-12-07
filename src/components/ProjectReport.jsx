import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, X, MapPin, Activity, Calendar, User, ShieldAlert, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { FileOpener } from '@capacitor-community/file-opener';
import { getStaticMapUrl } from '../utils/MapboxStatic';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  const [staticMapUrl, setStaticMapUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- PROCESSAMENTO DE DADOS ---
  const stats = useMemo(() => {
    if (!project || !project.points) return null;

    const groups = {};
    const userResponsibility = {};
    let calculatedTotal = 0;

    project.points.forEach((p, idx) => {
      const dateObj = new Date(p.timestamp || p.created_at);
      const date = dateObj.toLocaleDateString('pt-BR');
      
      if (!groups[date]) {
        groups[date] = { 
          points: [], 
          distance: 0, 
          startTime: dateObj, 
          endTime: dateObj,
          users: new Set()
        };
      }
      
      const group = groups[date];
      group.points.push(p);
      
      if (dateObj < group.startTime) group.startTime = dateObj;
      if (dateObj > group.endTime) group.endTime = dateObj;

      if (idx > 0) {
        const prev = project.points[idx - 1];
        const dist = calcDist(prev, p);
        group.distance += dist;
        calculatedTotal += dist;
      }

      const user = p.user_email || currentUserEmail || 'Desconhecido';
      group.users.add(user.split('@')[0]);
      if (!userResponsibility[user]) userResponsibility[user] = 0;
      userResponsibility[user]++;
    });

    return {
      groups,
      userResponsibility,
      totalDistance: project.total_distance || calculatedTotal,
      totalPoints: project.points.length,
      lastUpdate: new Date(project.updated_at || Date.now()).toLocaleString('pt-BR')
    };
  }, [project]);

  useEffect(() => {
    if (isOpen && project?.points?.length > 0) {
      const url = getStaticMapUrl(project.points, 800, 400); 
      setStaticMapUrl(url);
    }
  }, [isOpen, project]);

  if (!project || !stats) return null;

  function calcDist(p1, p2) {
    const R = 6371e3; 
    const φ1 = p1.lat * Math.PI/180;
    const φ2 = p2.lat * Math.PI/180;
    const a = Math.sin((p2.lat-p1.lat) * Math.PI/180/2)**2 + Math.cos(φ1)*Math.cos(φ2) * Math.sin((p2.lng-p1.lng) * Math.PI/180/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const formatDist = (m) => m < 1000 ? `${m.toFixed(1)}m` : `${(m/1000).toFixed(3)}km`;

  const generateAndOpenPDF = async () => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // --- HACK PARA FUNDO DARK EM TODAS AS PÁGINAS ---
      const paintBg = (data) => {
        // Pinta o fundo apenas se for uma nova página (a primeira pintamos manualmente)
        if (data.pageNumber > 1 && data.settings.margin.top === 15) { 
            // O jspdf-autotable não facilita pintar antes, então usamos hooks
        }
      };

      // Sobrescreve addPage para garantir o fundo
      const originalAddPage = doc.addPage;
      doc.addPage = function() {
        const ret = originalAddPage.call(this);
        this.setFillColor(15, 23, 42); 
        this.rect(0, 0, width, height, 'F');
        return ret;
      };

      // 1. Pinta Página 1
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, width, height, 'F');

      let y = 15;

      // Header
      doc.setTextColor(34, 211, 238); 
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO TÉCNICO", 15, y);
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); 
      doc.text(`Gerado em ${new Date().toLocaleString()}`, 15, y + 6);
      doc.text("JAMAAW GEO SYSTEM", width - 15, y, { align: 'right' });

      y += 15;

      // Imagem
      if (staticMapUrl) {
        try {
          const response = await fetch(staticMapUrl);
          const blob = await response.blob();
          const base64 = await new Promise((r) => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(blob); });
          
          doc.addImage(base64, 'JPEG', 15, y, 180, 90);
          doc.setDrawColor(34, 211, 238);
          doc.setLineWidth(0.5);
          doc.rect(15, y, 180, 90);
          y += 95;
        } catch (e) {
          y += 20;
        }
      }

      // Card Resumo
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(15, y, 180, 25, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(project.name.toUpperCase(), 20, y + 10);
      
      doc.setFontSize(10);
      doc.setTextColor(34, 211, 238);
      doc.text(`TOTAL: ${formatDist(stats.totalDistance)}`, 20, y + 18);
      doc.text(`PONTOS: ${stats.totalPoints}`, 80, y + 18);
      doc.text(`BAIRRO: ${project.bairro || 'N/A'}`, 140, y + 18);
      
      y += 35;

      // TABELA DE RESPONSABILIDADE
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("EQUIPE", 15, y);
      y += 5;

      const teamData = Object.entries(stats.userResponsibility).map(([email, count]) => [email, count]);
      
      autoTable(doc, {
        startY: y,
        head: [['RESPONSÁVEL', 'QTD. PONTOS']],
        body: teamData,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0], fontStyle: 'bold' },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        margin: { left: 15, right: 15 }
      });
      
      y = doc.lastAutoTable.finalY + 15;

      // --- TABELA DETALHADA ---
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("DETALHAMENTO DIÁRIO", 15, y);
      y += 5;

      const detailData = [];
      Object.entries(stats.groups).forEach(([date, data]) => {
        // Cabeçalho do Dia (Como linha da tabela para não quebrar layout)
        detailData.push([
          { content: `${date} - ${formatDist(data.distance)}`, colSpan: 4, styles: { fillColor: [51, 65, 85], fontStyle: 'bold', textColor: [34, 211, 238], halign: 'left' } }
        ]);
        
        // Pontos do dia
        data.points.forEach((p, i) => {
          detailData.push([
            i + 1,
            new Date(p.timestamp || p.created_at).toLocaleTimeString(),
            `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
            p.user_email?.split('@')[0] || '---'
          ]);
        });
      });

      autoTable(doc, {
        startY: y,
        head: [['#', 'HORA', 'COORDENADAS', 'USER']],
        body: detailData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [34, 211, 238], lineColor: [34, 211, 238] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [39, 51, 71] }, // Contraste nas linhas
        margin: { left: 15, right: 15 },
        // Força a cor do texto para garantir visibilidade
        styles: { textColor: [255, 255, 255] }
      });

      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${pageCount}`, width - 20, height - 10, { align: 'right' });
      }

      // Salvar e Abrir
      const safeName = `Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`;
      
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
            alert(`Salvo. Erro ao abrir: ${openerError.message}`);
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

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            <div className="relative w-full aspect-[21/9] bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
              {staticMapUrl ? (
                <img src={staticMapUrl} className="w-full h-full object-cover opacity-80" alt="Mapa" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">Carregando mapa...</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-cyan-500/20 backdrop-blur-md">
                <MapPin className="text-cyan-400 mb-2 w-6 h-6" />
                <span className="text-2xl font-bold text-white font-mono tracking-tight">{formatDist(stats.totalDistance)}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Extensão Total</span>
              </div>
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 rounded-2xl border border-purple-500/20 backdrop-blur-md">
                <Activity className="text-purple-400 mb-2 w-6 h-6" />
                <span className="text-2xl font-bold text-white font-mono tracking-tight">{stats.totalPoints}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Pontos Totais</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                   <Calendar size={14} /> Histórico de Execução
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
                            <div className="text-[10px] text-slate-500">{groupData.points.length} pontos</div>
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
                <div className="flex items-center gap-2"><Download size={18} /> Baixar e Abrir PDF</div>
              )}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;