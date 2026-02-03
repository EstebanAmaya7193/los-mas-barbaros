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
        if (typeof window === 'undefined') return;

        // Verificar soporte de Service Worker
        if (!('serviceWorker' in navigator)) {
            logPushWarn('Service Worker not supported in this browser');
            return;
        }

        // Función para registrar el Service Worker
        const registerServiceWorker = async () => {
            try {
                logPushInfo('Attempting to register Service Worker...');

                // Registrar el service worker
                const registration = await navigator.serviceWorker.register('/push-sw.js', {
                    scope: '/',
                    updateViaCache: 'none' // Importante para iOS
                });

                logPushSuccess('Service Worker registered successfully', {
                    scope: registration.scope,
                    active: !!registration.active,
                    installing: !!registration.installing,
                    waiting: !!registration.waiting
                });

                // Esperar a que se active
                if (registration.installing) {
                    logPushInfo('Service Worker installing...');
                    registration.installing.addEventListener('statechange', (e: Event) => {
                        const sw = e.target as ServiceWorker;
                        logPushInfo('Service Worker state changed', { state: sw.state });
                        if (sw.state === 'activated') {
                            logPushSuccess('Service Worker activated');
                        }
                    });
                } else if (registration.waiting) {
                    logPushInfo('Service Worker waiting');
                } else if (registration.active) {
                    logPushSuccess('Service Worker already active');
                }

                // Verificar actualizaciones periódicamente
                setInterval(() => {
                    registration.update().catch((error) => {
                        logPushError('Error updating Service Worker', error);
                    });
                }, 60000); // Cada minuto

                // Manejar actualizaciones del SW
                registration.addEventListener('updatefound', () => {
                    logPushInfo('Service Worker update found');
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                logPushInfo('New Service Worker available - reload to update');
                            }
                        });
                    }
                });

            } catch (error) {
                logPushError('Failed to register Service Worker', error);
            }
        };

        // Registrar inmediatamente
        registerServiceWorker();

        // Limpiar al desmontar (aunque rara vez sucede con layout)
        return () => {
            // No hay limpieza necesaria, el SW persiste
        };
    }, []);

    // Este componente no renderiza nada
    return null;
}
