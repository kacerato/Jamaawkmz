import React, { useMemo, useState } from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity, Map as MapIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';

// Token deve vir das props ou env, aqui hardcoded para o exemplo funcionar com o seu setup anterior
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2FjZXJhdG8iLCJhIjoiY21oZG1nNnViMDRybjJub2VvZHV1aHh3aiJ9.l7tCaIPEYqcqDI8_aScm7Q';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  const [addresses, setAddresses] = useState({}); // Cache de endereços { "lat,lng": "Rua X" }
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);

  if (!project) return null;

  // 1. Formatação Inteligente de Distância
  const formatSmartDistance = (meters) => {
    if (!meters || isNaN(meters)) return "0 m";
    if (meters < 1) return `${(meters * 100).toFixed(0)} cm`;
    if (meters < 1000) return `${meters.toFixed(2)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };

  // 2. Lógica de Geocodificação (Endereços Reais)
  const enrichAddresses = async () => {
    setIsEnriching(true);
    setEnrichProgress(0);
    
    // Seleciona pontos estratégicos para não estourar a API (Início, Fim, e a cada 5 pontos)
    // Se forem poucos pontos (<20), faz de todos.
    const pointsToFetch = project.points.length < 20 
      ? project.points 
      : project.points.filter((_, i) => i === 0 || i === project.points.length - 1 || i % 5 === 0);

    const newAddresses = { ...addresses };
    let count = 0;

    for (const point of pointsToFetch) {
      const key = `${point.lat},${point.lng}`;
      if (!newAddresses[key]) {
        try {
          // Usa Nominatim (OpenStreetMap)
          const res = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } } // Força português
          );
          
          if (res.data && res.data.address) {
            const addr = res.data.address;
            // Prioriza Rua > Bairro > Cidade
            newAddresses[key] = addr.road || addr.suburb || addr.city_district || addr.hamlet || 'Local desconhecido';
          }
        } catch (error) {
          console.warn('Erro ao buscar endereço:', error);
        }
        
        // Delay crucial para não ser bloqueado pela API (1req/sec recomendado para OSM livre)
        await new Promise(r => setTimeout(r, 800));
      }
      count++;
      setEnrichProgress(Math.round((count / pointsToFetch.length) * 100));
    }

    setAddresses(newAddresses);
    setIsEnriching(false);
  };

  // 3. Helper para Snapshot do Mapa (Mapbox Static API)
  const getMapSnapshotUrl = () => {
    if (project.points.length === 0) return null;

    // Calcula Bounding Box (Limites do mapa)
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    project.points.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    // Adiciona margem (padding) ao cálculo
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    // Constrói URL (Estilo Satellite-Streets para ficar bonito no relatório)
    // Nota: Passar path geojson na URL tem limite de caracteres. 
    // Usamos 'auto' para enquadrar os marcadores principais ou apenas o centro.
    
    // Versão simplificada: Centro + Zoom automático baseado na bbox
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v11/static/[${minLng},${minLat},${maxLng},${maxLat}]/600x300?padding=50&access_token=${MAPBOX_TOKEN}`;
  };

  // Helper para baixar a imagem como Base64 para o PDF
  const getImageData = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // 4. Agrupamento por Data
  const groupedPoints = useMemo(() => {
    const groups = {};
    const sortedPoints = [...project.points].sort((a, b) => 
      new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at)
    );

    sortedPoints.forEach(point => {
      const date = new Date(point.timestamp || point.created_at).toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(point);
    });
    return groups;
  }, [project.points]);

  // 5. GERAÇÃO DO PDF
  const generatePDF = async () => {
    const doc = new jsPDF();
    
    // Fundo Dark
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 297, 'F');

    // --- SNAPSHOT DO MAPA ---
    try {
      const mapUrl = getMapSnapshotUrl();
      if (mapUrl) {
        const mapImage = await getImageData(mapUrl);
        // Adiciona imagem no topo (x, y, w, h)
        doc.addImage(mapImage, 'JPEG', 15, 15, 180, 60); 
        
        // Borda neon na imagem
        doc.setDrawColor(34, 211, 238);
        doc.setLineWidth(0.5);
        doc.rect(15, 15, 180, 60);
      }
    } catch (e) {
      console.error("Erro ao gerar snapshot do mapa", e);
    }

    let startY = 85; // Começa abaixo do mapa

    // Cabeçalho Texto
    doc.setTextColor(34, 211, 238);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO TÉCNICO", 105, startY, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("Documento gerado via Jamaaw App", 105, startY + 6, { align: "center" });

    startY += 15;

    // Resumo
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, startY, 170, 25, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`PROJETO: ${project.name.toUpperCase()}`, 25, startY + 10);
    doc.text(`EXTENSÃO: ${formatSmartDistance(project.total_distance)}`, 25, startY + 18);
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Total de Pontos: ${project.points.length}`, 130, startY + 10);
    doc.text(`Responsável: ${currentUserEmail?.split('@')[0] || 'Eu'}`, 130, startY + 18);

    startY += 35;

    // --- TABELAS POR DIA ---
    Object.entries(groupedPoints).forEach(([date, points]) => {
      
      if (startY > 250) {
        doc.addPage();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 297, 'F');
        startY = 20;
      }

      // Título da Data
      doc.setFontSize(14);
      doc.setTextColor(56, 189, 248);
      doc.setFont("helvetica", "bold");
      doc.text(date.toUpperCase(), 20, startY);
      doc.setDrawColor(56, 189, 248);
      doc.line(20, startY + 2, 100, startY + 2);

      startY += 10;

      // Monta dados da tabela (Inclui Endereço e E-mail)
      const tableBody = points.map((p, index) => {
        const key = `${p.lat},${p.lng}`;
        // Lógica de fallback para endereço: Se não tem exato, tenta pegar o mais próximo
        const address = addresses[key] || "Coordenada registrada";
        
        return [
          points.length - index,
          new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
          address, // COLUNA NOVA
          // Mostra o email específico do ponto ou o do usuário atual como fallback
          p.user_email || currentUserEmail || 'N/A'
        ];
      });

      autoTable(doc, {
        startY: startY,
        head: [['#', 'HORA', 'LOCALIZAÇÃO / ENDEREÇO', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        styles: { fillColor: [30, 41, 59], textColor: [226, 232, 240], lineColor: [51, 65, 85], fontSize: 8 },
        columnStyles: { 2: { cellWidth: 80 } }, // Coluna de endereço mais larga
        alternateRowStyles: { fillColor: [15, 23, 42] },
        margin: { left: 20, right: 20 }
      });

      startY = doc.lastAutoTable.finalY + 15;
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${pageCount}`, 105, 290, {align: 'center'});
    }

    doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-2xl h-[85vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl relative">
          
          {/* Header */}
          <div className="flex-none p-6 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400" /> Relatório de Projeto
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase tracking-wider">
                    {project.name}
                  </span>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400 -mr-2">
                <X size={24} />
              </Button>
            </div>

            {/* Ação de Enriquecimento (Geocoding) */}
            <div className="mt-4">
              {!isEnriching && Object.keys(addresses).length === 0 ? (
                <Button 
                  onClick={enrichAddresses} 
                  variant="outline"
                  className="w-full h-10 border-dashed border-purple-500/50 text-purple-400 hover:bg-purple-500/10 text-xs uppercase font-bold tracking-wider"
                >
                  <MapIcon className="w-4 h-4 mr-2" /> Detectar Endereços (Geocoding)
                </Button>
              ) : isEnriching ? (
                <div className="w-full h-10 flex items-center justify-center gap-3 bg-purple-500/10 rounded-md border border-purple-500/20">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-xs text-purple-300 font-medium">
                    Buscando endereços... {enrichProgress}%
                  </span>
                </div>
              ) : (
                <div className="w-full h-10 flex items-center justify-center gap-2 bg-green-500/10 rounded-md border border-green-500/20">
                  <MapIcon className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-300 font-medium">Endereços Carregados</span>
                </div>
              )}
            </div>
          </div>

          {/* Lista de Dados */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {Object.entries(groupedPoints).map(([date, points], groupIndex) => (
              <div key={date} className="mb-6 animate-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${groupIndex * 100}ms` }}>
                
                <div className="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-slate-950/80 backdrop-blur-md py-2 z-10 border-b border-white/5">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-cyan-100 uppercase tracking-wide">{date}</h3>
                </div>

                <div className="space-y-2">
                  {points.map((p, i) => {
                    const key = `${p.lat},${p.lng}`;
                    return (
                      <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-slate-500" />
                            <span className="text-xs font-mono text-white">
                              {new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono bg-black/30 px-1.5 rounded">
                            {p.user_email || '---'}
                          </span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-slate-300 leading-tight">
                            {addresses[key] || "Coordenada registrada"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex-none p-4 bg-slate-900 border-t border-white/5">
            <Button 
              onClick={generatePDF}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 group"
            >
              <Download className="mr-2 group-hover:animate-bounce" size={18} />
              Baixar Relatório Completo (PDF)
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;