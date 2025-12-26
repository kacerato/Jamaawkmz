import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Camera, 
  Trash2, 
  Loader2, 
  Maximize2, 
  Grid, 
  MapPin,
  Edit3,
  Save,
  FileText
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '../lib/supabase';

// Função para gerar UUIDs compatível com Supabase
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const GerenciadorFotos = ({ projeto, pontoEspecifico = null, isOpen, onClose, user }) => {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editingDesc, setEditingDesc] = useState(null);
  const [tempDesc, setTempDesc] = useState('');
  
  const [pontoSelecionadoId, setPontoSelecionadoId] = useState(null);
  
  const fileInputRef = useRef(null);
  const descTextareaRef = useRef(null);

  // Resetar estados ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setPontoSelecionadoId(pontoEspecifico ? pontoEspecifico.id : null);
      carregarFotos();
    } else {
      setFotos([]);
      setViewingPhoto(null);
      setEditingDesc(null);
    }
  }, [isOpen, projeto, pontoEspecifico]);

  // Recarregar fotos ao trocar de aba
  useEffect(() => {
    if (isOpen) {
      carregarFotos();
    }
  }, [pontoSelecionadoId]);

  const carregarFotos = async () => {
    if (!projeto || !user || !isOpen) return;

    setLoading(true);

    try {
      let query = supabase
        .from('projeto_fotos')
        .select('*')
        .eq('projeto_id', projeto.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (pontoSelecionadoId === null) {
        query = query.is('ponto_id', null);
      } else {
        // CORREÇÃO: Garantir que o ponto_id seja um UUID válido
        query = query.eq('ponto_id', pontoSelecionadoId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Erro detalhado ao carregar fotos:', error);
        throw error;
      }
      
      setFotos(data || []);

    } catch (error) {
      console.error('Erro ao carregar galeria:', error);
      alert('Erro ao carregar fotos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !user || !projeto) return;
    
    setUploading(true);
    
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${generateUUID()}.${fileExt}`;
        const filePath = `projetos/${user.id}/${projeto.id}/${fileName}`;
        
        console.log('Fazendo upload para:', filePath);
        console.log('Ponto ID:', pontoSelecionadoId);
        console.log('Tipo do Ponto ID:', typeof pontoSelecionadoId);
        
        // 1. Upload para o Storage
        const { error: uploadError } = await supabase.storage
          .from('fotos')
          .upload(filePath, file, { 
            cacheControl: '3600', 
            upsert: false 
          });
        
        if (uploadError) {
          console.error('Erro no upload do storage:', uploadError);
          throw uploadError;
        }
        
        // 2. Obter URL pública
        const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(filePath);
        
        // 3. Preparar dados para inserção - CORREÇÃO CRÍTICA
        const fotoData = {
          projeto_id: projeto.id,
          ponto_id: pontoSelecionadoId, // Pode ser null para álbum geral
          url: urlData.publicUrl,
          descricao: '',
          user_id: user.id,
          nome_arquivo: filePath
        };

        console.log('Inserindo no banco:', fotoData);
        
        // 4. Inserir no banco
        const { data: newFoto, error: dbError } = await supabase
          .from('projeto_fotos')
          .insert([fotoData])
          .select()
          .single();
        
        if (dbError) {
          console.error('Erro ao inserir no banco:', dbError);
          throw dbError;
        }
        
        setFotos(prev => [newFoto, ...prev]);
      }

    } catch (error) {
      console.error('Erro completo no upload:', error);
      alert("Erro ao enviar foto. Verifique o console para detalhes.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleSaveDescription = async (fotoId) => {
    if (!tempDesc.trim()) return;

    try {
      const { error } = await supabase
        .from('projeto_fotos')
        .update({ descricao: tempDesc })
        .eq('id', fotoId);

      if (error) throw error;

      setFotos(prev => prev.map(f => 
        f.id === fotoId ? { ...f, descricao: tempDesc } : f
      ));
      setEditingDesc(null);
      setTempDesc('');

    } catch (error) {
      console.error('Erro ao salvar descrição:', error);
      alert('Erro ao salvar descrição.');
    }
  };

  const startEditing = (foto, e) => {
    e?.stopPropagation();
    setEditingDesc(foto.id);
    setTempDesc(foto.descricao || '');
    
    // Foco no textarea após renderização
    setTimeout(() => {
      descTextareaRef.current?.focus();
    }, 100);
  };

  const cancelEditing = () => {
    setEditingDesc(null);
    setTempDesc('');
  };

  const handleDelete = async (foto, e) => {
    e?.stopPropagation(); 
    if (!confirm("Tem certeza que deseja excluir esta foto permanentemente?")) return;

    try {
      // Deletar do storage
      if (foto.nome_arquivo) {
        const { error: storageError } = await supabase.storage
          .from('fotos')
          .remove([foto.nome_arquivo]);
        
        if (storageError) console.warn('Aviso ao deletar do storage:', storageError);
      }

      // Deletar do banco
      const { error } = await supabase
        .from('projeto_fotos')
        .delete()
        .eq('id', foto.id);

      if (error) throw error;

      setFotos(prev => prev.filter(f => f.id !== foto.id));
      if (viewingPhoto?.id === foto.id) setViewingPhoto(null);
      if (editingDesc === foto.id) cancelEditing();

    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert("Erro ao excluir foto.");
    }
  };

  const getPointLabel = (id) => {
    if (id === null) return "📁 Galeria Geral";
    if (!projeto?.points) return "📍 Ponto";
    
    const ponto = projeto.points.find(p => p.id === id);
    const index = projeto.points.findIndex(p => p.id === id);
    
    return ponto?.descricao 
      ? `📍 Ponto ${index + 1}: ${ponto.descricao}`
      : `📍 Ponto ${index + 1}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed z-[100] gap-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-0 outline-none left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] h-[90vh] md:w-full md:max-w-6xl md:h-[85vh] md:rounded-3xl flex flex-col overflow-hidden border border-cyan-500/20 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          
          <DialogTitle className="sr-only">Galeria Profissional de Fotos</DialogTitle>
          
          {/* HEADER - Design Premium */}
          <div className="flex-none h-20 px-6 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-b border-cyan-500/20 flex items-center justify-between z-20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                 <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-white font-bold text-lg tracking-tight">
                  {getPointLabel(pontoSelecionadoId)}
                </h2>
                <div className="flex items-center gap-3 text-cyan-100/80 text-sm">
                  <span className="truncate max-w-[200px] md:max-w-[300px] font-medium">{projeto?.name}</span>
                  <span className="w-1 h-1 rounded-full bg-cyan-400/50"></span>
                  <span className="font-semibold text-cyan-300">{fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}</span>
                </div>
              </div>
            </div>
            
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200 hover:scale-105"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 flex overflow-hidden bg-slate-950">
            
            {/* SIDEBAR - Navegação Elegante */}
            <div className="w-80 bg-slate-900/50 border-r border-cyan-500/10 flex-col hidden md:flex">
               <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                  
                  {/* Seção de Upload */}
                  <div className="mb-8">
                    <div 
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className={`
                        group relative p-6 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden 
                        flex flex-col items-center justify-center gap-4 text-center
                        ${uploading 
                          ? 'border-cyan-500 bg-cyan-500/10' 
                          : 'border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400 hover:bg-cyan-500/10'
                        }
                      `}
                    >
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={handleUpload} 
                        disabled={uploading} 
                      />
                      
                      {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                          <span className="text-cyan-300 font-medium">Enviando imagens...</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                            <Upload className="w-7 h-7 text-white" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-white font-semibold text-lg">
                              Adicionar Fotos
                            </p>
                            <p className="text-cyan-100/60 text-sm">
                              Arraste ou clique para enviar
                            </p>
                            <p className="text-cyan-100/40 text-xs font-medium">
                              {getPointLabel(pontoSelecionadoId)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Navegação entre Álbuns */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-cyan-300/60 uppercase tracking-widest">
                      Navegar Álbuns
                    </h3>
                    
                    <div className="space-y-2">
                      <Button
                        onClick={() => setPontoSelecionadoId(null)}
                        variant="ghost"
                        className={`w-full justify-start h-14 text-base font-medium transition-all duration-200 ${
                          pontoSelecionadoId === null 
                          ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30 shadow-lg shadow-cyan-500/10' 
                          : 'text-cyan-100/60 hover:text-cyan-100 hover:bg-cyan-500/10'
                        }`}
                      >
                        <Grid className="w-5 h-5 mr-3" />
                        Álbum Geral
                        <span className="ml-auto bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full text-xs">
                          {fotos.filter(f => f.ponto_id === null).length}
                        </span>
                      </Button>

                      {projeto?.points?.map((pt, idx) => {
                        const pontoFotos = fotos.filter(f => f.ponto_id === pt.id);
                        return (
                          <Button
                            key={pt.id}
                            onClick={() => setPontoSelecionadoId(pt.id)}
                            variant="ghost"
                            className={`w-full justify-start h-14 text-base font-medium transition-all duration-200 ${
                              pontoSelecionadoId === pt.id 
                              ? 'bg-blue-500/20 text-blue-100 border border-blue-500/30 shadow-lg shadow-blue-500/10' 
                              : 'text-blue-100/60 hover:text-blue-100 hover:bg-blue-500/10'
                            }`}
                          >
                            <MapPin className="w-5 h-5 mr-3" />
                            Ponto {idx + 1}
                            {pt.descricao && (
                              <span className="ml-2 text-xs text-blue-300/60 truncate flex-1 text-left">
                                {pt.descricao}
                              </span>
                            )}
                            <span className="ml-auto bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs min-w-[2rem]">
                              {pontoFotos.length}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
               </div>
            </div>

            {/* MAIN CONTENT - Galeria */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar">
              
              {/* Mobile Upload Button */}
              <div className="md:hidden p-4 border-b border-cyan-500/10 bg-slate-900/50 sticky top-0 z-10">
                <Button
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3 rounded-xl shadow-lg"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-5 h-5 mr-2" />
                  )}
                  {uploading ? 'Enviando...' : 'Adicionar Fotos'}
                </Button>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={handleUpload} 
                  disabled={uploading} 
                />
              </div>

              {/* Mobile Navigation */}
              <div className="md:hidden p-4 border-b border-cyan-500/10 bg-slate-900/30">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <Button
                    onClick={() => setPontoSelecionadoId(null)}
                    size="sm"
                    variant={pontoSelecionadoId === null ? "default" : "outline"}
                    className={`whitespace-nowrap ${
                      pontoSelecionadoId === null 
                      ? 'bg-cyan-600 text-white' 
                      : 'border-cyan-500/30 text-cyan-300'
                    }`}
                  >
                    <Grid className="w-4 h-4 mr-2" />
                    Geral
                  </Button>
                  {projeto?.points?.map((pt, idx) => (
                    <Button
                      key={pt.id}
                      onClick={() => setPontoSelecionadoId(pt.id)}
                      size="sm"
                      variant={pontoSelecionadoId === pt.id ? "default" : "outline"}
                      className={`whitespace-nowrap ${
                        pontoSelecionadoId === pt.id 
                        ? 'bg-blue-600 text-white' 
                        : 'border-blue-500/30 text-blue-300'
                      }`}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Pto {idx + 1}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="p-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                    <p className="text-cyan-200 font-medium">Carregando galeria...</p>
                  </div>
                ) : fotos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {fotos.map((foto) => (
                      <div 
                        key={foto.id} 
                        className="group relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl overflow-hidden border border-cyan-500/10 hover:border-cyan-400/30 transition-all duration-500 shadow-xl hover:shadow-2xl hover:shadow-cyan-500/10"
                      >
                        {/* Imagem */}
                        <div className="aspect-square overflow-hidden">
                          <img 
                            src={foto.url} 
                            alt={foto.descricao || 'Foto do projeto'} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" 
                            onClick={() => setViewingPhoto(foto)} 
                            loading="lazy"
                          />
                        </div>

                        {/* Overlay de Controles */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-4">
                          
                          {/* Top Bar - Ações Rápidas */}
                          <div className="flex justify-between items-start transform translate-y-[-10px] group-hover:translate-y-0 transition-transform duration-300">
                            <Button
                              size="sm"
                              onClick={(e) => startEditing(foto, e)}
                              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                onClick={() => setViewingPhoto(foto)}
                                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </Button>
                              
                              <Button
                                size="icon"
                                onClick={(e) => handleDelete(foto, e)}
                                className="bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm text-red-300 border border-red-500/30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Bottom Bar - Descrição */}
                          <div className="transform translate-y-[10px] group-hover:translate-y-0 transition-transform duration-300">
                            {editingDesc === foto.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  ref={descTextareaRef}
                                  value={tempDesc}
                                  onChange={(e) => setTempDesc(e.target.value)}
                                  placeholder="Digite a descrição da foto..."
                                  className="bg-black/50 backdrop-blur-sm border-cyan-500/50 text-white placeholder-cyan-200/50 resize-none"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveDescription(foto.id)}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white"
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                onClick={(e) => startEditing(foto, e)}
                                className="bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-white/10 cursor-pointer hover:border-cyan-500/30 transition-colors"
                              >
                                {foto.descricao ? (
                                  <p className="text-white text-sm line-clamp-2">
                                    {foto.descricao}
                                  </p>
                                ) : (
                                  <div className="flex items-center gap-2 text-cyan-200/60 text-sm">
                                    <FileText className="w-4 h-4" />
                                    Clique para adicionar descrição...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Badge de Descrição (sempre visível) */}
                        {foto.descricao && !editingDesc && (
                          <div className="absolute top-3 left-3">
                            <div className="bg-cyan-600/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Descrição
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/20 flex items-center justify-center mb-6 shadow-2xl">
                      <ImageIcon className="w-10 h-10 text-cyan-400/30" />
                    </div>
                    <h3 className="text-cyan-100 text-xl font-bold mb-3">Nenhuma foto encontrada</h3>
                    <p className="text-cyan-100/60 text-lg max-w-md">
                      {pontoSelecionadoId === null 
                        ? "Adicione fotos gerais do projeto para começar" 
                        : "Adicione fotos específicas deste ponto"}
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold px-8 py-3 rounded-xl shadow-lg"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Adicionar Primeira Foto
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Visualizador em Tela Cheia */}
      {viewingPhoto && (
        <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
          <DialogContent className="fixed inset-0 w-screen h-screen max-w-none bg-black/98 z-[200] border-0 p-0 flex flex-col items-center justify-center outline-none animate-in fade-in duration-200">
             
             {/* Header do Visualizador */}
             <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center justify-between px-6">
               <div className="flex items-center gap-3">
                 <Button
                   onClick={() => setViewingPhoto(null)}
                   size="icon"
                   variant="ghost"
                   className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                 >
                   <X className="w-5 h-5" />
                 </Button>
                 <div className="text-white">
                   <p className="font-semibold">Visualizando foto</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-2">
                 <Button
                   onClick={(e) => {
                     setViewingPhoto(null);
                     setTimeout(() => startEditing(viewingPhoto, e), 100);
                   }}
                   variant="ghost"
                   className="text-white hover:bg-white/10 backdrop-blur-md"
                 >
                   <Edit3 className="w-4 h-4 mr-2" />
                   Editar Descrição
                 </Button>
                 <Button
                   onClick={(e) => handleDelete(viewingPhoto, e)}
                   variant="ghost"
                   className="text-red-300 hover:bg-red-500/20 backdrop-blur-md"
                 >
                   <Trash2 className="w-4 h-4 mr-2" />
                   Excluir
                 </Button>
               </div>
             </div>

             {/* Imagem em Tela Cheia */}
             <div className="w-full h-full flex items-center justify-center p-4 md:p-10 pt-16">
               <img 
                 src={viewingPhoto.url} 
                 className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
                 alt={viewingPhoto.descricao || "Visualização em tela cheia"}
               />
             </div>

             {/* Descrição na Parte Inferior */}
             {viewingPhoto.descricao && (
               <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 max-w-2xl w-full px-4">
                 <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl text-white text-center border border-white/10 shadow-2xl">
                   {viewingPhoto.descricao}
                 </div>
               </div>
             )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GerenciadorFotos;