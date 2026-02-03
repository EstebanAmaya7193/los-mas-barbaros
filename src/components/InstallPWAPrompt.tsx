'use client';

import { useEffect, useState } from 'react';
import { logPushInfo, logPushDebug } from '@/lib/pushLogger';

interface InstallPWAPromptProps {
    onDismiss: () => void;
    onInstalled?: () => void;
}

export default function InstallPWAPrompt({ onDismiss, onInstalled }: InstallPWAPromptProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        logPushInfo('PWA Install Prompt shown');
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const handleDismiss = () => {
        logPushDebug('User dismissed PWA install prompt');
        setIsVisible(false);
        setTimeout(() => onDismiss(), 300);
    };

    const handleUnderstood = () => {
        logPushInfo('User acknowledged PWA installation instructions');
        setIsVisible(false);
        setTimeout(() => {
            onDismiss();
            onInstalled?.();
        }, 300);
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'
            }`}>
            <div className={`glass-card-strong w-full max-w-md rounded-[32px] p-6 shadow-2xl transform transition-all duration-300 max-h-[90vh] overflow-y-auto ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
                }`}>
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-blue-500 text-3xl">install_mobile</span>
                    </div>
                    <h3 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">
                        Instala la App
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        Para recibir notificaciones en iOS, primero debes instalar la app en tu pantalla de inicio
                    </p>
                </div>

                {/* Instructions */}
                <div className="space-y-4 mb-6">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                            1
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                                Toca el botón de compartir
                            </p>
                            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                <span className="material-symbols-outlined text-blue-500 text-xl">ios_share</span>
                                <span>En la barra inferior de Safari</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                            2
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                                Selecciona "Agregar a pantalla de inicio"
                            </p>
                            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                <span className="material-symbols-outlined text-blue-500 text-xl">add_box</span>
                                <span>Desplázate hacia abajo en el menú</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                            3
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                                Confirma y abre la app
                            </p>
                            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                <span className="material-symbols-outlined text-blue-500 text-xl">check_circle</span>
                                <span>Toca "Agregar" y luego abre desde tu pantalla de inicio</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Note */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
                    <div className="flex gap-2">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl flex-shrink-0">info</span>
                        <p className="text-xs text-blue-900 dark:text-blue-200">
                            <strong>Importante:</strong> Las notificaciones push solo funcionan cuando abres la app desde la pantalla de inicio, no desde Safari.
                        </p>
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleUnderstood}
                        className="w-full h-12 bg-blue-500 text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">check</span>
                        Entendido, instalaré la app
                    </button>

                    <button
                        onClick={handleDismiss}
                        className="w-full h-10 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                    >
                        Recordar más tarde
                    </button>
                </div>
            </div>
        </div>
    );
}
