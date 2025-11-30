import React, { useEffect } from 'react';
import { Check, AlertTriangle, X, Info } from 'lucide-react';

const GlowNotification = ({ type = 'info', message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  if (!message) return null;
  
  const styles = {
    success: 'border-green-500/30 bg-green-950/80 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]',
    error: 'border-red-500/30 bg-red-950/80 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    info: 'border-cyan-500/30 bg-slate-900/90 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    warning: 'border-yellow-500/30 bg-yellow-950/80 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]'
  };
  
  const Icon = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info
  } [type];
  
  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[10000] animate-slide-in-bottom w-[90%] max-w-sm">
      <div className={`flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-xl ${styles[type]}`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold text-sm">{message}</span>
      </div>
    </div>
  );
};

export default GlowNotification;