import { useState } from 'react'
import { MapPin, Navigation, Ruler, Clock, Edit2, Share2, Heart, X, Download, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const ModernPopup = ({ marker, onClose, onEdit, onShare, onFavorite, onCalculateDistance, currentPosition }) => {
  const [isFavorite, setIsFavorite] = useState(false)
  
  const handleFavorite = () => {
    setIsFavorite(!isFavorite)
    onFavorite?.(marker.id, !isFavorite)
  }
  
  const calculateDistanceToMarker = () => {
    if (!currentPosition) return null
    
    const R = 6371e3
    const φ1 = currentPosition.lat * Math.PI / 180
    const φ2 = marker.lat * Math.PI / 180
    const Δφ = (marker.lat - currentPosition.lat) * Math.PI / 180
    const Δλ = (marker.lng - currentPosition.lng) * Math.PI / 180
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    return R * c
  }
  
  const formatDistanceDetailed = (distanceInMeters) => {
    if (distanceInMeters === undefined || distanceInMeters === null || isNaN(distanceInMeters)) {
      return "0 m";
    }
    
    const distance = Number(distanceInMeters);
    
    if (distance < 1) {
      return `${(distance * 100).toFixed(0)} cm`;
    } else if (distance < 1000) {
      return `${distance.toFixed(0)} m`;
    } else if (distance < 10000) {
      return `${(distance / 1000).toFixed(2)} km`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  };
  
  const distance = calculateDistanceToMarker()
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm mx-auto animate-scale-in">
        <Card className="bg-slate-800 border-slate-700 shadow-2xl overflow-hidden">
          {/* Header com cor sólida */}
          <div className="bg-slate-700 p-4 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-base truncate">{marker.name}</h3>
                <p className="text-cyan-400 text-sm truncate">{marker.bairro || 'Sem bairro'}</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="absolute top-3 right-3 h-8 w-8 bg-slate-600 hover:bg-slate-500 text-white"
            >
              <X className="w-4 h-4" />
            </Button>
            
            {/* Badge de distância melhorado */}
            {distance && (
              <div className="absolute -bottom-3 left-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {formatDistanceDetailed(distance)} de distância
              </div>
            )}
          </div>

          <CardContent className="p-4 pt-6">
            {/* Informações do marcador - Layout mais limpo */}
            <div className="space-y-4 mb-4">
              {marker.descricao && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>Descrição</span>
                  </div>
                  <p className="text-white text-sm">{marker.descricao}</p>
                </div>
              )}

              {/* Coordenadas em layout moderno */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Latitude</div>
                  <div className="text-cyan-400 font-mono text-sm font-bold">
                    {marker.lat.toFixed(6)}
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Longitude</div>
                  <div className="text-cyan-400 font-mono text-sm font-bold">
                    {marker.lng.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* Informações adicionais */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Criado em {new Date(marker.created_at).toLocaleDateString('pt-BR')}</span>
                {marker.rua && (
                  <span className="text-cyan-400">{marker.rua}</span>
                )}
              </div>
            </div>

            {/* Ações principais */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                onClick={() => onEdit?.(marker)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white text-sm h-10"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button
                onClick={() => onShare?.(marker)}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm h-10"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            </div>

            {/* Ações secundárias */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleFavorite}
                className={`flex-1 border ${
                  isFavorite ? 'border-yellow-500 text-yellow-500' : 'border-slate-600 text-gray-400'
                } text-sm h-9`}
              >
                <Heart className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                {isFavorite ? 'Favorito' : 'Favoritar'}
              </Button>
              
              {distance && (
                <Button
                  variant="outline"
                  onClick={() => onCalculateDistance?.(marker)}
                  className="border-green-500 text-green-400 text-sm h-9"
                >
                  <Ruler className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ModernPopup