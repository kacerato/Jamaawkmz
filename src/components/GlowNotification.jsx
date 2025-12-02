import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const GlowNotification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Espera a animação de saída
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);
  
  if (!notification && !isVisible) return null;
  
  const styles = {
    success: {
      border: 'border-green-500',
      shadow: 'shadow-[0_0_30px_-5px_rgba(34,197,94,0.6)]',
      text: 'text-green-400',
      bg: 'bg-green-950/90',
      icon: <CheckCircle className="w-6 h-6 text-green-400 animate-pulse" />
    },
    error: {
      border: 'border-red-500',
      shadow: 'shadow-[0_0_30px_-5px_rgba(239,68,68,0.6)]',
      text: 'text-red-400',
      bg: 'bg-red-950/90',
      icon: <XCircle className="w-6 h-6 text-red-400 animate-pulse" />
    },
    info: {
      border: 'border-cyan-500',
      shadow: 'shadow-[0_0_30px_-5px_rgba(6,182,212,0.6)]',
      text: 'text-cyan-400',
      bg: 'bg-slate-900/90',
      icon: <Info className="w-6 h-6 text-cyan-400 animate-pulse" />
    }
  };
  
  const currentStyle = styles[notification?.type || 'info'];
  
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[11000] w-[90%] max-w-sm transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className={`relative flex items-center gap-4 p-4 rounded-xl border ${currentStyle.border} ${currentStyle.bg} backdrop-blur-xl ${currentStyle.shadow}`}>
        {/* Glow interno animado */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-20 animate-shimmer pointer-events-none" />
        
        <div className="flex-shrink-0">
          {currentStyle.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-sm uppercase tracking-wider ${currentStyle.text}`}>
            {notification?.title}
          </h4>
          <p className="text-gray-200 text-xs mt-0.5 font-medium leading-relaxed">
            {notification?.message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GlowNotification;