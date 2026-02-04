/**
 * Hook simplificado para manejar notificaciones push
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

export function usePushNotificationsSimple(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      const permission = Notification.permission;
      setIsEnabled(permission === 'granted');
    }
  }, []);

  const requestPermission = async (barberId: string): Promise<boolean> => {
    if (!isSupported || !barberId) {
      return false;
    }

    setIsLoading(true);

    try {
      const pushManager = PushNotificationManager.getInstance();
      const success = await pushManager.requestPermissionAndSubscribe(barberId);
      setIsEnabled(success);
      return success;
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
 * Componente para solicitar permisos de notificaciones
 */
export function PushNotificationPromptSimple({ barberId }: { barberId: string }) {
  const { isSupported, isEnabled, isLoading, requestPermission } = usePushNotificationsSimple();

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
              🔔 Activa las Notificaciones
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Recibe alertas instantáneas de nuevas citas, cancelaciones y turnos presenciales, incluso cuando la app esté cerrada.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => requestPermission(barberId)}
                disabled={isLoading}
                className="flex-1 bg-primary text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    Activando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Activar
                  </>
                )}
              </button>

              <button
                onClick={() => console.log('User declined push notifications')}
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

/**
 * Componente para mostrar estado de notificaciones
 */
export function PushNotificationStatusSimple({ barberId }: { barberId: string }) {
  const { isSupported, isEnabled, sendTestNotification } = usePushNotificationsSimple();

  if (!isSupported) {
    return (
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">notifications_off</span>
        Notificaciones no compatibles
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="text-xs text-orange-500 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">notifications_off</span>
        Notificaciones desactivadas
      </div>
    );
  }

  return (
    <div className="text-xs text-green-500 flex items-center gap-1">
      <span className="material-symbols-outlined text-sm">notifications_active</span>
      Notificaciones activas
      {/* Test notification button - DISABLED (notifications working on newer iPhones) */}
      {/* Uncomment to enable test button */}
      {/* <button
        onClick={sendTestNotification}
        className="ml-2 text-xs text-primary hover:underline"
        title="Enviar notificación de prueba"
      >
        Probar
      </button> */}
    </div>
  );
}
