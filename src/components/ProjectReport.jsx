import React, { useMemo, useState } from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity, Clock, Image as ImageIcon, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Seu Token Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  const [loadingPdf, setLoadingPdf] = useState(false);

  if (!project) return null;

  // --- FUNÇÕES AUXILIARES ---
  const formatSmartDistance = (meters) => {
    if (!meters || isNaN(meters)) return "0 m";
    if (meters < 1000) return `${meters.toFixed(2)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };

  const groupedPoints = useMemo(() => {
    const groups = {};
    const sortedPoints = [...project.points].sort((a, b) => 
      new Date(b.timestamp || b.created_at).getTime() - new Date(a.timestamp || a.created_at).getTime()
    );
    sortedPoints.forEach(point => {
      const date = new Date(point.timestamp || point.created_at).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = [];
      groups[date].push(point);
    });
    return groups;
  }, [project.points]);

  // --- GERADOR DE SNAPSHOT COM TRAÇADO (GEOJSON) ---
  const getMapSnapshot = () => {
    return new Promise((resolve) => {
      if (project.points.length === 0) { resolve(null); return; }

      // 1. Cria o GeoJSON do Traçado e Pontos
      // Simplifica coord para 5 casas decimais para economizar URL
      const coordinates = project.points.map(p => [
        parseFloat(p.lng.toFixed(5)), 
        parseFloat(p.lat.toFixed(5))
      ]);

      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              "stroke": "#06b6d4", // Ciano
              "stroke-width": 4,
              "stroke-opacity": 1
            },
            geometry: {
              type: "LineString",
              coordinates: coordinates
            }
          },
          // Adiciona marcadores (apenas início e fim se tiver muitos para não quebrar URL)
          ...coordinates.map((coord, i) => {
             // Se tiver mais de 50 pontos, mostra só inicio/fim e a cada 10
             if (coordinates.length > 50 && i !== 0 && i !== coordinates.length -1 && i % 10 !== 0) return null;
             return {
                type: "Feature",
                properties: {
                  "marker-color": "#facc15", // Amarelo
                  "marker-size": "small"
                },
                geometry: {
                  type: "Point",
                  coordinates: coord
                }
             };
          }).filter(Boolean)
        ]
      };

      // 2. Prepara URL (Encode do GeoJSON)
      const jsonString = encodeURIComponent(JSON.stringify(geojson));
      
      // Auto-framing (auto) ajusta o zoom para caber tudo
      const width = 800;
      const height = 500;
      // Estilo Satellite Streets
      const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${jsonString})/auto/${width}x${height}?padding=50&access_token=${MAPBOX_TOKEN}`;

      // 3. Baixa Imagem
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
      img.onerror = (e) => {
        console.warn("Erro mapa estático (provavelmente URL muito longa):", e);
        resolve(null); 
      };
    });
  };

  // --- GERADOR DE PDF ---
  const generatePDF = async () => {
    setLoadingPdf(true);
    const doc = new jsPDF();
    
    // CAPA (PÁGINA 1)
    
    // Fundo Capa
    doc.setFillColor(15, 23, 42); // Slate 950
    doc.rect(0, 0, 210, 297, 'F');

    // Elementos Gráficos
    doc.setDrawColor(6, 182, 212); // Cyan
    doc.setLineWidth(1);
    doc.line(20, 20, 190, 20); // Linha topo
    doc.line(20, 277, 190, 277); // Linha base

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("DOSSIÊ TÉCNICO", 105, 120, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(6, 182, 212);
    doc.text("REGISTRO DE RASTREAMENTO E GEOLOCALIZAÇÃO", 105, 130, { align: "center" });

    // Info Projeto Capa
    doc.setFontSize(12);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`PROJETO: ${project.name.toUpperCase()}`, 105, 160, { align: "center" });
    doc.text(`DATA DE EXTRAÇÃO: ${new Date().toLocaleDateString('pt-BR')}`, 105, 168, { align: "center" });
    doc.text(`RESPONSÁVEL: ${currentUserEmail?.split('@')[0].toUpperCase() || 'USUÁRIO'}`, 105, 176, { align: "center" });

    doc.setFontSize(10);
    doc.text("Gerado via Sistema Integrado Jamaaw App", 105, 270, { align: "center" });

    // PÁGINA 2 (MAPA E DADOS)
    doc.addPage();
    
    // Cabeçalho Interno
    doc.setFillColor(248, 250, 252); // Fundo claro para dados
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setFillColor(15, 23, 42); // Header escuro
    doc.rect(0, 0, 210, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MAPA DE SITUAÇÃO", 15, 20);

    let currentY = 40;

    // Inserir Mapa com Traçado
    const mapImage = await getMapSnapshot();
    if (mapImage) {
      doc.addImage(mapImage, 'JPEG', 15, currentY, 180, 90);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.rect(15, currentY, 180, 90);
      
      // Legenda do Mapa
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Visualização via Satélite - Traçado (Azul) e Pontos (Amarelo)", 15, currentY + 95);
      
      currentY += 105;
    } else {
      // Fallback se mapa falhar
      doc.setTextColor(150);
      doc.text("(Mapa indisponível ou área muito extensa)", 15, currentY + 10);
      currentY += 30;
    }

    // Dados Técnicos (Cards)
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("RESUMO EXECUTIVO", 15, currentY);
    currentY += 10;

    // Card 1
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(15, currentY, 55, 25, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("EXTENSÃO TOTAL", 20, currentY + 8);
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Verde
    doc.setFont("helvetica", "bold");
    doc.text(formatSmartDistance(project.total_distance), 20, currentY + 18);

    // Card 2
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(75, currentY, 55, 25, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("QUANTIDADE PONTOS", 80, currentY + 8);
    doc.setFontSize(12);
    doc.setTextColor(6, 182, 212); // Azul
    doc.text(String(project.points.length), 80, currentY + 18);

    // Card 3
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(135, currentY, 60, 25, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("MODO", 140, currentY + 8);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(project.tracking_mode === 'manual' ? 'MANUAL / GPS' : 'AUTO', 140, currentY + 18);

    currentY += 40;

    // TABELAS DETALHADAS
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("DETALHAMENTO DIÁRIO", 15, currentY);
    currentY += 10;

    Object.entries(groupedPoints).forEach(([date, points]) => {
      // Verifica espaço
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Subtítulo Data
      doc.setFillColor(15, 23, 42);
      doc.rect(15, currentY, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`DATA: ${date}`, 20, currentY + 5.5);

      currentY += 10;

      // Corpo da Tabela
      const tableBody = points.map((p, index) => [
        points.length - index,
        new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
        `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
        p.user_email || currentUserEmail || 'N/A'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['ITEM', 'HORA', 'COORDENADAS (LAT/LNG)', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
          fillColor: [255, 255, 255], 
          textColor: [15, 23, 42], 
          fontStyle: 'bold',
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        styles: { 
          fontSize: 8,
          textColor: [50, 50, 50],
          lineColor: [220, 220, 220],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 15, right: 15 }
      });

      currentY = doc.lastAutoTable.finalY + 15;
    });

    // Numeração de Páginas
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 200, 290, {align: 'right'});
    }

    // Salvar
    const safeName = `Dossie_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
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
        alert(`Sucesso! Arquivo salvo em Documentos:\n${safeName}`);
      }
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-lg h-auto p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          
          <div className="p-6 border-b border-slate-800 bg-slate-950">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-cyan-400" /> Relatório Premium
              </h2>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-slate-800 text-slate-400">
                <X size={20} />
              </Button>
            </div>
            <p className="text-sm text-slate-400">
              Gera um dossiê técnico com capa, mapa do traçado e dados.
            </p>
          </div>

          <div className="p-6 bg-slate-900 flex flex-col gap-4">
            
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                <MapIcon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Snapshot do Mapa</h3>
                <p className="text-xs text-slate-500 mt-0.5">Inclui visualização do traçado e pontos.</p>
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
                  Processando Imagens...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Download className="group-hover:animate-bounce" size={18} />
                  Baixar Dossiê PDF
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