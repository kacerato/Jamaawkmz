import React from 'react';
import { FileText, Download, X, Calendar, User, MapPin, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProjectReport = ({ isOpen, onClose, project, userName }) => {
  if (!project) return null;

  // Cálculos do Relatório
  const today = new Date().toDateString();
  const pointsToday = project.points.filter(p => new Date(p.timestamp || p.created_at).toDateString() === today).length;
  const totalDistanceKm = (project.total_distance / 1000).toFixed(3);
  
  // Função Geradora de PDF Criativo
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Fundo Escuro (Simulado com retângulo)
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 297, 'F');

    // Cabeçalho Futurista
    doc.setTextColor(34, 211, 238); // Cyan
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE PROJETO", 20, 20);
    
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    // Info Principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`PROJETO: ${project.name.toUpperCase()}`, 20, 40);
    doc.text(`RESPONSÁVEL: ${userName?.toUpperCase() || 'N/A'}`, 20, 50);
    doc.text(`DATA: ${new Date().toLocaleDateString('pt-BR')}`, 140, 40);

    // Card de Estatísticas (Desenhado manualmente)
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.roundedRect(20, 60, 170, 40, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("DISTÂNCIA TOTAL", 30, 75);
    doc.text("PONTOS TOTAIS", 80, 75);
    doc.text("ATUALIZAÇÃO HOJE", 130, 75);

    doc.setFontSize(16);
    doc.setTextColor(56, 189, 248); // Sky Blue
    doc.text(`${totalDistanceKm} km`, 30, 85);
    doc.text(`${project.points.length}`, 80, 85);
    doc.setTextColor(52, 211, 153); // Emerald
    doc.text(`+${pointsToday} pts`, 130, 85);

    // Tabela de Pontos Recentes
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("REGISTRO DE ATIVIDADE (Últimos 20 Pontos)", 20, 115);

    const tableData = project.points.slice(-20).reverse().map((p, i) => [
      project.points.length - i,
      new Date(p.timestamp || p.created_at).toLocaleTimeString(),
      p.lat.toFixed(6),
      p.lng.toFixed(6),
      p.connectedFrom ? 'Conexão' : 'Ponto Base'
    ]);

    autoTable(doc, {
      startY: 120,
      head: [['ID', 'HORA', 'LATITUDE', 'LONGITUDE', 'TIPO']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [15, 23, 42] },
    });

    // Rodapé
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Gerado via Jamaaw App - Sistema de Rastreamento Profissional", 105, pageHeight - 10, { align: 'center' });

    doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed z-[10000] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw] max-w-lg p-0 border-none bg-transparent shadow-none outline-none">
        
        <div className="flex flex-col bg-slate-950/90 backdrop-blur-xl border border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl relative">
          
          {/* Header Decorativo */}
          <div className="h-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 w-full" />
          
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-cyan-400" /> Relatório de Obra
                </h2>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
                  {project.name}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400">
                <X size={20} />
              </Button>
            </div>

            {/* Grid de Estatísticas (Visual Bonito) */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Card Hoje */}
              <div className="col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl border border-white/5 flex justify-between items-center relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Adicionados Hoje</p>
                  <p className="text-3xl font-black text-green-400">{pointsToday}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  <Activity size={20} />
                </div>
              </div>

              {/* Distância */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                <MapPin size={16} className="text-blue-400 mb-2" />
                <p className="text-xl font-bold text-white">{totalDistanceKm} <span className="text-xs text-slate-500">km</span></p>
                <p className="text-[10px] text-slate-500 uppercase">Extensão Total</p>
              </div>

              {/* Usuário */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                <User size={16} className="text-purple-400 mb-2" />
                <p className="text-sm font-bold text-white truncate">{userName?.split('@')[0] || 'Eu'}</p>
                <p className="text-[10px] text-slate-500 uppercase">Responsável</p>
              </div>
            </div>

            {/* Ação Principal */}
            <Button 
              onClick={generatePDF}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 group"
            >
              <Download className="mr-2 group-hover:animate-bounce" size={18} />
              Baixar Relatório PDF
            </Button>
            
            <p className="text-[10px] text-center text-slate-500 mt-4">
              O PDF inclui tabela detalhada e dados técnicos.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectReport;