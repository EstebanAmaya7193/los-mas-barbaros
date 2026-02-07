
import React from 'react';

interface SystemModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'alert' | 'confirm';
    variant?: 'info' | 'success' | 'warning' | 'danger';
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

export default function SystemModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'alert',
    variant = 'info',
    onConfirm,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar'
}: SystemModalProps) {
    if (!isOpen) return null;

    // Variant styles
    const getIcon = () => {
        switch (variant) {
            case 'success': return 'check_circle';
            case 'warning': return 'warning';
            case 'danger': return 'error';
            default: return 'info';
        }
    };

    const getIconColor = () => {
        switch (variant) {
            case 'success': return 'text-green-500';
            case 'warning': return 'text-yellow-500';
            case 'danger': return 'text-red-500';
            default: return 'text-blue-500';
        }
    };

    const getIconBg = () => {
        switch (variant) {
            case 'success': return 'bg-green-100 dark:bg-green-900/30';
            case 'warning': return 'bg-yellow-100 dark:bg-yellow-900/30';
            case 'danger': return 'bg-red-100 dark:bg-red-900/30';
            default: return 'bg-blue-100 dark:bg-blue-900/30';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
            <div className="glass-card-strong w-full max-w-sm rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-full ${getIconBg()} flex items-center justify-center mb-4`}>
                        <span className={`material-symbols-outlined ${getIconColor()} text-2xl`}>
                            {getIcon()}
                        </span>
                    </div>

                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                        {title}
                    </h3>

                    <p className="text-neutral-600 dark:text-neutral-300 text-sm mb-6 leading-relaxed">
                        {message}
                    </p>

                    <div className="flex gap-3 w-full">
                        {type === 'confirm' && (
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                {cancelText}
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if (onConfirm) onConfirm();
                                onClose();
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] ${variant === 'danger'
                                    ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-red-500/25'
                                    : 'bg-gradient-to-r from-blue-600 to-blue-500 shadow-blue-500/25'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
