// components/GlowToast.jsx
import React, { useEffect } from 'react';

const GlowToast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);
  
  const typeConfig = {
    success: {
      border: 'border-green-500',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
      bg: 'bg-green-500/10',
      icon: '✅'
    },
    error: {
      border: 'border-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      bg: 'bg-red-500/10',
      icon: '❌'
    },
    warning: {
      border: 'border-yellow-500',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      bg: 'bg-yellow-500/10',
      icon: '⚠️'
    },
    info: {
      border: 'border-cyan-500',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
      bg: 'bg-cyan-500/10',
      icon: 'ℹ️'
    }
  };
  
  const config = typeConfig[type];
  
  return (
    <div className={`fixed top-4 right-4 z-[10000] p-4 rounded-xl border backdrop-blur-xl ${config.border} ${config.glow} ${config.bg} text-white animate-scale-in`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{config.icon}</span>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};

export default GlowToast;