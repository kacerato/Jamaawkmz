import React, { useState, useEffect } from 'react';
import { FileText, Download, X, MapPin, Activity, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail, mapImage }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [detectedStreets, setDetectedStreets] = useState([]);

  // Se fechar, reseta estados
  useEffect(() => {
    if (!isOpen) {
      setDetectedStreets([]);
      setStatusMessage('');
      setIsGenerating(false);
    }
  }, [isOpen]);

  if (!project) return null;

  // --- 1. DETECÇÃO INTELIGENTE DE RUAS (AMOSTRAGEM) ---
  const detectStreets = async () => {
    if (!project.points || project.points.length === 0) return [];
    
    setStatusMessage('Identificando vias percorridas...');
    const uniqueStreets = new Set();
    const points = project.points;
    
    // Estratégia de Amostragem: Pegar Início, Fim e pontos intermediários (aprox a cada 10 ou 15 pontos)
    // Isso evita 500 chamadas de API para um projeto grande.
    const sampleRate = Math.max(1, Math.floor(points.length / 15)); 
    const samples = [];
    
    for (let i = 0; i < points.length; i += sampleRate) {
      samples.push(points[i]);
    }
    // Garante que o último ponto esteja incluso
    if (points[points.length - 1] !== samples[samples.length - 1]) {
      samples.push(points[points.length - 1]);
    }

    // Processa chamadas (com delay para não bloquear)
    for (const point of samples) {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lng}&zoom=17&addressdetails=1`,
          { headers: { 'User-Agent': 'JamaawApp/1.0' } } // Boa prática
        );
        
        const addr = response.data.address;
        if (addr) {
          const road = addr.road || addr.pedestrian || addr.street || addr.highway;
          if (road) uniqueStreets.add(road);
        }
        // Pequeno delay para respeitar API
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        console.warn('Erro ao detectar rua:', error);
      }
    }

    return Array.from(uniqueStreets);
  };

  // --- 2. CÁLCULOS AUXILIARES ---
  const formatSmartDistance = (meters) => {
    if (!meters || isNaN(meters)) return "0 m";
    if (meters < 1000) return `${meters.toFixed(2)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };

  // --- 3. GERAÇÃO DO PDF ESTILO GLOW ---
  const handleGenerateFullReport = async () => {
    setIsGenerating(true);
    
    try {
      // 1. Busca ruas antes de gerar o PDF
      const streets = await detectStreets();
      setDetectedStreets(streets);

      setStatusMessage('Renderizando documento PDF...');
      
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // --- FUNDO DARK (Slate 950) ---
      doc.setFillColor(2, 6, 23); 
      doc.rect(0, 0, width, height, 'F');

      let currentY = 15;

      // --- CABEÇALHO ---
      // Linha Neon Superior
      doc.setDrawColor(34, 211, 238); // Cyan
      doc.setLineWidth(1);
      doc.line(10, currentY, width - 10, currentY);
      
      currentY += 10;
      
      // Título
      doc.setTextColor(34, 211, 238); // Cyan Text
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO TÉCNICO", width / 2, currentY, { align: "center" });
      
      currentY += 8;
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("Jamaaw Geo-Intelligence System", width / 2, currentY, { align: "center" });

      currentY += 15;

      // --- SEÇÃO 1: MAPA VISUAL ---
      if (mapImage) {
        try {
            // Efeito de borda "Glow" na imagem
            doc.setDrawColor(6, 182, 212); // Cyan Border
            doc.setLineWidth(0.5);
            doc.roundedRect(14, currentY - 1, 182, 92, 3, 3, 'S'); // Borda externa
            
            // Adiciona a imagem do mapa (formato A4 largura approx 210mm)
            // Margem 15mm, Largura 180mm, Altura 90mm
            doc.addImage(mapImage, 'PNG', 15, currentY, 180, 90);
            
            currentY += 95;
        } catch (e) {
            console.error("Erro ao adicionar imagem:", e);
        }
      }

      // --- SEÇÃO 2: INFO CARD ---
      // Fundo do card de info
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.roundedRect(15, currentY, 180, 35, 3, 3, 'F');
      
      // Ícones simulados com círculos
      doc.setFillColor(6, 182, 212); // Cyan
      doc.circle(25, currentY + 10, 2, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(project.name.toUpperCase(), 30, currentY + 11);

      // Dados em Grid
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // Label color
      
      // Coluna 1
      doc.text("EXTENSÃO TOTAL", 30, currentY + 22);
      doc.text("QTD. PONTOS", 90, currentY + 22);
      doc.text("DATA CRIAÇÃO", 140, currentY + 22);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(56, 189, 248); // Highlight color
      
      doc.text(formatSmartDistance(project.total_distance), 30, currentY + 28);
      doc.text(project.points.length.toString(), 90, currentY + 28);
      doc.text(new Date(project.created_at || Date.now()).toLocaleDateString('pt-BR'), 140, currentY + 28);

      currentY += 45;

      // --- SEÇÃO 3: RUAS IDENTIFICADAS ---
      if (streets.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text("VIAS E LOGRADOUROS IDENTIFICADOS", 15, currentY);
        
        doc.setDrawColor(34, 211, 238);
        doc.line(15, currentY + 2, 90, currentY + 2); // Sublinhado parcial
        
        currentY += 8;
        doc.setFontSize(9);
        doc.setTextColor(203, 213, 225); // Slate 300
        doc.setFont("helvetica", "normal");
        
        // Lista as ruas separadas por vírgula ou em colunas simples
        const streetsText = streets.join(', ');
        const splitStreets = doc.splitTextToSize(streetsText, 180);
        doc.text(splitStreets, 15, currentY);
        
        currentY += (splitStreets.length * 5) + 10;
      }

      // --- SEÇÃO 4: TABELA DE PONTOS (Estilo Dark) ---
      // Se tiver pouco espaço, cria nova página
      if (currentY > 230) {
        doc.addPage();
        doc.setFillColor(2, 6, 23);
        doc.rect(0, 0, width, height, 'F');
        currentY = 20;
      }

      const tableBody = project.points.map((p, index) => [
        index + 1,
        new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR'),
        `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
        p.user_email || currentUserEmail || '---'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'HORA', 'COORDENADAS GPS', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'grid',
        // Estilização Customizada Dark/Glow
        headStyles: { 
            fillColor: [15, 23, 42], // Slate 950
            textColor: [34, 211, 238], // Cyan
            lineWidth: 0.1,
            lineColor: [34, 211, 238],
            fontStyle: 'bold'
        },
        bodyStyles: { 
            fillColor: [30, 41, 59], // Slate 800
            textColor: [226, 232, 240], // Slate 200
            lineWidth: 0.1,
            lineColor: [51, 65, 85] // Slate 700
        },
        alternateRowStyles: {
            fillColor: [23, 37, 84] // Slate/Blue Darker
        },
        styles: {
            fontSize: 8,
            cellPadding: 3
        },
        margin: { left: 15, right: 15 }
      });

      // --- RODAPÉ ---
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Jamaaw App - Relatório Gerado em ${new Date().toLocaleString()}`, 15, height - 10);
        doc.text(`Pág ${i} de ${pageCount}`, width - 25, height - 10);
      }

      // Salvar
      const safeName = `Relatorio_Glow_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      
      if (Capacitor.getPlatform() === 'web') {
        doc.save(safeName);
      } else {
        const base64Data = doc.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: safeName,
          data: base64Data,
          directory: Directory.Documents,
        });
        alert(`Relatório salvo em Documentos: ${safeName}`);
      }

      setStatusMessage('Sucesso!');
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setStatusMessage('Erro ao gerar relatório.');
      setTimeout(() => setIsGenerating(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={!isGenerating ? onClose : undefined}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-sm p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="flex flex-col bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)] relative">
          
          {/* Header Visual */}
          <div className="p-6 pb-4 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400" /> Relatório Técnico
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Gerar documentação em PDF
                </p>
              </div>
              {!isGenerating && (
                <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400 -mr-2">
                  <X size={20} />
                </Button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Preview do Projeto */}
            <div className="bg-slate-900 rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Layers size={20} />
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-white">{project.name}</h3>
                    <p className="text-xs text-slate-400">{formatSmartDistance(project.total_distance)} • {project.points.length} pts</p>
                 </div>
              </div>
              
              {mapImage ? (
                <div className="rounded-lg overflow-hidden border border-white/10 h-32 relative">
                    <img src={mapImage} alt="Preview do Mapa" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                    <div className="absolute bottom-2 left-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded">
                        Captura de Mapa Incluída
                    </div>
                </div>
              ) : (
                <div className="h-20 bg-slate-800/50 rounded-lg flex items-center justify-center border border-dashed border-slate-700 text-xs text-slate-500">
                    Sem visualização de mapa disponível
                </div>
              )}
            </div>

            {/* Status ou Botão */}
            {isGenerating ? (
              <div className="text-center py-4 space-y-3 animate-in fade-in">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
                <div>
                    <p className="text-sm font-bold text-white">{statusMessage}</p>
                    <p className="text-xs text-slate-400">Isso pode levar alguns segundos...</p>
                </div>
              </div>
            ) : (
              <Button 
                onClick={handleGenerateFullReport}
                className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] group transition-all hover:scale-[1.02]"
              >
                <Download className="mr-2 group-hover:animate-bounce" size={18} />
                Gerar PDF Detalhado
              </Button>
            )}

            {!isGenerating && (
                <p className="text-[10px] text-center text-slate-500 px-4">
                    O relatório incluirá imagem do mapa, vias percorridas identificadas automaticamente e tabela de coordenadas completa.
                </p>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;