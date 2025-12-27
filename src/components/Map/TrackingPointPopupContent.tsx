import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, Navigation, MapPin } from 'lucide-react';

interface TrackingPointPopupContentProps {
  pointInfo: {
    point: {
      id: string;
      lat: number;
      lng: number;
    };
  };
  onClose: () => void;
  onSelectStart: (point: any) => void;
  selectedStartPoint: any;
  manualPoints: any[];
}

const TrackingPointPopupContent: React.FC<TrackingPointPopupContentProps> = ({
  pointInfo,
  onClose,
  onSelectStart,
  selectedStartPoint,
  manualPoints
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const pointIndex = manualPoints.findIndex(p => p.id === pointInfo.point.id) + 1;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="group relative rounded-2xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl w-[280px]"
      style={{
        // @ts-ignore - custom properties
        '--mouse-x': '50%',
        '--mouse-y': '50%',
      }}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.15), transparent 40%)`,
        }}
      />

      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.6), transparent 40%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          WebkitMaskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1.5px'
        }}
      />

      <div className="relative p-4 bg-slate-900/80 backdrop-blur-xl h-full rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <span className="text-cyan-400 font-bold text-sm">{pointIndex}</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm leading-none">
                Ponto de Rastreio
              </h3>
              <p className="text-[10px] text-cyan-400/80 font-mono mt-0.5">
                ID: {pointInfo.point.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 flex flex-col">
            <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Latitude
            </span>
            <span className="font-mono text-xs text-cyan-50 font-medium truncate">
              {pointInfo.point.lat?.toFixed(6)}
            </span>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 flex flex-col">
            <span className="text-[9px] uppercase text-slate-500 font-semibold mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Longitude
            </span>
            <span className="font-mono text-xs text-cyan-50 font-medium truncate">
              {pointInfo.point.lng?.toFixed(6)}
            </span>
          </div>
        </div>

        <Button
          onClick={() => {
            onSelectStart(pointInfo.point);
            onClose();
          }}
          className={`w-full h-10 text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
            selectedStartPoint && selectedStartPoint.id === pointInfo.point.id
            ? 'bg-green-500/20 border-green-500/50 text-green-400 cursor-default shadow-[0_0_15px_rgba(34,197,94,0.15)]'
            : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
          }`}
          disabled={selectedStartPoint && selectedStartPoint.id === pointInfo.point.id}
        >
          {selectedStartPoint && selectedStartPoint.id === pointInfo.point.id ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" /> Ponto Inicial Atual
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 mr-2 fill-current" /> Usar como Início
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default TrackingPointPopupContent;
