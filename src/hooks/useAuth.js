// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Ajuste o caminho se necessário (ex: '../supabase')
import { storage } from '../utils/storage';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro de sessão:', error);
          if (error.message.includes('Invalid Refresh Token')) {
            localStorage.removeItem('supabase.auth.token');
            await supabase.auth.signOut();
          }
        }
        
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro Auth:', err);
        if (mounted) setLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setUser(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
        }
      }
    });
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  const logout = async () => {
    try {
      if (user) {
        storage.clearUserData(user.id);
      }
      localStorage.removeItem('supabase.auth.token');
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };
  
  return { user, loading, logout, setUser };
}