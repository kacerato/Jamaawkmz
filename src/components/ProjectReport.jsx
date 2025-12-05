import React, { useMemo, useState } from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity, Clock, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Token Mapbox (Necessário para a foto estática)
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  const [loadingMap, setLoadingMap] = useState(false);

  if (!project) return null;

  // --- 1. Funções de Cálculo e Formatação ---
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
    const sortedPoints = [...project.points].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    sortedPoints.forEach(point => {
      const date = new Date(point.timestamp || point.created_at).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = [];
      groups[date].push(point);
    });
    return groups;
  }, [project.points]);

  // --- 2. Geração da Imagem do Mapa ---
  const getMapImage = () => {
    return new Promise((resolve, reject) => {
      if (project.points.length === 0) resolve(null);

      // Calcula Limites (Bounding Box)
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      project.points.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });

      // API Estática do Mapbox (Satélite + Ruas)
      // Ajusta para cobrir a área correta
      const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${minLng},${minLat},${maxLng},${maxLat}]/800x400?padding=50&access_token=${MAPBOX_TOKEN}`;

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (e) => {
        console.error("Erro ao carregar mapa", e);
        resolve(null);
      };
    });
  };

  // --- 3. Geração do PDF Visual e Profissional ---
  const generatePDF = async () => {
    setLoadingMap(true);
    const doc = new jsPDF();
    const mapImage = await getMapImage();
    setLoadingMap(false);

    // --- CABEÇALHO COM DESIGN ---
    // Barra lateral decorativa
    doc.setFillColor(6, 182, 212); // Cyan Brand
    doc.rect(0, 0, 8, 297, 'F');

    // Título Grande
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text("RELATÓRIO TÉCNICO", 20, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`ID PROJETO: ${project.id.slice(0, 8).toUpperCase()}`, 20, 32);
    doc.text(`DATA EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, 20, 37);

    let currentY = 50;

    // --- IMAGEM DO MAPA (Destaque Visual) ---
    if (mapImage) {
      // Sombra simulada (retângulo cinza atrás)
      doc.setFillColor(241, 245, 249);
      doc.rect(22, currentY + 2, 170, 70, 'F');
      
      // Imagem
      doc.addImage(mapImage, 'JPEG', 20, currentY, 170, 70);
      
      // Borda fina
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.5);
      doc.rect(20, currentY, 170, 70);
      
      currentY += 80;
    }

    // --- CARDS DE RESUMO (Desenhados) ---
    const drawCard = (x, y, label, value, color = [6, 182, 212]) => {
      doc.setFillColor(248, 250, 252); // Bg claro
      doc.setDrawColor(226, 232, 240); // Borda
      doc.roundedRect(x, y, 50, 20, 2, 2, 'FD');
      
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(label, x + 5, y + 6);
      
      doc.setFontSize(12);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + 5, y + 15);
    };

    drawCard(20, currentY, "NOME DO PROJETO", project.name.substring(0, 15), [30, 41, 59]);
    drawCard(75, currentY, "DISTÂNCIA TOTAL", formatSmartDistance(project.total_distance), [16, 185, 129]);
    drawCard(130, currentY, "TOTAL PONTOS", `${project.points.length}`, [245, 158, 11]);

    currentY += 30;

    // --- TABELAS DETALHADAS POR DIA ---
    Object.entries(groupedPoints).forEach(([date, points]) => {
      const dailyDist = calculateGroupDistance(points);

      // Verifica quebra de página
      if (currentY > 240) {
        doc.addPage();
        doc.setFillColor(6, 182, 212);
        doc.rect(0, 0, 8, 297, 'F'); // Barra lateral na nova página
        currentY = 20;
      }

      // Cabeçalho da Seção (Dia)
      doc.setFillColor(241, 245, 249);
      doc.rect(20, currentY, 170, 10, 'F');
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text(date.toUpperCase(), 25, currentY + 7);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Produção: ${formatSmartDistance(dailyDist)}`, 185, currentY + 7, { align: "right" });

      currentY += 12;

      // Tabela
      const tableBody = points.map((p, index) => [
        points.length - index,
        new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
        `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
        p.user_email || currentUserEmail || 'N/A'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'HORA', 'COORDENADAS', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'striped', // Tema mais limpo para impressão
        headStyles: { 
          fillColor: [51, 65, 85], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 25 },
          2: { cellWidth: 60 },
          3: { cellWidth: 'auto' }
        },
        margin: { left: 20, right: 20 }
      });

      currentY = doc.lastAutoTable.finalY + 15;
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Jamaaw App - Pág ${i}/${pageCount}`, 105, 290, {align: 'center'});
    }

    // Salvar
    const safeName = `Relatorio_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    if (Capacitor.getPlatform() === 'web') {
      doc.save(safeName);
    } else {
      const base64 = doc.output('datauristring').split(',')[1];
      Filesystem.writeFile({
        path: safeName,
        data: base64,
        directory: Directory.Documents,
      }).then(() => alert('PDF salvo em Documentos!'))
        .catch(e => alert('Erro ao salvar PDF: ' + e.message));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-auto p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          <div className="p-6 border-b border-slate-800 bg-slate-900">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-cyan-400" /> Relatório
              </h2>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-slate-800 text-slate-400">
                <X size={20} />
              </Button>
            </div>
            <p className="text-sm text-slate-400">Gere um documento PDF profissional com mapa e dados.</p>
          </div>

          <div className="p-6 bg-slate-950 flex flex-col gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Visual do Mapa</h3>
                  <p className="text-xs text-slate-500">Inclui foto de satélite da área</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Dados Diários</h3>
                  <p className="text-xs text-slate-500">Tabelas separadas por dia de trabalho</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={generatePDF} 
              disabled={loadingMap}
              className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl"
            >
              {loadingMap ? (
                <>Gerando Mapa...</>
              ) : (
                <><Download className="mr-2" size={18} /> Baixar PDF Profissional</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;