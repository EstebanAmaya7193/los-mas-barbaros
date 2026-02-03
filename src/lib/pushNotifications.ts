/**
 * Sistema de Notificaciones Push para Barberos
 * Permite enviar notificaciones incluso cuando la app está cerrada
 */

import { supabase } from './supabase';
import {
    logPushInfo,
    logPushSuccess,
    logPushWarn,
    logPushError,
    logPushDebug
} from './pushLogger';

// Interfaz personalizada para PushSubscription que coincide con la realidad
interface CustomPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    getKey?(method: string): ArrayBuffer | null;
}

export class PushNotificationManager {
    private static instance: PushNotificationManager;
    private subscription: CustomPushSubscription | null = null;
    private isSupported: boolean = false;

    private constructor() {
        // Validación segura para iOS
        this.isSupported = typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window;

        if (this.isSupported) {
            logPushInfo('PushNotificationManager initialized - Push notifications supported');
        } else {
            logPushWarn('Push notifications not supported in this environment');
        }
    }

    static getInstance(): PushNotificationManager {
        if (!PushNotificationManager.instance) {
            PushNotificationManager.instance = new PushNotificationManager();
        }
        return PushNotificationManager.instance;
    }

    /**
     * Solicitar permiso de notificaciones y suscribirse
     */
    async requestPermissionAndSubscribe(barberId: string): Promise<boolean> {
        logPushInfo('requestPermissionAndSubscribe called', { barberId });

        if (!this.isSupported) {
            logPushWarn('Push notifications not supported');
            return false;
        }

        // Detección de PWA para iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as { standalone?: boolean }).standalone === true;

        logPushInfo('Device detection', { isIOS, isStandalone });

        if (isIOS && !isStandalone) {
            logPushWarn('iOS detected but not in standalone mode - Push only available in installed PWA');
            return false;
        }

        try {
            // 1. Solicitar permiso de forma segura
            logPushInfo('Requesting notification permission...');

            // Verificar estado actual de forma segura
            const currentPermission = typeof Notification !== 'undefined' ?
                Notification.permission : 'unsupported';

            logPushDebug('Current permission status', { currentPermission });

            if (currentPermission === 'granted') {
                logPushSuccess('Permissions already granted');
                return await this.performSubscription(barberId);
            }

            if (currentPermission === 'denied') {
                logPushWarn('Permission previously denied');
                return false;
            }

            const permission = await Notification.requestPermission();
            logPushInfo('Permission request result', { permission });

            if (permission !== 'granted') {
                logPushWarn('Permission denied by user');
                return false;
            }

            // 2. Realizar suscripción
            logPushInfo('Permission granted, proceeding with subscription');
            return await this.performSubscription(barberId);
        } catch (error) {
            logPushError('Error in requestPermissionAndSubscribe', error);
            return false;
        }
    }

    /**
     * Realizar la suscripción push (método auxiliar)
     */
    private async performSubscription(barberId: string): Promise<boolean> {
        try {
            logPushInfo('Starting push subscription process');
            logPushInfo('Registering service worker...');
            const registration = await this.registerServiceWorker();
            logPushSuccess('Service worker ready for subscription');

            // VAPID keys - Claves reales generadas
            const applicationServerKey = this.urlBase64ToUint8Array(
                'BEDW4o4KdY7RnEhHZMzSOrxrFvCrbhfAg2By3ZjrMDwd-ArMA4KaSC1pEJMRhFUrA-GeUztAVzqX0I3D8FrHZUQ'
            );

            logPushInfo('Subscribing to push notifications...');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as BufferSource
            });
            logPushSuccess('Push subscription created', {
                endpoint: subscription.endpoint.substring(0, 50) + '...'
            });

            // Guardar token en la base de datos
            logPushInfo('Saving token to database', { barberId });
            await this.saveTokenToDatabase(barberId, subscription as unknown as CustomPushSubscription);

