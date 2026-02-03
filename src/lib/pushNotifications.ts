/**
 * Sistema de Notificaciones Push para Barberos
 * Permite enviar notificaciones incluso cuando la app está cerrada
 */

import { supabase } from './supabase';

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
        if (!this.isSupported) {
            console.warn('Push notifications not supported');
            return false;
        }

        // Detección de PWA para iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as { standalone?: boolean }).standalone === true;
        
        if (isIOS && !isStandalone) {
            console.log('iOS detectado - Push solo disponible en PWA instalada');
            return false;
        }

        try {
            // 1. Solicitar permiso de forma segura
            console.log('� Solicitando permiso de notificaciones...');
            
            // Verificar estado actual de forma segura
            const currentPermission = typeof Notification !== 'undefined' ? 
                Notification.permission : 'unsupported';
            
            if (currentPermission === 'granted') {
                console.log('✅ Permisos ya concedidos');
                return await this.performSubscription(barberId);
            }
            
            if (currentPermission === 'denied') {
                console.log('❌ Permiso denegado');
                return false;
            }

            const permission = await Notification.requestPermission();
            console.log('📋 Permiso obtenido:', permission);
            
            if (permission !== 'granted') {
                console.log('❌ Permiso denegado');
                return false;
            }

            // 2. Realizar suscripción
            return await this.performSubscription(barberId);
        } catch (error) {
            console.error('❌ Error en suscripción push:', error);
            return false;
        }
    }

    /**
     * Realizar la suscripción push (método auxiliar)
     */
    private async performSubscription(barberId: string): Promise<boolean> {
        try {
            console.log('🔧 Registrando service worker...');
            const registration = await this.registerServiceWorker();
            console.log('✅ Service worker listo para suscripción');
            
            // VAPID keys - Claves reales generadas
            const applicationServerKey = this.urlBase64ToUint8Array(
                'BEDW4o4KdY7RnEhHZMzSOrxrFvCrbhfAg2By3ZjrMDwd-ArMA4KaSC1pEJMRhFUrA-GeUztAVzqX0I3D8FrHZUQ'
            );

            console.log('🔑 Suscribiendo a push notifications...');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as BufferSource
            });
            console.log('✅ Suscripción exitosa:', subscription);

            // Guardar token en la base de datos
            console.log('💾 Guardando token en base de datos para barbero:', barberId);
            await this.saveTokenToDatabase(barberId, subscription as unknown as CustomPushSubscription);
            
            this.subscription = subscription as unknown as CustomPushSubscription;
            console.log('🎉 Sistema push completado exitosamente');
            return true;
        } catch (error) {
            console.error('❌ Error en performSubscription:', error);
            return false;
        }
    }

    /**
     * Guardar token de push en la base de datos
     */
    async saveTokenToDatabase(barberId: string, subscription: CustomPushSubscription): Promise<void> {
        try {
            console.log('📝 Preparando datos para guardar:', {
                barber_id: barberId,
                subscription_endpoint: subscription.endpoint,
                p256dh_key: subscription.keys.p256dh.substring(0, 20) + '...', // Solo mostrar parte para debug
                auth_key: subscription.keys.auth.substring(0, 10) + '...' // Solo mostrar parte para debug
            });

            // Primero intentar eliminar tokens existentes para este barbero
            await supabase
                .from('barberos_push_tokens')
                .delete()
                .eq('barbero_id', barberId);

            // Luego insertar el nuevo token (solo con columnas existentes)
            const { data, error } = await supabase.from('barberos_push_tokens').insert({
                barbero_id: barberId,
                push_token: JSON.stringify(subscription),
                user_agent: navigator.userAgent,
                is_active: true
            });

            if (error) {
                console.error('❌ Error guardando token push:', error);
                throw error;
            }

            console.log('✅ Token push guardado en base de datos:', data);
        } catch (error) {
            console.error('❌ Error en saveTokenToDatabase:', error);
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
        console.log('🔧 Iniciando registro de service worker...');
        
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Worker no soportado');
        }

        try {
            // Intentar registrar el service worker
            const registration = await navigator.serviceWorker.register('/push-sw.js', {
                scope: '/'
            });
            
            console.log('✅ Service worker registrado:', registration.scope);
            
            // Esperar a que esté activo
            if (registration.active) {
                console.log('✅ Service worker ya está activo');
            } else {
                console.log('⏳ Esperando activación del service worker...');
                await new Promise((resolve) => {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'activated') {
                                    console.log('✅ Service worker activado');
                                    resolve(undefined);
                                }
                            });
                        }
                    });
                    
                    // Si ya está instalado, resolver inmediatamente
                    if (registration.installing) {
                        registration.installing.addEventListener('statechange', () => {
                            if (registration.installing?.state === 'activated') {
                                console.log('✅ Service worker activado');
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
            console.error('❌ Error registrando service worker:', error);
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
