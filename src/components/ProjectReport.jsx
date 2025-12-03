import React, { useMemo } from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  if (!project) return null;

  // 1. Formatação Inteligente de Distância
  const formatSmartDistance = (meters) => {
    if (!meters || isNaN(meters)) return "0 m";
    if (meters < 1) return `${(meters * 100).toFixed(0)} cm`;
    if (meters < 1000) return `${meters.toFixed(2)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };

  // 2. Agrupamento por Data
  const groupedPoints = useMemo(() => {
    const groups = {};
    // Ordena do mais recente para o antigo
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

  // 3. Geração do PDF Simplificado
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Fundo Dark
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 297, 'F');

    let startY = 20;

    // Cabeçalho
    doc.setTextColor(34, 211, 238); // Cyan
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO TÉCNICO", 105, startY, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("Gerado via Jamaaw App", 105, startY + 6, { align: "center" });

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
    // Usa o email do usuário atual se o do projeto não estiver disponível
    const ownerEmail = currentUserEmail?.split('@')[0] || 'Eu';
    doc.text(`Responsável: ${ownerEmail}`, 130, startY + 18);

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
      doc.setLineWidth(0.1);
      doc.line(20, startY + 2, 100, startY + 2);

      startY += 10;

      // Dados da Tabela
      const tableBody = points.map((p, index) => [
        points.length - index,
        new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
        `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`, // Coordenadas em vez de endereço
        p.user_email || currentUserEmail || 'N/A'
      ]);

      autoTable(doc, {
        startY: startY,
        head: [['#', 'HORA', 'COORDENADAS (Lat, Lng)', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        styles: { fillColor: [30, 41, 59], textColor: [226, 232, 240], lineColor: [51, 65, 85], fontSize: 8 },
        columnStyles: { 2: { cellWidth: 60 }, 3: { cellWidth: 60 } },
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
      {/* Botão X duplicado removido com [&>button]:hidden */}
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

            {/* Resumo */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-3 rounded-2xl border border-white/5 flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Extensão Total</span>
                <div className="flex items-baseline gap-1">
                  <MapPin size={14} className="text-blue-400" />
                  <span className="text-lg font-bold text-white">
                    {formatSmartDistance(project.total_distance)}
                  </span>
                </div>
              </div>
              <div className="bg-slate-900 p-3 rounded-2xl border border-white/5 flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total Pontos</span>
                <div className="flex items-baseline gap-1">
                  <Activity size={14} className="text-green-400" />
                  <span className="text-lg font-bold text-white">{project.points.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Pontos */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {Object.entries(groupedPoints).map(([date, points], groupIndex) => (
              <div key={date} className="mb-6 animate-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${groupIndex * 100}ms` }}>
                
                <div className="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-slate-950/80 backdrop-blur-md py-2 z-10 border-b border-white/5">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-cyan-100 uppercase tracking-wide">{date}</h3>
                </div>

                <div className="space-y-2">
                  {points.map((p, i) => (
                    <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-slate-500" />
                          <span className="text-xs font-mono text-white">
                            {new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        {/* E-mail do responsável */}
                        <span className="text-[10px] text-slate-400 font-mono bg-black/30 px-1.5 rounded truncate max-w-[150px]">
                          {p.user_email || '---'}
                        </span>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-mono text-purple-300">
                          {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </span>
                      </div>
                    </div>
                  ))}
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
              Baixar Relatório PDF
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;