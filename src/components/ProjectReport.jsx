import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, X, MapPin, Activity, Calendar, User, Clock, ShieldAlert } from 'lucide-react';
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

  // --- 1. PROCESSAMENTO DE DADOS (MEMOIZED) ---
  const stats = useMemo(() => {
    if (!project || !project.points) return null;

    const groups = {};
    const userResponsibility = {};
    let calculatedTotal = 0;

    // Agrupamento por Data e Usuário
    project.points.forEach((p, idx) => {
      const date = new Date(p.timestamp || p.created_at).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = { points: [], distance: 0 };
      
      groups[date].points.push(p);

      // Distância (Simplificada entre pontos sequenciais)
      if (idx > 0) {
        const prev = project.points[idx - 1];
        const dist = calcDist(prev, p);
        groups[date].distance += dist;
        calculatedTotal += dist;
      }

      // Responsabilidade
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

  // Efeito para gerar a URL do mapa assim que abrir
  useEffect(() => {
    if (isOpen && project?.points?.length > 0) {
      const url = getStaticMapUrl(project.points, 800, 400); // Alta Resolução
      setStaticMapUrl(url);
    }
  }, [isOpen, project]);

  if (!project || !stats) return null;

  // --- 2. FUNÇÕES AUXILIARES ---
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

  // --- 3. GERAÇÃO DO PDF (INSTANTÂNEA COM IMAGEM ESTÁTICA) ---
  const generatePDF = async () => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Fundo Dark Tech
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, pageWidth, 297, 'F');

      let y = 15;

      // Header
      doc.setTextColor(34, 211, 238); // Cyan
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO TÉCNICO", 15, y);
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Gerado em ${new Date().toLocaleString()}`, 15, y + 6);
      
      // Logo/Marca
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("JAMAAW GEO", pageWidth - 15, y, { align: 'right' });

      y += 15;

      // --- IMAGEM DE SATÉLITE (Baixar e converter) ---
      if (staticMapUrl) {
        try {
          // Fetch da imagem para transformar em Base64 (evita taint canvas)
          const imgBlob = await fetch(staticMapUrl).then(r => r.blob());
          const imgData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(imgBlob);
          });
          
          doc.addImage(imgData, 'PNG', 15, y, 180, 90);
          
          // Borda Neon na Imagem
          doc.setDrawColor(34, 211, 238);
          doc.setLineWidth(0.5);
          doc.rect(15, y, 180, 90);
          
          y += 95;
        } catch (e) {
          console.error("Erro imagem estática", e);
          doc.text("[Erro ao carregar imagem de satélite]", 15, y + 10);
          y += 20;
        }
      }

      // --- CARD DE RESUMO ---
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.roundedRect(15, y, 180, 30, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(project.name.toUpperCase(), 20, y + 10);
      
      doc.setFontSize(10);
      doc.setTextColor(34, 211, 238);
      doc.text(`DISTÂNCIA TOTAL: ${formatDist(stats.totalDistance)}`, 20, y + 20);
      doc.text(`PONTOS: ${stats.totalPoints}`, 100, y + 20);
      
      y += 40;

      // --- TABELA DE RESPONSABILIDADE ---
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("EQUIPE E RESPONSABILIDADE", 15, y);
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
        // Linha de subtotal
        detailData.push([
          { content: `Total do Dia: ${formatDist(data.distance)}`, colSpan: 4, styles: { halign: 'right', fontStyle: 'italic', textColor: [148, 163, 184] } }
        ]);
      });

      autoTable(doc, {
        startY: y,
        head: [['#', 'HORA', 'COORDENADAS', 'USER']],
        body: detailData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [34, 211, 238], lineColor: [34, 211, 238] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [226, 232, 240], lineColor: [51, 65, 85] },
        margin: { left: 15, right: 15 }
      });

      // Salvar
      const fileName = `Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`;
      if (Capacitor.getPlatform() === 'web') {
        doc.save(fileName);
      } else {
        const base64 = doc.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents
        });
        alert(`Salvo em Documentos: ${fileName}`);
      }

    } catch (e) {
      console.error(e);
      alert("Erro ao gerar PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-[85vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
          
          {/* 1. Header Visual */}
          <div className="flex-none p-5 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400 w-5 h-5" /> Relatório de Campo
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase">
                    {project.name}
                  </span>
                  {project.locked_by && (
                    <span className="text-[10px] flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">
                      <ShieldAlert size={10} /> TRAVADO
                    </span>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400 -mr-2">
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* 2. Scroll Area - O "App" Report */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {/* Mapa de Satélite Preview */}
            <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-white/10 shadow-lg group">
              {staticMapUrl ? (
                <>
                    <img src={staticMapUrl} alt="Satélite" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
                    <div className="absolute bottom-3 left-3 flex flex-col">
                        <span className="text-xs font-bold text-white shadow-black drop-shadow-md">Vista de Satélite</span>
                        <span className="text-[10px] text-cyan-400">Gerado via Mapbox Static API</span>
                    </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">Carregando satélite...</div>
              )}
            </div>

            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                <MapPin className="text-cyan-400 mb-1 w-5 h-5" />
                <span className="text-lg font-bold text-white font-mono">{formatDist(stats.totalDistance)}</span>
                <span className="text-[10px] text-slate-500 uppercase">Extensão Total</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                <Activity className="text-green-400 mb-1 w-5 h-5" />
                <span className="text-lg font-bold text-white font-mono">{stats.totalPoints}</span>
                <span className="text-[10px] text-slate-500 uppercase">Pontos Coletados</span>
              </div>
            </div>

            {/* Lista Detalhada por Dia (O que você pediu para ver no app) */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Histórico Diário</h3>
              
              {Object.entries(stats.groups).map(([date, groupData]) => (
                <div key={date} className="bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden">
                  <div className="bg-white/5 px-3 py-2 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs font-bold text-white">{date}</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-200">{formatDist(groupData.distance)}</span>
                  </div>
                  
                  <div className="p-3 grid grid-cols-2 gap-2">
                    <div className="col-span-2 text-[10px] text-slate-400 mb-1">Responsáveis:</div>
                    {/* Extrair usuários únicos deste dia */}
                    {[...new Set(groupData.points.map(p => p.user_email?.split('@')[0] || 'N/A'))].map(u => (
                         <div key={u} className="flex items-center gap-1.5 bg-slate-950 rounded px-2 py-1.5">
                            <User className="w-3 h-3 text-purple-400" />
                            <span className="text-xs text-slate-200">{u}</span>
                         </div>
                    ))}
                  </div>
                  <div className="px-3 pb-2">
                     <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full" style={{ width: `${(groupData.points.length / stats.totalPoints) * 100}%` }}></div>
                     </div>
                     <div className="flex justify-between mt-1 text-[9px] text-slate-500">
                        <span>{groupData.points.length} pontos</span>
                        <span>{((groupData.points.length / stats.totalPoints) * 100).toFixed(0)}% do total</span>
                     </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* 3. Footer de Ação */}
          <div className="flex-none p-4 bg-slate-900 border-t border-white/10">
            <Button 
              onClick={generatePDF}
              disabled={isDownloading || !staticMapUrl}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 group transition-all active:scale-95"
            >
              {isDownloading ? (
                "Gerando PDF..."
              ) : (
                <>
                  <Download className="mr-2 group-hover:animate-bounce" size={18} />
                  Baixar Relatório Oficial
                </>
              )}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;