import { useState } from 'react'
import { MapPin, Navigation, Ruler, Clock, Edit2, Share2, Heart, X } from 'lucide-react'
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

    return (R * c).toFixed(2)
  }

  const distance = calculateDistanceToMarker()

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm mx-auto animate-scale-in">
        <Card className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-slate-600/50 shadow-2xl overflow-hidden">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-4 relative">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg truncate">{marker.name}</h3>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="absolute top-3 right-3 h-8 w-8 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </Button>
            
            {/* Badge de distância */}
            {distance && (
              <div className="absolute -bottom-3 left-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {distance}m de distância
              </div>
            )}
          </div>

          <CardContent className="p-4 pt-6">
            {/* Informações do marcador */}
            <div className="space-y-3 mb-4">
              {marker.bairro && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 bg-cyan-500/20 rounded flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                  </div>
                  <span className="text-gray-300">Bairro:</span>
                  <span className="text-white font-medium">{marker.bairro}</span>
                </div>
              )}
              
              {marker.descricao && (
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-3 h-3 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-gray-300">Descrição:</span>
                    <p className="text-white mt-1">{marker.descricao}</p>
                  </div>
                </div>
              )}

              {/* Coordenadas */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-700/50 rounded p-2 text-center">
                  <span className="text-gray-400 block">Latitude</span>
                  <span className="text-cyan-400 font-mono">{marker.lat.toFixed(6)}</span>
                </div>
                <div className="bg-slate-700/50 rounded p-2 text-center">
                  <span className="text-gray-400 block">Longitude</span>
                  <span className="text-cyan-400 font-mono">{marker.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>

            {/* Ações rápidas */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                size="sm"
                onClick={() => onEdit?.(marker)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs h-9"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                onClick={() => onShare?.(marker)}
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-9"
              >
                <Share2 className="w-3 h-3 mr-1" />
                Compartilhar
              </Button>
            </div>

            {/* Ações secundárias */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleFavorite}
                className={`flex-1 border ${
                  isFavorite ? 'border-yellow-500 text-yellow-500' : 'border-slate-600 text-gray-400'
                } text-xs h-8`}
              >
                <Heart className={`w-3 h-3 mr-1 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                {isFavorite ? 'Favorito' : 'Favoritar'}
              </Button>
              
              {distance && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCalculateDistance?.(marker)}
                  className="border-slate-600 text-green-400 text-xs h-8"
                >
                  <Ruler className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Timestamp se disponível */}
            {marker.created_at && (
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                <p className="text-xs text-gray-500 text-center">
                  Criado em {new Date(marker.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ModernPopup