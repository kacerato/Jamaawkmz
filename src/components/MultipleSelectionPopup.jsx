// MultipleSelectionPopup.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, X, CheckSquare, Square, Layers, MapPinned } from 'lucide-react';

const MultipleSelectionPopup = ({
  isOpen,
  onClose,
  markers,
  selectedMarkers,
  onToggleMarker,
  onBatchBairroUpdate,
  bairros
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-auto animate-scale-in">
        <Card className="bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600/50 shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                Seleção Múltipla
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {selectedMarkers.length} marcadores selecionados
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Lista de marcadores */}
            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
              {markers.map(marker => (
                <div
                  key={marker.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedMarkers.some(m => m.id === marker.id)
                      ? 'bg-cyan-500/20 border-cyan-500'
                      : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                  }`}
                  onClick={() => onToggleMarker(marker)}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                    selectedMarkers.some(m => m.id === marker.id)
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'bg-slate-700 border-slate-500'
                  }`}>
                    {selectedMarkers.some(m => m.id === marker.id) && (
                      <CheckSquare className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{marker.name}</p>
                    <p className="text-gray-400 text-xs truncate">{marker.bairro || 'Sem bairro'}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ações */}
            {selectedMarkers.length > 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    onChange={(e) => onBatchBairroUpdate(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    defaultValue=""
                  >
                    <option value="" disabled>Selecione um bairro</option>
                    {bairros.map(bairro => (
                      <option key={bairro} value={bairro}>{bairro}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => onBatchBairroUpdate(selectedMarkers[0].bairro || bairros[0])}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    Aplicar
                  </Button>
                </div>
                
                <Button
                  onClick={() => onToggleMarker('all')}
                  className="w-full bg-slate-600 hover:bg-slate-500 text-white"
                >
                  {selectedMarkers.length === markers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>
            )}

            {/* Instruções */}
            <div className="text-center">
              <p className="text-gray-400 text-xs">
                Clique nos marcadores para selecionar/desselecionar
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MultipleSelectionPopup;