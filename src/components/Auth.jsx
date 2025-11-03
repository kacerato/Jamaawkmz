import { useState } from 'react'
import { supabase } from '../lib/supabase'
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
  const [showResend, setShowResend] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setShowResend(false)

    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        if (onAuthSuccess) onAuthSuccess(data.user)
      } else {
        // Registro
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        alert('Conta criada com sucesso! Verifique seu e-mail para confirmar.')
        setIsLogin(true)
      }
    } catch (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Seu e-mail ainda não foi confirmado. Por favor, verifique sua caixa de entrada.');
        setShowResend(true);
      } else if (error.message.includes('Invalid login credentials')) {
        setError('E-mail ou senha inválidos. Por favor, tente novamente.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      alert('Link de confirmação reenviado! Verifique seu e-mail.');
      setShowResend(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <img src="/jamaaw-logo.jpg" alt="Jamaaw" className="w-16 h-16 rounded" />
          </div>
          <CardTitle className="text-2xl text-center text-white">
            {isLogin ? 'Login' : 'Criar Conta'}
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {isLogin ? 'Entre com suas credenciais' : 'Crie uma nova conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-300">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-300">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                  setShowResend(false)
                }}
                className="text-cyan-400 hover:text-cyan-300 text-sm"
              >
                {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
              </button>
            </div>
            {showResend && (
              <div className="text-center mt-2">
                <Button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  {loading ? 'Enviando...' : 'Reenviar e-mail de confirmação'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

