import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPinned, User, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export default function Auth({ onAuthSuccess }) {
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState({ msg: '', type: '' });
  
  // Inicializa o plugin do Google no Mobile
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize();
    }
  }, []);
  
  const handleNativeGoogleLogin = async () => {
    setLoading(true);
    try {
      // 1. Abre popup nativo do Android/iOS
      const googleUser = await GoogleAuth.signIn();
      
      // 2. Pega o token de identidade
      const idToken = googleUser.authentication.idToken;
      
      // 3. Autentica no Supabase usando o token (sem redirecionar para site)
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      
      if (error) throw error;
      
      setFeedback({ msg: 'Login com Google realizado!', type: 'success' });
      if (onAuthSuccess) onAuthSuccess(data.user);
      
    } catch (error) {
      console.error('Google Auth Error:', error);
      setFeedback({ msg: 'Cancelado ou erro no login Google.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleWebGoogleLogin = async () => {
    // Fallback para Web (PC)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) setFeedback({ msg: error.message, type: 'error' });
  };
  
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ msg: '', type: '' });
    
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setFeedback({ msg: 'Conta criada! Verifique seu email.', type: 'success' });
        setTimeout(() => setIsLogin(true), 2000);
      }
    } catch (error) {
      setFeedback({ msg: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      
      {/* Background Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(6,182,212,0.3)] transform rotate-3">
            <MapPinned className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Jamaaw <span className="text-cyan-400">Map</span></h1>
          <p className="text-slate-400 text-sm mt-1">Geo-Intelligence System</p>
        </div>

        {/* Card de Login */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          
          {/* Feedback Msg */}
          {feedback.msg && (
            <div className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}>
              <Zap size={14} /> {feedback.msg}
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={Capacitor.isNativePlatform() ? handleNativeGoogleLogin : handleWebGoogleLogin}
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Chrome className="w-5 h-5" />
                  <span>Continuar com Google</span>
                </>
              )}
            </Button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase font-bold tracking-wider">Ou email</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase font-bold pl-1">Email Corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                  <Input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="pl-10 h-11 bg-slate-950/50 border-white/10 text-white rounded-xl focus:border-cyan-500/50 focus:ring-cyan-500/20" 
                    placeholder="nome@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase font-bold pl-1">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="pl-10 h-11 bg-slate-950/50 border-white/10 text-white rounded-xl focus:border-cyan-500/50 focus:ring-cyan-500/20" 
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-500 hover:text-white">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 mt-2">
                {loading ? 'Processando...' : (isLogin ? 'Acessar Sistema' : 'Criar Nova Conta')} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>

            <div className="text-center pt-2">
              <button 
                onClick={() => { setIsLogin(!isLogin); setFeedback({msg:'', type:''}); }}
                className="text-slate-400 hover:text-cyan-400 text-sm transition-colors"
              >
                {isLogin ? 'Não tem acesso? Criar conta' : 'Já possui conta? Fazer login'}
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-center text-[10px] text-slate-600 mt-6">
          Jamaaw Map v2.5 Enterprise • Segurança End-to-End
        </p>
      </div>
    </div>
  );
}