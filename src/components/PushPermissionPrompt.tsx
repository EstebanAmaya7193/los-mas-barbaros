'use client';

import { useState, useEffect } from 'react';

interface PushPermissionPromptProps {
    onAccept: () => void;
    onDismiss: () => void;
}

export default function PushPermissionPrompt({ onAccept, onDismiss }: PushPermissionPromptProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);

    useEffect(() => {
        // Animación de entrada
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const handleAccept = async () => {
        setIsRequesting(true);
        
        try {
            console.log('🔔 Solicitando permiso de notificaciones...');
            
            // Verificar estado actual
            if (Notification.permission === 'granted') {
                console.log('✅ Permisos ya concedidos');
                onAccept();
                return;
            }
            
            if (Notification.permission === 'denied') {
                console.log('❌ Permisos denegados previamente');
                onDismiss();
                return;
            }
            
            // Solicitar permiso (esto debe ser triggered por un gesto del usuario)
            const permission = await Notification.requestPermission();
            console.log('📋 Permiso obtenido:', permission);
            
            if (permission === 'granted') {
                console.log('✅ Permisos concedidos');
                onAccept();
            } else {
                console.log('❌ Permisos denegados o no decididos');
                onDismiss();
            }
        } catch (error) {
            console.error('❌ Error solicitando permisos:', error);
            onDismiss();
        } finally {
            setIsRequesting(false);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(() => onDismiss(), 300);
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 transition-all duration-300 ${
            isVisible ? 'opacity-100' : 'opacity-0'
        }`}>
            <div className={`glass-card-strong w-full max-w-sm rounded-[32px] p-6 shadow-2xl transform transition-all duration-300 ${
                isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
            }`}>
                {/* Icono y título */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-3xl">notifications</span>
                    </div>
                    <h3 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">
                        ¿Recibir Notificaciones?
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        Te notificaremos cuando tengas nuevas citas para que nunca te pierdas un cliente.
                    </p>
                </div>

                {/* Beneficios */}
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm">check</span>
                        </div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            Alertas instantáneas de nuevas citas
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm">check</span>
                        </div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            Mejor gestión de tu tiempo
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm">check</span>
                        </div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            Nunca más perder una reserva
                        </span>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleAccept}
                        disabled={isRequesting}
                        className="w-full h-12 bg-primary text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRequesting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                                Activando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">notifications_active</span>
                                Activar Notificaciones
                            </>
                        )}
                    </button>
                    
                    <button
                        onClick={handleDismiss}
                        disabled={isRequesting}
                        className="w-full h-10 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                    >
                        Ahora no
                    </button>
                </div>

                {/* Nota de privacidad */}
                <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center mt-4">
                    Puedes desactivar las notificaciones en cualquier momento desde la configuración
                </p>
            </div>
        </div>
    );
}
