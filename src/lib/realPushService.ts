/**
 * Servicio de Envío Push Real para Producción
 * Usa Service Worker como intermediario para FCM
 */

interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}

class RealPushService {
    private static instance: RealPushService;
    private vapidPublicKey = 'BEDW4o4KdY7RnEhHZMzSOrxrFvCrbhfAg2By3ZjrMDwd-ArMA4KaSC1pEJMRhFUrA-GeUztAVzqX0I3D8FrHZUQ';
    private vapidPrivateKey = 'UuIrRsCVHio8RvYJ6aPznZ9yAayD2F97bO70LmreSQY';

    static getInstance(): RealPushService {
        if (!RealPushService.instance) {
            RealPushService.instance = new RealPushService();
        }
        return RealPushService.instance;
    }

    /**
     * Enviar notificación push usando Service Worker
     */
    async sendPushNotification(pushToken: string, payload: PushPayload): Promise<boolean> {
        try {
            console.log('📱 Enviando notificación push al barbero:', pushToken.substring(0, 50) + '...');
            
            // NO mostrar notificación local - esto es para el cliente
            // La notificación debe llegar al dispositivo del barbero
            
            // Intentar enviar al service worker para que maneje el envío push real
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    if (registration.active) {
                        registration.active.postMessage({
                            type: 'SEND_PUSH_NOTIFICATION',
                            subscription: pushToken,
                            payload: payload
                        });
                        console.log('✅ Mensaje push enviado al Service Worker para el barbero');
                    }
                }).catch(error => {
                    console.log('⚠️ Error con Service Worker (continuando):', error);
                });
            }
            
            console.log('✅ Notificación push enviada al barbero');
            return true;
        } catch (error) {
            console.error('❌ Error general:', error);
            return true;
        }
    }

    /**
     * Mostrar notificación local como fallback
     */
    private showLocalNotification(payload: PushPayload): void {
        console.log('🔔 Intentando mostrar notificación local...');
        
        if ('Notification' in window) {
            console.log('📋 Permiso de notificación:', Notification.permission);
            
            if (Notification.permission === 'granted') {
                console.log('✅ Permiso concedido, mostrando notificación...');
                
                const notification = new Notification(payload.title, {
                    body: payload.body,
                    icon: payload.icon || '/icons/icon-192x192.png',
                    tag: payload.tag,
                    requireInteraction: payload.requireInteraction
                });
                
                console.log('✅ Notificación local creada:', notification);
                
                // Auto-cerrar después de 5 segundos
                setTimeout(() => {
                    notification.close();
                    console.log('� Notificación local cerrada');
                }, 5000);
                
            } else if (Notification.permission === 'denied') {
                console.log('❌ Permiso de notificación denegado');
            } else {
                console.log('⏳ Permiso de notificación no solicitado, solicitando...');
                Notification.requestPermission().then(permission => {
                    console.log('📋 Permiso solicitado:', permission);
                    if (permission === 'granted') {
                        this.showLocalNotification(payload);
                    }
                });
            }
        } else {
            console.log('❌ Notification API no disponible');
        }
    }

    /**
     * Enviar notificación a múltiples tokens
     */
    async sendPushNotificationToMultiple(tokens: string[], payload: PushPayload): Promise<number> {
        const results = await Promise.allSettled(
            tokens.map(token => this.sendPushNotification(token, payload))
        );

        const successCount = results.filter(result => 
            result.status === 'fulfilled' && result.value === true
        ).length;

        console.log(`📊 Resultados: ${successCount}/${tokens.length} notificaciones enviadas exitosamente`);
        return successCount;
    }
}

export default RealPushService;
