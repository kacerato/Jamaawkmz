import React, { useMemo, useState } from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity, Clock, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Token público padrão (ou use o seu próprio)
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  const [loadingPdf, setLoadingPdf] = useState(false);

  if (!project) return null;

  // --- FUNÇÕES AUXILIARES ---
  
  const getDistance = (p1, p2) => {
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const calculateGroupDistance = (points) => {
    if (points.length < 2) return 0;
    let total = 0;
    const chronoPoints = [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < chronoPoints.length - 1; i++) {
      total += getDistance(chronoPoints[i], chronoPoints[i+1]);
    }
    return total;
  };

  const formatSmartDistance = (meters) => {
    if (!meters || isNaN(meters)) return "0 m";
    if (meters < 1000) return `${meters.toFixed(2)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };

  const groupedPoints = useMemo(() => {
    const groups = {};
    const sortedPoints = [...project.points].sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));
    
    sortedPoints.forEach(point => {
      const date = new Date(point.timestamp || point.created_at).toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(point);
    });
    return groups;
  }, [project.points]);

  // --- GERADOR DE IMAGEM DO MAPA ---
  const getMapSnapshot = () => {
    return new Promise((resolve) => {
      if (project.points.length === 0) resolve(null);

      // 1. Calcula Bounding Box (Área do projeto)
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      project.points.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });

      // 2. Monta URL da API Estática do Mapbox
      // Usa estilo "satellite-streets" para ficar profissional
      // Adiciona padding=50 para os pontos não ficarem colados na borda
      const width = 800;
      const height = 400;
      const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${minLng},${minLat},${maxLng},${maxLat}]/${width}x${height}?padding=50&access_token=${MAPBOX_TOKEN}`;

      // 3. Converte para Base64 (Necessário para o PDF)
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(null); // Se falhar, segue sem mapa
    });
  };

  // --- GERADOR DE PDF ---
  const generatePDF = async () => {
    setLoadingPdf(true);
    const doc = new jsPDF();
    const mapImage = await getMapSnapshot();
    
    // --- LAYOUT DO PDF ---
    
    // 1. Cabeçalho com Design Moderno
    doc.setFillColor(15, 23, 42); // Slate 900 (Topo escuro)
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(6, 182, 212); // Cyan
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO TÉCNICO", 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Gerado via Jamaaw App", 15, 28);
    
    // Data no canto direito
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, 195, 20, { align: 'right' });

    let currentY = 50;

    // 2. Imagem do Mapa (Se carregou)
    if (mapImage) {
      // Sombra simulada
      doc.setFillColor(240, 240, 240);
      doc.rect(16, currentY + 1, 178, 80, 'F');
      
      // Imagem
      doc.addImage(mapImage, 'JPEG', 15, currentY, 180, 80);
      
      // Borda fina
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.5);
      doc.rect(15, currentY, 180, 80);
      
      // Legenda do Mapa
      doc.setFillColor(15, 23, 42);
      doc.rect(15, currentY + 74, 180, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text("VISTA AÉREA DA ÁREA DE OPERAÇÃO", 105, currentY + 78, { align: 'center' });

      currentY += 90;
    }

    // 3. Card de Resumo (Estilo Dashboard)
    // Fundo do card
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.roundedRect(15, currentY, 180, 25, 2, 2, 'FD');

    // Dados do Card
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("PROJETO", 20, currentY + 8);
    doc.text("EXTENSÃO TOTAL", 100, currentY + 8);
    doc.text("TOTAL PONTOS", 160, currentY + 8);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(project.name.substring(0, 35).toUpperCase(), 20, currentY + 18);
    
    doc.setTextColor(16, 185, 129); // Verde
    doc.text(formatSmartDistance(project.total_distance), 100, currentY + 18);
    
    doc.setTextColor(6, 182, 212); // Cyan
    doc.text(String(project.points.length), 160, currentY + 18);

    currentY += 35;

    // 4. Tabelas por Dia
    Object.entries(groupedPoints).forEach(([date, points]) => {
      const dailyDist = calculateGroupDistance(points);

      // Quebra de página inteligente
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Cabeçalho da Seção (Dia)
      doc.setFillColor(6, 182, 212); // Tarja Azul
      doc.rect(15, currentY, 2, 10, 'F');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(date.toUpperCase(), 20, currentY + 7);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Produção: ${formatSmartDistance(dailyDist)}`, 195, currentY + 7, { align: 'right' });

      currentY += 12;

      // Tabela de Dados
      const tableBody = points.map((p, index) => [
        points.length - index,
        new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
        `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
        p.user_email || currentUserEmail || 'N/A'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'HORA', 'COORDENADAS GPS', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'plain',
        headStyles: { 
          fillColor: [241, 245, 249], 
          textColor: [71, 85, 105], 
          fontStyle: 'bold',
          fontSize: 8,
          lineWidth: 0 // Sem borda no header
        },
        styles: { 
          fontSize: 8,
          textColor: [51, 65, 85],
          cellPadding: 3,
          lineWidth: { bottom: 0.1 }, // Linha fina apenas embaixo
          lineColor: [226, 232, 240]
        },
        columnStyles: {
          0: { cellWidth: 15, fontStyle: 'bold' },
          1: { cellWidth: 25 },
          2: { cellWidth: 60, font: 'courier' }, // Fonte mono para coords
          3: { cellWidth: 'auto' }
        },
        margin: { left: 15, right: 15 }
      });

      currentY = doc.lastAutoTable.finalY + 15;
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, {align: 'center'});
    }

    // Salvar (Compatível com Android/Capacitor)
    const safeName = `Relatorio_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    try {
      if (Capacitor.getPlatform() === 'web') {
        doc.save(safeName);
      } else {
        const base64 = doc.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: safeName,
          data: base64,
          directory: Directory.Documents,
        });
        alert('PDF salvo em Documentos!');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar PDF: ' + e.message);
    }
    
    setLoadingPdf(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-auto p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          
          {/* Header UI */}
          <div className="p-6 border-b border-slate-800 bg-slate-950">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-cyan-400" /> Relatório
              </h2>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-slate-800 text-slate-400">
                <X size={20} />
              </Button>
            </div>
            <p className="text-sm text-slate-400">
              Gere um documento oficial com mapa, dados e produção diária.
            </p>
          </div>

          {/* Conteúdo UI */}
          <div className="p-6 bg-slate-900 flex flex-col gap-4">
            
            {/* Preview Visual */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                <ImageIcon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Visual Aéreo</h3>
                <p className="text-xs text-slate-500 mt-0.5">O PDF incluirá uma foto de satélite atualizada da área.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total Pontos</p>
                <p className="text-xl font-bold text-white">{project.points.length}</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Extensão</p>
                <p className="text-xl font-bold text-green-400">{formatSmartDistance(project.total_distance)}</p>
              </div>
            </div>

            <Button 
              onClick={generatePDF} 
              disabled={loadingPdf}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 group mt-2"
            >
              {loadingPdf ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gerando Documento...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Download className="group-hover:animate-bounce" size={18} />
                  Baixar Relatório PDF
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;