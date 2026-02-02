/**
 * Servicio de Envío Push Real para Producción
 * Usa Backend API como intermediario para FCM
 */

import { sendPushViaBackend } from './backendPushService';

interface VAPIDKeys {
    publicKey: string;
    privateKey: string;
}

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
    data?: unknown;
    requireInteraction?: boolean;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}

export class RealPushService {
    private static instance: RealPushService;
    private vapidKeys: VAPIDKeys = {
        publicKey: 'BEDW4o4KdY7RnEhHZMzSOrxrFvCrbhfAg2By3ZjrMDwd-ArMA4KaSC1pEJMRhFUrA-GeUztAVzqX0I3D8FrHZUQ',
        privateKey: 'UuIrRsCVHio8RvYJ6aPznZ9yAayD2F97bO70LmreSQY'
    };

    constructor() {
        // Nota: web-push es para Node.js, en browser necesitamos otro enfoque
        // Por ahora usamos el service worker como intermediario
    }

    static getInstance(): RealPushService {
        if (!RealPushService.instance) {
            RealPushService.instance = new RealPushService();
        }
        return RealPushService.instance;
    }

    /**
     * Enviar notificación push usando Backend API
     */
    async sendPushNotification(pushToken: string, payload: PushPayload): Promise<boolean> {
        try {
            console.log('Enviando notificación push al barbero:', pushToken.substring(0, 50) + '...');
            
            // Parsear el token de suscripción para validación
            let subscription;
            try {
                subscription = JSON.parse(pushToken);
                console.log('Suscripción parseada:', {
                    endpoint: subscription.endpoint,
                    hasKeys: !!subscription.keys,
                    keysType: typeof subscription.keys
                });
            } catch (parseError) {
                console.error('Error parseando token:', parseError);
                return false;
            }
            
            // Enviar via backend API
            const success = await sendPushViaBackend(pushToken, payload);
            
            if (success) {
                console.log('Notificación push enviada exitosamente via backend');
                return true;
            } else {
                console.error('Error en backend push');
                
                // Fallback: enviar al service worker local para debug
                return this.sendToServiceWorker(subscription, payload);
            }
            
        } catch (error) {
            console.error('Error general:', error);
            return false;
        }
    }

    /**
     * Enviar al service worker local como fallback para debug
     */
    private async sendToServiceWorker(subscription: PushSubscription, payload: PushPayload): Promise<boolean> {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if (registration.active) {
                    registration.active.postMessage({
                        type: 'SEND_PUSH_NOTIFICATION',
                        subscription: subscription,
                        payload: payload
                    });
                    console.log('Mensaje enviado al Service Worker local para debug');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error enviando a Service Worker:', error);
            return false;
        }
    }

    /**
     * Mostrar notificación local como fallback
     */
    private showLocalNotification(payload: PushPayload): void {
        console.log('Intentando mostrar notificación local...');
        
        if ('Notification' in window) {
            console.log('Permiso de notificación:', Notification.permission);
            
            if (Notification.permission === 'granted') {
                console.log('Permiso concedido, mostrando notificación...');
                
                const notification = new Notification(payload.title, {
                    body: payload.body,
                    icon: payload.icon || '/icons/icon-192x192.png',
                    tag: payload.tag,
                    requireInteraction: payload.requireInteraction
                });
                
                console.log('Notificación local creada:', notification);
                
                // Auto-cerrar después de 5 segundos
                setTimeout(() => {
                    notification.close();
                    console.log('Notificación local cerrada');
                }, 5000);
                
            } else if (Notification.permission === 'denied') {
                console.log('Permiso de notificación denegado');
            } else {
                console.log('Permiso de notificación no solicitado, solicitando...');
                Notification.requestPermission().then(permission => {
                    console.log('Permiso solicitado:', permission);
                    if (permission === 'granted') {
                        this.showLocalNotification(payload);
                    }
                });
            }
        } else {
            console.log('Notification API no disponible');
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

        const failedCount = results.filter(result => 
            result.status === 'rejected' || (result.status === 'fulfilled' && result.value === false)
        ).length;

        if (failedCount > 0) {
            console.log(`${failedCount} notificaciones fallaron, ${successCount} exitosas`);
        }

        console.log(`Resultados: ${successCount}/${tokens.length} notificaciones enviadas exitosamente`);
        return successCount;
    }
}

export default RealPushService;
