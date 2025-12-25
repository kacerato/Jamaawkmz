// components/GlowNotification.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

interface NotificationType {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface GlowNotificationProps {
  notification: NotificationType | null;
  onClose: () => void;
}

const GlowNotification: React.FC<GlowNotificationProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    if (notification) {
      setShouldRender(true);
      // Pequeno delay para permitir que o navegador renderize antes de animar a entrada
      requestAnimationFrame(() => setIsVisible(true));
      
      // Timer para iniciar a saída
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  // Quando a animação de saída termina, remove do DOM e limpa o estado pai
  const handleTransitionEnd = () => {
    if (!isVisible) {
      setShouldRender(false);
      onClose();
    }
  };
  
  if (!shouldRender && !notification) return null;
  
  const styles = {
    success: { border: 'border-green-500/50', bg: 'bg-green-950/90', text: 'text-green-400', icon: <CheckCircle className="w-5 h-5" /> },
    error: { border: 'border-red-500/50', bg: 'bg-red-950/90', text: 'text-red-400', icon: <XCircle className="w-5 h-5" /> },
    warning: { border: 'border-yellow-500/50', bg: 'bg-yellow-950/90', text: 'text-yellow-400', icon: <AlertTriangle className="w-5 h-5" /> },
    info: { border: 'border-cyan-500/50', bg: 'bg-slate-900/90', text: 'text-cyan-400', icon: <Info className="w-5 h-5" /> }
  };
  
  const type = notification?.type || 'info';
  const currentStyle = styles[type] || styles.info;
  
  return (
    <div 
      className={`fixed top-4 left-4 right-4 z-[11000] flex justify-center transition-all duration-500 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className={`relative w-full max-w-sm flex items-center gap-3 p-3 rounded-xl border backdrop-blur-md shadow-2xl ${currentStyle.bg} ${currentStyle.border}`}>
        <div className={`p-2 rounded-full bg-black/20 ${currentStyle.text}`}>
          {currentStyle.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-sm ${currentStyle.text}`}>{notification?.title}</h4>
          <p className="text-white/80 text-xs leading-tight">{notification?.message}</p>
        </div>

        <button 
          onClick={() => setIsVisible(false)}
          className="p-1 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default GlowNotification;
