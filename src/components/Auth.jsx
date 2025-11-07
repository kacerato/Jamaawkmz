import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MapPinned, User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx'

export default function Auth({ onAuthSuccess }) {
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  
  // CORREÇÃO: Limpeza mais robusta de tokens
  useEffect(() => {
    const clearInvalidTokens = async () => {
      try {
        // Limpar todos os possíveis tokens
        await supabase.auth.signOut()
        
        // Limpar storage local
        localStorage.removeItem('supabase.auth.token')
        sessionStorage.removeItem('supabase.auth.token')
        
        // Limpar dados específicos do app
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.includes('supabase') || key.includes('jamaaw')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
      } catch (error) {
        console.log('Cleanup de tokens realizado')
      }
    }
    
    clearInvalidTokens()
  }, [])
  
    // Função para login com Google
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        throw error
      }

      // O redirecionamento para o Google acontecerá automaticamente
      setSuccess('Redirecionando para o Google...')
      
    } catch (error) {
      console.error('Erro no login com Google:', error)
      setError(error.message || 'Erro ao conectar com o Google')
    } finally {
      setGoogleLoading(false)
    }
  }
  
  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      // CORREÇÃO: Reset completo antes de nova tentativa
      await supabase.auth.signOut()
      
      // Pequeno delay para garantir que o signOut foi processado
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        })
        
        if (error) {
          // Tratar erros específicos de autenticação
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email ou senha incorretos.')
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Por favor, confirme seu email antes de fazer login.')
          } else if (error.message.includes('Invalid Refresh Token')) {
            // CORREÇÃO: Limpar tokens inválidos e tentar novamente
            await supabase.auth.signOut()
            throw new Error('Sessão expirada. Por favor, faça login novamente.')
          } else {
            throw error
          }
        }
        
        if (onAuthSuccess && data.user) {
          setSuccess('Login realizado com sucesso!')
          setTimeout(() => onAuthSuccess(data.user), 1000)
        }
      } else {
        // Registro
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        })
        
        if (error) {
          if (error.message.includes('User already registered')) {
            throw new Error('Este email já está cadastrado.')
          } else {
            throw error
          }
        }
        
        if (data.user) {
          setSuccess('Conta criada com sucesso! Verifique seu email para confirmar.')
          setTimeout(() => setIsLogin(true), 2000)
        }
      }
    } catch (error) {
      console.error('Erro na autenticação:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }
  
  // ... restante do código permanece igual

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Digite seu email para redefinir a senha.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess('Email de redefinição de senha enviado! Verifique sua caixa de entrada.')
      }
    } catch (error) {
      setError('Erro ao enviar email de redefinição.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-gradient-to-br from-slate-800/95 to-slate-700/95 backdrop-blur-sm border-slate-600/50 shadow-2xl text-white overflow-hidden">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
            <MapPinned className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Jamaaw App
          </CardTitle>
          <CardDescription className="text-cyan-100 text-lg">
            {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
          </CardDescription>
        </div>

        <CardContent className="p-6">
          {/* Botão de Login com Google */}
          <Button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 text-base h-12 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mb-4 border border-gray-300"
          >
            {googleLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
                Conectando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Chrome className="w-5 h-5" />
                Continuar com Google
              </div>
            )}
          </Button>

          {/* Divisor */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-gray-400">ou</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {/* Mensagens de status */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-green-400 text-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              </div>
            )}

            {/* Campo Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                E-mail
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="bg-slate-700/50 border-slate-600 text-white pl-10 pr-4 h-12 focus:border-cyan-500 focus:ring-cyan-500/20 transition-all duration-200"
                  disabled={loading}
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300 text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-slate-700/50 border-slate-600 text-white pl-10 pr-10 h-12 focus:border-cyan-500 focus:ring-cyan-500/20 transition-all duration-200"
                  disabled={loading}
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Botão de ação principal */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 text-base h-12 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isLogin ? 'Entrando...' : 'Criando conta...'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {isLogin ? 'Entrar na conta' : 'Criar nova conta'}
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </Button>

            {/* Links e ações secundárias */}
            <div className="space-y-3 pt-2">
              {/* Recuperação de senha */}
              {isLogin && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handlePasswordReset}
                    disabled={loading || !email}
                    className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 text-sm px-3 py-2 h-auto"
                  >
                    Esqueceu sua senha?
                  </Button>
                </div>
              )}

              {/* Alternar entre login e registro */}
              <div className="text-center border-t border-slate-600/50 pt-4">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError(null)
                    setSuccess(null)
                  }}
                  disabled={loading}
                  className="text-gray-400 hover:text-cyan-400 text-sm p-0 h-auto font-normal"
                >
                  {isLogin ? (
                    <span>Não tem uma conta? <strong className="text-cyan-400 font-semibold">Cadastre-se aqui</strong></span>
                  ) : (
                    <span>Já tem uma conta? <strong className="text-cyan-400 font-semibold">Faça login</strong></span>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Informações adicionais */}
          <div className="mt-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <span>
                {isLogin 
                  ? 'Entre para acessar seus projetos e marcações' 
                  : 'Cadastre-se para salvar seus projetos na nuvem'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}