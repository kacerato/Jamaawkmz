import { MapPin, X, Edit2, Trash2, Share2, Star, Navigation } from 'lucide-react';

const MarkerDetailsPopup = ({
  marker,
  distance,
  isFavorite,
  onClose,
  onEdit,
  onDelete,
  onShare,
  onToggleFavorite
}) => {
  if (!marker) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 max-w-sm mx-auto animate-slide-in-bottom">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{marker.name}</h3>
                <p className="text-sm text-cyan-400">{marker.bairro || 'Sem bairro'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {marker.descricao && (
            <p className="text-slate-300 mt-4 text-sm">{marker.descricao}</p>
          )}

          <div className="flex items-center gap-2 mt-4 bg-slate-800/50 p-3 rounded-lg">
            <Navigation size={16} className="text-cyan-400" />
            <span className="text-sm text-slate-300">
              Distância: <span className="font-bold text-white">{distance}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 bg-slate-900/50">
          <button onClick={onEdit} className="flex flex-col items-center justify-center p-3 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">
            <Edit2 size={20} />
            <span className="text-xs mt-1">Editar</span>
          </button>
          <button onClick={onDelete} className="flex flex-col items-center justify-center p-3 text-slate-300 hover:bg-slate-700/50 hover:text-red-400 transition-colors">
            <Trash2 size={20} />
            <span className="text-xs mt-1">Excluir</span>
          </button>
          <button onClick={onShare} className="flex flex-col items-center justify-center p-3 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">
            <Share2 size={20} />
            <span className="text-xs mt-1">Partilhar</span>
          </button>
          <button onClick={onToggleFavorite} className={`flex flex-col items-center justify-center p-3 hover:bg-slate-700/50 transition-colors ${isFavorite ? 'text-yellow-400' : 'text-slate-300'}`}>
            <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            <span className="text-xs mt-1">Favorito</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkerDetailsPopup;
