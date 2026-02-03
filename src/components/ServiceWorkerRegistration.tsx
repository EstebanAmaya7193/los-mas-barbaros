'use client';

import { useEffect } from 'react';
import { logPushInfo, logPushSuccess, logPushError, logPushWarn } from '@/lib/pushLogger';

/**
 * Componente que registra el Service Worker automáticamente
 * Especialmente importante para iOS PWA donde el SW es crítico
 */
export default function ServiceWorkerRegistration() {
    useEffect(() => {
        // Solo ejecutar en el cliente
        if (typeof window === 'undefined') {
            logPushWarn('ServiceWorkerRegistration: Running on server, skipping');
            return;
        }

        logPushInfo('ServiceWorkerRegistration: Component mounted');

        // Diagnóstico detallado
        const diagnostics = {
            hasNavigator: typeof navigator !== 'undefined',
            hasWindow: typeof window !== 'undefined',
            hasServiceWorkerAPI: 'serviceWorker' in navigator,
            navigatorServiceWorker: navigator.serviceWorker,
            isSecureContext: window.isSecureContext,
            protocol: window.location.protocol,
            origin: window.location.origin,
            userAgent: navigator.userAgent,
            isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        };

        logPushInfo('ServiceWorkerRegistration: Diagnostics', diagnostics);

        // Verificar contexto seguro
        if (!window.isSecureContext) {
            logPushError('ServiceWorkerRegistration: Not in secure context', {
                protocol: window.location.protocol,
                message: 'Service Workers require HTTPS'
            });
            return;
        }

        // Verificar soporte de Service Worker con mayor detalle
        if (!('serviceWorker' in navigator)) {
            logPushWarn('ServiceWorkerRegistration: Service Worker API not in navigator', {
                navigatorKeys: Object.keys(navigator).filter(k => k.toLowerCase().includes('service')),
                suggestion: 'Browser may not support Service Workers'
            });
            return;
        }

        if (!navigator.serviceWorker) {
            logPushWarn('ServiceWorkerRegistration: navigator.serviceWorker is undefined');
            return;
        }

        // Función para registrar el Service Worker
        const registerServiceWorker = async () => {
            try {
                logPushInfo('ServiceWorkerRegistration: Starting registration...');

                // Intentar obtener el registro existente primero
                const existingRegistration = await navigator.serviceWorker.getRegistration('/');

                if (existingRegistration) {
                    logPushSuccess('ServiceWorkerRegistration: Found existing registration', {
                        scope: existingRegistration.scope,
                        active: !!existingRegistration.active,
                        installing: !!existingRegistration.installing,
                        waiting: !!existingRegistration.waiting
                    });
                    return existingRegistration;
                }

                logPushInfo('ServiceWorkerRegistration: No existing registration, creating new one');

                // Registrar el service worker
                const registration = await navigator.serviceWorker.register('/push-sw.js', {
                    scope: '/',
                    updateViaCache: 'none', // Crítico para iOS
                    type: 'classic' // Especificar tipo explícitamente
                });

                logPushSuccess('ServiceWorkerRegistration: Registration successful', {
                    scope: registration.scope,
                    active: !!registration.active,
                    installing: !!registration.installing,
                    waiting: !!registration.waiting
                });

                // Esperar a que se active
                if (registration.installing) {
                    logPushInfo('ServiceWorkerRegistration: Service Worker installing...');
                    registration.installing.addEventListener('statechange', (e: Event) => {
                        const sw = e.target as ServiceWorker;
                        logPushInfo('ServiceWorkerRegistration: State changed', { state: sw.state });
                        if (sw.state === 'activated') {
                            logPushSuccess('ServiceWorkerRegistration: Service Worker activated!');
                        }
                    });
                } else if (registration.waiting) {
                    logPushInfo('ServiceWorkerRegistration: Service Worker waiting');
                } else if (registration.active) {
                    logPushSuccess('ServiceWorkerRegistration: Service Worker already active');
                }

                // Verificar actualizaciones periódicamente
                const updateInterval = setInterval(() => {
                    registration.update().catch((error) => {
                        logPushError('ServiceWorkerRegistration: Error updating Service Worker', error);
                    });
                }, 60000); // Cada minuto

                // Manejar actualizaciones del SW
                registration.addEventListener('updatefound', () => {
                    logPushInfo('ServiceWorkerRegistration: Update found');
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                logPushInfo('ServiceWorkerRegistration: New Service Worker available');
                            }
                        });
                    }
                });

                return registration;

            } catch (error) {
                logPushError('ServiceWorkerRegistration: Registration failed', error);

                // Logging adicional del error
                if (error instanceof Error) {
                    logPushError('ServiceWorkerRegistration: Error details', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack?.substring(0, 200)
                    });
                }
            }
        };

        // Registrar con un pequeño delay para asegurar que el navegador esté listo
        const timer = setTimeout(() => {
            registerServiceWorker();
        }, 100);

        // Limpiar al desmontar
        return () => {
            clearTimeout(timer);
        };
    }, []);

    // Este componente no renderiza nada
    return null;
}
