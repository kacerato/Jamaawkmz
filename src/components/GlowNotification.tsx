import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface NotificationData {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface GlowNotificationProps {
  notification: NotificationData | null;
  onClose: () => void;
}

const GlowNotification: React.FC<GlowNotificationProps> = ({ notification, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification && !visible) return null;

  const getColors = () => {
    switch (notification?.type) {
      case 'success':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/50 text-green-400 shadow-green-900/20';
      case 'error':
        return 'from-red-500/20 to-rose-500/20 border-red-500/50 text-red-400 shadow-red-900/20';
      case 'warning':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/50 text-yellow-400 shadow-yellow-900/20';
      default:
        return 'from-blue-500/20 to-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-cyan-900/20';
    }
  };

  const getIcon = () => {
    switch (notification?.type) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />; // Or specific warning icon
      default: return <Info className="w-5 h-5" />;
    }
  };

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${
        visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className={`relative flex items-center gap-3 px-4 py-3 bg-slate-900/90 backdrop-blur-xl border rounded-xl shadow-2xl min-w-[300px] max-w-[90vw] bg-gradient-to-r ${getColors()}`}>

        {/* Glow Effect */}
        <div className={`absolute inset-0 rounded-xl opacity-20 blur-md bg-gradient-to-r ${getColors().split(' ')[0]} -z-10`}></div>

        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 mr-2">
          <h4 className="text-sm font-bold text-white leading-tight mb-0.5">{notification?.title}</h4>
          <p className="text-xs opacity-90 leading-tight">{notification?.message}</p>
        </div>

        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>
    </div>
  );
};

export default GlowNotification;
