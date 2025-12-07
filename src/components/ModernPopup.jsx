import { useState } from 'react'
import { MapPin, Navigation, Ruler, Clock, Edit2, Share2, Heart, X, Download, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import PhotoManager from './PhotoManager' // <--- Importe o novo componente

const ModernPopup = ({ marker, onClose, onEdit, onShare, onFavorite, onCalculateDistance, currentPosition, onUpdateMarker }) => {
  const [isFavorite, setIsFavorite] = useState(false)
  
  const handleFavorite = () => {
    setIsFavorite(!isFavorite)
    onFavorite?.(marker.id, !isFavorite)
  }
  
  // Handler para quando fotos forem adicionadas/removidas
  const handlePhotosUpdated = (newPhotos) => {
    // Cria o objeto marcador atualizado
    const updatedMarker = { ...marker, photos: newPhotos }
    
    // Chama a função do pai (App.jsx) para salvar no banco/estado
    if (onUpdateMarker) {
      onUpdateMarker(updatedMarker)
    }
  }
  
  const calculateDistanceToMarker = () => {
    if (!currentPosition || !marker) return null
    
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
      return "0 m"
    }
    
    const distance = Number(distanceInMeters)
    
    if (distance < 1) {
      return `${(distance * 100).toFixed(0)} cm`
    } else if (distance < 1000) {
      return `${distance.toFixed(0)} m`
    } else if (distance < 10000) {
      return `${(distance / 1000).toFixed(2)} km`
    } else {
      return `${(distance / 1000).toFixed(1)} km`
    }
  }
  
  const distance = calculateDistanceToMarker()
  
  if (!marker) return null
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10000] p-4 flex justify-center pointer-events-none">
      <div className="w-full max-w-sm bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto animate-slide-in-bottom">
        
        {/* Header com Cor do Projeto/Marcador */}
        <div className="relative h-16 bg-gradient-to-r from-cyan-900 to-slate-900 border-b border-white/10 p-4 flex justify-between items-start">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
          <div>
            <h3 className="font-bold text-white text-lg leading-none mb-1">{marker.name}</h3>
            <p className="text-xs text-cyan-400 font-mono flex items-center gap-1">
              <MapPin size={10} /> {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
            </p>
            
            {/* Badge de distância */}
            {distance && (
              <div className="mt-2 inline-flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                <Navigation className="w-3 h-3" />
                {formatDistanceDetailed(distance)} de distância
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 bg-white/10 rounded-full text-slate-300 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          
          {/* Seção de Fotos (NOVO) */}
          <PhotoManager 
            pointId={marker.id} 
            photos={marker.photos} 
            onPhotosUpdated={handlePhotosUpdated} 
          />

          {/* Informações do marcador - Layout mais limpo */}
          <div className="space-y-3">
            {marker.descricao && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Descrição</span>
                </div>
                <p className="text-white text-sm">{marker.descricao}</p>
              </div>
            )}

            {/* Informações adicionais */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              {marker.created_at && (
                <span>Criado em {new Date(marker.created_at).toLocaleDateString('pt-BR')}</span>
              )}
              {marker.rua && (
                <span className="text-cyan-400">{marker.rua}</span>
              )}
            </div>
          </div>

          <div className="h-px bg-white/10 w-full my-2"></div>

          {/* Ações principais */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onEdit?.(marker)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white text-sm h-10 rounded-xl"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button
              onClick={() => onShare?.(marker)}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm h-10 rounded-xl"
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
              } text-sm h-9 rounded-xl`}
            >
              <Heart className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-yellow-500' : ''}`} />
              {isFavorite ? 'Favorito' : 'Favoritar'}
            </Button>
            
            {distance && (
              <Button
                variant="outline"
                onClick={() => onCalculateDistance?.(marker)}
                className="border-green-500 text-green-400 text-sm h-9 rounded-xl"
              >
                <Ruler className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModernPopup