import React, { useState } from 'react';
import { Camera, Trash2, X, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const PhotoManager = ({ pointId, photos = [], onPhotosUpdated }) => {
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  
  const takePhoto = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 70, // Qualidade 70% para não pesar
        allowEditing: false,
        resultType: CameraResultType.Base64, // Pegamos Base64 para upload direto
        source: CameraSource.Camera // Ou Prompt para deixar escolher galeria
      });
      
      if (image.base64String) {
        await uploadToSupabase(image.base64String, image.format);
      }
    } catch (error) {
      console.warn('Câmera fechada ou erro:', error);
    }
  };
  
  const uploadToSupabase = async (base64, format) => {
    setUploading(true);
    try {
      const fileName = `${pointId}/${Date.now()}.${format}`;
      const filePath = `${fileName}`;
      
      // Converte Base64 para Blob para o Supabase aceitar
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${format}` });
      
      const { data, error } = await supabase.storage
        .from('project-evidence')
        .upload(filePath, blob, {
          contentType: `image/${format}`,
          upsert: false
        });
      
      if (error) throw error;
      
      // Gera URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('project-evidence')
        .getPublicUrl(filePath);
      
      // Atualiza a lista de fotos localmente
      const newPhotoObj = {
        url: publicUrl,
        path: filePath, // Guardamos o path para poder deletar depois
        timestamp: new Date().toISOString()
      };
      
      const updatedPhotos = [...(photos || []), newPhotoObj];
      onPhotosUpdated(updatedPhotos); // Callback para o componente pai salvar no banco
      
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao salvar a foto na nuvem.');
    } finally {
      setUploading(false);
    }
  };
  
  const deletePhoto = async (photoPath) => {
    if (!confirm('Excluir esta evidência?')) return;
    
    try {
      // 1. Deleta do Storage
      const { error } = await supabase.storage
        .from('project-evidence')
        .remove([photoPath]);
      
      if (error) throw error;
      
      // 2. Atualiza array local
      const updatedPhotos = photos.filter(p => p.path !== photoPath);
      onPhotosUpdated(updatedPhotos);
      
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };
  
  return (
    <div className="mt-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
          <ImageIcon size={10} /> Evidências ({photos?.length || 0})
        </h4>
      </div>

      {/* Grid de Fotos */}
      <div className="grid grid-cols-3 gap-2">
        
        {/* Botão Adicionar */}
        <button 
          onClick={takePhoto}
          disabled={uploading}
          className="aspect-square rounded-xl border border-dashed border-slate-600 bg-slate-800/30 flex flex-col items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all active:scale-95"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          ) : (
            <>
              <Camera className="w-5 h-5 mb-1" />
              <span className="text-[9px] font-bold uppercase">Foto</span>
            </>
          )}
        </button>

        {/* Lista de Fotos */}
        {photos?.map((photo, idx) => (
          <div 
            key={idx} 
            className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black cursor-pointer shadow-lg"
            onClick={() => setViewPhoto(photo.url)}
          >
            <img src={photo.url} alt="Evidência" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            
            {/* Overlay Gradiente */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
            
            {/* Botão Deletar (só aparece no canto) */}
            <button 
              onClick={(e) => { e.stopPropagation(); deletePhoto(photo.path); }}
              className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Modal Lightbox (Visualização Fullscreen) */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="border-none bg-black/95 p-0 max-w-none w-screen h-screen flex items-center justify-center z-[11000]">
          <button 
            onClick={() => setViewPhoto(null)}
            className="absolute top-4 right-4 z-50 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
          >
            <X size={24} />
          </button>
          {viewPhoto && (
            <img 
              src={viewPhoto} 
              alt="Full view" 
              className="max-w-full max-h-full object-contain" 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoManager;