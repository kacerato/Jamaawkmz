import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, X, MapPin, Activity, Calendar, User, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getStaticMapUrl } from '../utils/MapboxStatic';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  const [staticMapUrl, setStaticMapUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- 1. PROCESSAMENTO DE DADOS ---
  const stats = useMemo(() => {
    if (!project || !project.points) return null;

    const groups = {};
    const userResponsibility = {};
    let calculatedTotal = 0;

    project.points.forEach((p, idx) => {
      const date = new Date(p.timestamp || p.created_at).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = { points: [], distance: 0 };
      
      groups[date].points.push(p);

      if (idx > 0) {
        const prev = project.points[idx - 1];
        const dist = calcDist(prev, p);
        groups[date].distance += dist;
        calculatedTotal += dist;
      }

      const user = p.user_email || currentUserEmail || 'Desconhecido';
      if (!userResponsibility[user]) userResponsibility[user] = 0;
      userResponsibility[user]++;
    });

    return {
      groups,
      userResponsibility,
      totalDistance: project.total_distance || calculatedTotal,
      totalPoints: project.points.length
    };
  }, [project]);

  useEffect(() => {
    if (isOpen && project?.points?.length > 0) {
      // Gera URL otimizada
      const url = getStaticMapUrl(project.points, 800, 400); 
      setStaticMapUrl(url);
    }
  }, [isOpen, project]);

  if (!project || !stats) return null;

  function calcDist(p1, p2) {
    const R = 6371e3; 
    const φ1 = p1.lat * Math.PI/180;
    const φ2 = p2.lat * Math.PI/180;
    const Δφ = (p2.lat-p1.lat) * Math.PI/180;
    const Δλ = (p2.lng-p1.lng) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2) * Math.sin(Δλ/2)*Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const formatDist = (m) => m < 1000 ? `${m.toFixed(1)}m` : `${(m/1000).toFixed(3)}km`;

  // --- GERAÇÃO DO PDF CORRIGIDA ---
  const generatePDF = async () => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // TRUQUE DE MESTRE: Sobrescreve a função addPage para pintar o fundo AUTOMATICAMENTE
      // toda vez que uma nova página for criada pela tabela.
      const originalAddPage = doc.addPage;
      doc.addPage = function() {
        const ret = originalAddPage.call(this);
        this.setFillColor(15, 23, 42); // Slate 900
        this.rect(0, 0, width, height, 'F'); // Pinta o fundo ANTES do conteúdo
        return ret;
      };

      // Pinta a primeira página manualmente (pois ela já existe)
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, width, height, 'F');

      let y = 15;

      // Header
      doc.setTextColor(34, 211, 238); // Cyan
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO TÉCNICO", 15, y);
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Gerado em ${new Date().toLocaleString()}`, 15, y + 6);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("JAMAAW GEO", width - 15, y, { align: 'right' });

      y += 15;

      // Imagem
      if (staticMapUrl) {
        try {
          const response = await fetch(staticMapUrl);
          const blob = await response.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          
          doc.addImage(base64, 'PNG', 15, y, 180, 90);
          doc.setDrawColor(34, 211, 238);
          doc.setLineWidth(0.5);
          doc.rect(15, y, 180, 90);
          y += 95;
        } catch (e) {
          console.error("Erro imagem:", e);
          doc.setTextColor(239, 68, 68);
          doc.setFontSize(9);
          doc.text("[Imagem indisponível]", 15, y + 10);
          y += 20;
        }
      }

      // Card Resumo
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(15, y, 180, 30, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(project.name.toUpperCase(), 20, y + 10);
      
      doc.setFontSize(10);
      doc.setTextColor(34, 211, 238);
      doc.text(`DISTÂNCIA: ${formatDist(stats.totalDistance)}`, 20, y + 20);
      doc.text(`PONTOS: ${stats.totalPoints}`, 100, y + 20);
      
      y += 40;

      // Tabela de Equipe
      const teamData = Object.entries(stats.userResponsibility).map(([email, count]) => [email, count]);
      
      autoTable(doc, {
        startY: y,
        head: [['RESPONSÁVEL', 'QTD. PONTOS']],
        body: teamData,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        margin: { left: 15, right: 15 }
      });
      
      y = doc.lastAutoTable.finalY + 15;

      // Tabela Detalhada
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("DETALHAMENTO DIÁRIO", 15, y);
      y += 5;

      const detailData = [];
      Object.entries(stats.groups).forEach(([date, data]) => {
        detailData.push([
          { content: date, colSpan: 4, styles: { fillColor: [51, 65, 85], fontStyle: 'bold', textColor: [34, 211, 238] } }
        ]);
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
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
        margin: { left: 15, right: 15 },
        // IMPORTANTE: Não usamos mais didDrawPage para pintar fundo
        // Usamos o override do addPage lá em cima
      });

      // Rodapé (Itera sobre páginas no final)
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${pageCount}`, width - 20, height - 10, { align: 'right' });
      }

      const safeName = `Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`;
      
      if (Capacitor.getPlatform() === 'web') {
        doc.save(safeName);
      } else {
        const base64Out = doc.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: safeName,
          data: base64Out,
          directory: Directory.Documents
        });
        alert(`Salvo: ${safeName}`);
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
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-[85vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
          
          {/* Header */}
          <div className="flex-none p-5 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400 w-5 h-5" /> Relatório
                </h2>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 rounded">{project.name}</span>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full text-slate-400 hover:bg-white/10">
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-white/10 shadow-lg group">
              {staticMapUrl ? (
                <img src={staticMapUrl} className="w-full h-full object-cover" alt="Mapa" />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                   <Loader2 className="animate-spin" /> Gerando mapa...
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 text-center">
                  <span className="text-lg font-bold text-white font-mono">{formatDist(stats.totalDistance)}</span>
                  <span className="block text-[10px] text-slate-500 uppercase">Distância</span>
               </div>
               <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 text-center">
                  <span className="text-lg font-bold text-white font-mono">{stats.totalPoints}</span>
                  <span className="block text-[10px] text-slate-500 uppercase">Pontos</span>
               </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-none p-4 bg-slate-900 border-t border-white/10">
            <Button 
              onClick={generatePDF}
              disabled={isDownloading || !staticMapUrl}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl"
            >
              {isDownloading ? "Gerando..." : <><Download className="mr-2" size={18} /> Baixar PDF</>}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;