import React, { useMemo } from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProjectReport = ({ isOpen, onClose, project, currentUserEmail }) => {
  if (!project) return null;

  // 1. Função de Formatação Inteligente de Distância
  const formatSmartDistance = (meters) => {
    if (!meters || isNaN(meters)) return "0 m";
    if (meters < 1) return `${(meters * 100).toFixed(0)} cm`;
    if (meters < 1000) return `${meters.toFixed(2)} m`;
    return `${(meters / 1000).toFixed(3)} km`;
  };

  // 2. Agrupamento de Pontos por Data (Memoizado para performance)
  const groupedPoints = useMemo(() => {
    const groups = {};
    
    // Ordena pontos do mais recente para o mais antigo
    const sortedPoints = [...project.points].sort((a, b) => 
      new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at)
    );

    sortedPoints.forEach(point => {
      const date = new Date(point.timestamp || point.created_at).toLocaleDateString('pt-BR', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(point);
    });

    return groups;
  }, [project.points]);

  // 3. Gerador de PDF Detalhado e Separado por Dias
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // --- DESIGN DO PDF ---
    
    // Fundo
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 297, 'F');

    // Cabeçalho Principal
    doc.setTextColor(34, 211, 238); // Cyan
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE ACOMPANHAMENTO", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Gerado via Jamaaw App", 105, 26, { align: "center" });

    // Linha divisória
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.5);
    doc.line(20, 30, 190, 30);

    // Resumo Geral
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.roundedRect(20, 35, 170, 25, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`PROJETO: ${project.name.toUpperCase()}`, 25, 45);
    doc.text(`EXTENSÃO TOTAL: ${formatSmartDistance(project.total_distance)}`, 25, 53);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Total de Pontos: ${project.points.length}`, 130, 45);
    doc.text(`Status: ${project.tracking_mode === 'manual' ? 'Manual' : 'Automático'}`, 130, 53);

    let finalY = 70;

    // --- LOOP POR CADA DIA (TABELAS SEPARADAS) ---
    Object.entries(groupedPoints).forEach(([date, points]) => {
      
      // Verifica se precisa de nova página
      if (finalY > 250) {
        doc.addPage();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 297, 'F');
        finalY = 20;
      }

      // Cabeçalho do Dia
      doc.setFontSize(14);
      doc.setTextColor(56, 189, 248); // Sky Blue
      doc.setFont("helvetica", "bold");
      doc.text(date.toUpperCase(), 20, finalY);
      
      // Linha fina abaixo da data
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.1);
      doc.line(20, finalY + 2, 100, finalY + 2);

      finalY += 10;

      // Dados da Tabela
      const tableBody = points.map((p, index) => [
        points.length - index, // ID Sequencial do dia
        new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        p.lat.toFixed(6),
        p.lng.toFixed(6),
        // Tenta pegar o email do ponto, se não tiver, usa o do projeto, ou "N/A"
        p.user_email || (p.user_id === project.user_id ? currentUserEmail : 'Colaborador')
      ]);

      // Renderiza Tabela
      autoTable(doc, {
        startY: finalY,
        head: [['#', 'HORA', 'LATITUDE', 'LONGITUDE', 'RESPONSÁVEL']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
          fillColor: [6, 182, 212], // Cyan header
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          fontSize: 8
        },
        styles: { 
          fillColor: [30, 41, 59], // Slate 800 rows
          textColor: [226, 232, 240], // Slate 200 text
          lineColor: [51, 65, 85], // Slate 700 borders
          fontSize: 8
        },
        alternateRowStyles: { 
          fillColor: [15, 23, 42] // Slate 900 alternate
        },
        margin: { left: 20, right: 20 }
      });

      finalY = doc.lastAutoTable.finalY + 15; // Espaço para o próximo dia
    });

    // Rodapé da última página
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Documento Oficial - Jamaaw App", 105, pageHeight - 10, { align: 'center' });

    doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* CORREÇÃO DO X DUPLICADO: 
         Adicionei a classe [&>button]:hidden para esconder o botão padrão do Radix UI.
      */}
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-2xl h-[85vh] p-0 border-none bg-transparent shadow-none outline-none [&>button]:hidden">
        
        <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl relative">
          
          {/* Header Fixo */}
          <div className="flex-none p-6 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400" /> Relatório Detalhado
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase tracking-wider">
                    {project.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={onClose} 
                className="rounded-full hover:bg-white/10 text-slate-400 -mr-2"
              >
                <X size={24} />
              </Button>
            </div>

            {/* Card de Resumo Topo */}
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

          {/* Lista Scrollável Separada por Dias */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {Object.entries(groupedPoints).map(([date, points], groupIndex) => (
              <div key={date} className="mb-6 animate-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${groupIndex * 100}ms` }}>
                
                {/* Cabeçalho do Dia */}
                <div className="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-slate-950/80 backdrop-blur-md py-2 z-10">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-purple-200 uppercase tracking-wide">
                    {date}
                  </h3>
                  <span className="ml-auto text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    {points.length} ações
                  </span>
                </div>

                {/* Lista de Pontos do Dia */}
                <div className="space-y-2">
                  {points.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800/50 transition-colors">
                      <div className="flex flex-col items-center min-w-[40px]">
                        <span className="text-xs font-mono text-cyan-500 font-bold">
                          {new Date(p.timestamp || p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      
                      <div className="w-px h-8 bg-white/10 mx-1" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-white font-medium">Ponto Adicionado</span>
                          {p.connectedFrom && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 rounded">Conexão</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <User size={10} />
                          <span className="truncate max-w-[150px]">
                            {/* Mostra email ou fallback */}
                            {p.user_email || (p.user_id === project.user_id ? currentUserEmail : 'Colaborador')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-mono text-slate-400 bg-black/20 px-2 py-1 rounded">
                          lat: {p.lat.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Fixo */}
          <div className="flex-none p-4 bg-slate-900 border-t border-white/5">
            <Button 
              onClick={generatePDF}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 group"
            >
              <Download className="mr-2 group-hover:animate-bounce" size={18} />
              Baixar PDF Completo
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;