            this.subscription = subscription as unknown as CustomPushSubscription;
            logPushSuccess('Push notification system setup completed successfully');
            return true;
        } catch (error) {
            logPushError('Error in performSubscription', error);
            return false;
        }
    }

    /**
     * Guardar token de push en la base de datos
     */
    async saveTokenToDatabase(barberId: string, subscription: CustomPushSubscription): Promise<void> {
        try {
            logPushDebug('Preparing data to save', {
                barber_id: barberId,
                subscription_endpoint: subscription.endpoint.substring(0, 50) + '...',
                p256dh_key: subscription.keys.p256dh.substring(0, 20) + '...',
                auth_key: subscription.keys.auth.substring(0, 10) + '...'
            });

            // Primero intentar eliminar tokens existentes para este barbero
            logPushInfo('Removing existing tokens for barber', { barberId });
            await supabase
                .from('barberos_push_tokens')
                .delete()
                .eq('barbero_id', barberId);

            // Luego insertar el nuevo token (solo con columnas existentes)
            logPushInfo('Inserting new push token to database');
            const { data, error } = await supabase.from('barberos_push_tokens').insert({
                barbero_id: barberId,
                push_token: JSON.stringify(subscription),
                user_agent: navigator.userAgent,
                is_active: true
            });

            if (error) {
                logPushError('Error saving push token to database', error);
                throw error;
            }

            logPushSuccess('Push token saved to database successfully');
        } catch (error) {
            logPushError('Error in saveTokenToDatabase', error);
            throw error;
        }
    }

    /**
     * Eliminar token de push de la base de datos
     */
    async removeTokenFromDatabase(barberId: string, subscription: PushSubscription): Promise<void> {
        try {
            const { error } = await supabase
                .from('barberos_push_tokens')
                .delete()
                .eq('barbero_id', barberId)
                .eq('push_token', JSON.stringify(subscription));

            if (error) {
                console.error('Error eliminando token push:', error);
                throw error;
            }

            console.log('✅ Token push eliminado de la base de datos');
        } catch (error) {
            console.error('Error en removeTokenFromDatabase:', error);
            throw error;
        }
    }

    /**
     * Obtener tokens activos de un barbero
     */
    async getBarberTokens(barberId: string): Promise<string[]> {
        try {
            const { data, error } = await supabase
                .from('barberos_push_tokens')
                .select('push_token')
                .eq('barbero_id', barberId)
                .eq('is_active', true);

            if (error) {
                console.error('Error obteniendo tokens:', error);
                return [];
            }

            return data?.map(item => item.push_token) || [];
        } catch (error) {
            console.error('Error en getBarberTokens:', error);
            return [];
        }
    }

    /**
     * Enviar notificación de prueba
     */
    async sendTestNotification(): Promise<void> {
        if (!this.isSupported) {
            console.warn('Push notifications not supported');
            return;
        }

        try {
            await this.registerServiceWorker();
            const registration = await navigator.serviceWorker.ready;

            await registration.showNotification('🔔 Notificación de Prueba', {
                body: '¡Las notificaciones push están funcionando!',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                data: {
                    type: 'test',
                    url: '/admin/barber'
                }
            });
        } catch (error) {
            console.error('Error sending test notification:', error);
        }
    }

    /**
     * Verificar si las notificaciones están habilitadas
     */
    async isEnabled(): Promise<boolean> {
        if (!this.isSupported) return false;

        // Acceso seguro a Notification.permission
        try {
            const permission = typeof Notification !== 'undefined' ?
                Notification.permission : 'unsupported';
            return permission === 'granted';
        } catch {
            return false;
        }
    }

    /**
     * Registrar service worker de forma robusta
     */
    async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
        logPushInfo('Starting service worker registration...');

        if (!('serviceWorker' in navigator)) {
            const error = new Error('Service Worker no soportado');
            logPushError('Service Worker not supported', error);
            throw error;
        }

        try {
            // Intentar registrar the service worker
            logPushDebug('Registering /push-sw.js with scope /');
            const registration = await navigator.serviceWorker.register('/push-sw.js', {
                scope: '/'
            });

            logPushSuccess('Service worker registered', { scope: registration.scope });

            // Esperar a que esté activo
            if (registration.active) {
                logPushInfo('Service worker already active');
            } else {
                logPushInfo('Waiting for service worker activation...');
                await new Promise((resolve) => {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'activated') {
                                    logPushSuccess('Service worker activated');
                                    resolve(undefined);
                                }
                            });
                        }
                    });

                    // Si ya está instalado, resolver inmediatamente
                    if (registration.installing) {
                        registration.installing.addEventListener('statechange', () => {
                            if (registration.installing?.state === 'activated') {
                                logPushSuccess('Service worker activated');
                                resolve(undefined);
                            }
                        });
                    } else if (registration.active) {
                        resolve(undefined);
                    }
                });
            }

            return registration;
        } catch (error) {
            logPushError('Error registering service worker', error);
            throw error;
        }
    }

    /**
     * Convertir base64 a Uint8Array para VAPID
     */
    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

export default PushNotificationManager;
