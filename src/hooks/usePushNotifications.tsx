/**
 * Hook completo para manejar notificaciones push con base de datos
 */

import PushNotificationManager from '@/lib/pushNotifications';
import { useEffect, useState } from 'react';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  requestPermission: (barberId: string) => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      const permission = Notification.permission;
      setIsEnabled(permission === 'granted');
    }
  }, []);

  const subscribeToPush = async () => {
    const pushManager = PushNotificationManager.getInstance();
    // Necesitamos el barberId para suscribirse
    // Esto debería ser llamado desde el componente con el ID del barbero
    console.log('⚠️ subscribeToPush requiere barberId');
    return false;
  };

  const requestPermission = async (barberId: string): Promise<boolean> => {
    if (!isSupported || !barberId) {
      return false;
    }

    setIsLoading(true);
    try {
      const requestPermission = async () => {
        try {
          console.log('🔔 Solicitando permiso de notificaciones...');
          
          // Verificar si ya tenemos permiso
          if (Notification.permission === 'granted') {
            console.log('✅ Permisos ya concedidos');
            await subscribeToPush();
            return true;
          }
          
          if (Notification.permission === 'denied') {
            console.log('❌ Permisos denegados previamente');
            return false;
          }
          
          // Solicitar permiso con mejor manejo
          const permission = await Notification.requestPermission();
          console.log('📋 Permiso obtenido:', permission);
          
          if (permission === 'granted') {
            console.log('✅ Permisos concedidos, suscribiendo...');
            // Usar el método correcto del PushNotificationManager
            const pushManager = PushNotificationManager.getInstance();
            const success = await pushManager.requestPermissionAndSubscribe(barberId);
            if (success) {
              setIsEnabled(true);
            } else {
              setIsEnabled(false);
            }
            return success;
          } else if (permission === 'denied') {
            console.log('❌ Permisos denegados');
            return false;
          } else {
            console.log('⏳ Permisos no decididos');
            return false;
          }
        } catch (error) {
          console.error('❌ Error solicitando permisos:', error);
          return false;
        }
      };
      return await requestPermission();
    } catch (error) {
      console.error('Error requesting push permission:', error);
      setIsEnabled(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async (): Promise<void> => {
    if (!isEnabled) return;

    try {
      const pushManager = PushNotificationManager.getInstance();
      await pushManager.sendTestNotification();
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  return {
    isSupported,
    isEnabled,
    isLoading,
    requestPermission,
    sendTestNotification
  };
}

/**
 * Componente para solicitar permisos de notificaciones push
 */
export function PushNotificationPrompt({ barberId, onClose }: { barberId: string; onClose?: () => void }) {
  const { isSupported, isEnabled, isLoading, requestPermission } = usePushNotifications();

  const handleActivate = async () => {
    const success = await requestPermission(barberId);
    // Cerrar siempre, independientemente del resultado
    if (onClose) {
      onClose();
    }
  };

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    }
  };

  // No mostrar si no está soportado o ya está habilitado
  if (!isSupported || isEnabled) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm">
      <div className="glass-card-strong rounded-2xl p-4 shadow-2xl border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-xl">notifications</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-primary mb-1">
              🔔 Activa las Notificaciones Push
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Recibe alertas instantáneas en cualquier dispositivo, incluso cuando la app esté cerrada.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleActivate}
                disabled={isLoading}
                className="flex-1 bg-primary text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {isLoading ? 'Activando...' : 'Activar'}
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
