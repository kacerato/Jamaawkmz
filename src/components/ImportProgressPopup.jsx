// components/ImportProgressPopup.jsx
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react';

const ImportProgressPopup = ({
  isOpen,
  progress,
  currentStep,
  totalSteps,
  currentAction,
  onClose,
  success,
  error
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show) return null;

  const getProgressColor = () => {
    if (error) return 'bg-red-500';
    if (success) return 'bg-green-500';
    return 'bg-gradient-to-r from-cyan-500 to-blue-500';
  };

  const getIcon = () => {
    if (error) return <XCircle className="w-8 h-8 text-red-500" />;
    if (success) return <CheckCircle className="w-8 h-8 text-green-500" />;
    return <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />;
  };

  const getStatusText = () => {
    if (error) return 'Erro na Importação';
    if (success) return 'Importação Concluída!';
    return 'Processando Arquivo...';
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-auto animate-scale-in">
        <Card className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-slate-600/50 shadow-2xl overflow-hidden">
          {/* Header com gradiente */}
          <div className={`p-6 text-center ${
            error ? 'bg-gradient-to-r from-red-500 to-red-600' :
            success ? 'bg-gradient-to-r from-green-500 to-green-600' :
            'bg-gradient-to-r from-cyan-500 to-blue-600'
          }`}>
            <div className="flex items-center justify-center gap-3 mb-3">
              {getIcon()}
              <CardTitle className="text-white text-xl font-bold">
                {getStatusText()}
              </CardTitle>
            </div>
            <p className="text-cyan-100 text-sm">
              {error ? error : success ? 'Projeto importado com sucesso!' : 'Aguarde enquanto processamos seu arquivo...'}
            </p>
          </div>

          <CardContent className="p-6">
            {/* Barra de progresso animada */}
            {!success && !error && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Progresso</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor()} animate-pulse-slow`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Etapas do processo */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Etapa {currentStep} de {totalSteps}</span>
                    <span>{currentAction}</span>
                  </div>

                  {/* Indicadores de etapa */}
                  <div className="flex justify-between px-2">
                    {[...Array(totalSteps)].map((_, index) => (
                      <div
                        key={index}
                        className={`w-3 h-3 rounded-full border-2 ${
                          index + 1 < currentStep
                            ? 'bg-green-500 border-green-500'
                            : index + 1 === currentStep
                            ? 'bg-cyan-500 border-cyan-500 animate-pulse'
                            : 'bg-slate-600 border-slate-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Informações adicionais */}
            <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>
                  {success
                    ? 'Projeto adicionado à lista "Meus Projetos"'
                    : error
                    ? 'Verifique o formato do arquivo e tente novamente'
                    : 'Processando pontos geográficos...'
                  }
                </span>
              </div>
            </div>

            {/* Botão de ação */}
            <div className="mt-6">
              <button
                onClick={onClose}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 ${
                  error
                    ? 'bg-red-500 hover:bg-red-600'
                    : success
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-cyan-500 hover:bg-cyan-600'
                } shadow-lg hover:shadow-xl transform hover:scale-105`}
              >
                {error ? 'Tentar Novamente' : success ? 'Continuar' : 'Cancelar Importação'}
              </button>
            </div>

            {/* Dica rápida */}
            {(success || error) && (
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-400">
                  {success
                    ? 'O projeto já está disponível para uso'
                    : 'Arquivos KML/KMZ com muitos pontos podem demorar mais'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImportProgressPopup;