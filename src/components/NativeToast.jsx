import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const NativeToast = ({ message, type = 'info', isVisible, onClose }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300); // Espera animação de saída
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible && !show) return null;

  const getStyle = () => {
    switch(type) {
      case 'success': return 'bg-slate-900/90 border-l-4 border-green-500 text-white';
      case 'error': return 'bg-slate-900/90 border-l-4 border-red-500 text-white';
      case 'locked': return 'bg-amber-900/90 border-l-4 border-amber-500 text-white';
      default: return 'bg-slate-900/90 border-l-4 border-cyan-500 text-white';
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error': return <X className="w-5 h-5 text-red-400" />;
      case 'locked': return <AlertCircle className="w-5 h-5 text-amber-400" />;
      default: return <Info className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div 
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[11000] w-[90vw] max-w-sm rounded-lg shadow-2xl backdrop-blur-md p-4 transition-all duration-300 transform ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      } ${getStyle()}`}
      style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)' }}
    >
      <div className="flex items-center gap-3">
        {getIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium leading-tight">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default NativeToast;