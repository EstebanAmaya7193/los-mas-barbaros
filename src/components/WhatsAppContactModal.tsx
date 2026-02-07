'use client';

import { useState } from 'react';

interface WhatsAppContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    clientPhone: string;
    appointmentDate?: string;
    appointmentTime?: string;
}

export default function WhatsAppContactModal({
    isOpen,
    onClose,
    clientName,
    clientPhone,
    appointmentDate,
    appointmentTime
}: WhatsAppContactModalProps) {

    const formatPhoneForWhatsApp = (phone: string): string => {
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleaned.startsWith('+') && !cleaned.startsWith('57')) {
            cleaned = '57' + cleaned;
        }
        return cleaned.replace('+', '');
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString("es-ES", {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    };

    const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${hour12}:${minutes} ${period}`;
    };

    const getMessageTemplate = (template: string): string => {
        switch (template) {
            case 'reminder':
                if (appointmentDate && appointmentTime) {
                    const fecha = formatDate(appointmentDate);
                    const hora = formatTime(appointmentTime);
                    return `Hola ${clientName} ✂️\n\nTe recordamos tu cita programada para el ${fecha} a las ${hora}.\n\nTe esperamos en Los Más Bárbaros 💈`;
                } else {
                    return `Hola ${clientName} ✂️\n\nTe recordamos tu próxima cita.\n\nTe esperamos en Los Más Bárbaros 💈`;
                }
            case 'confirm':
                if (appointmentDate && appointmentTime) {
                    const fecha = formatDate(appointmentDate);
                    const hora = formatTime(appointmentTime);
                    return `Hola ${clientName},\n\n¿Confirmas tu asistencia para el ${fecha} a las ${hora}?\n\nPor favor responde para confirmar tu cita.`;
                } else {
                    return `Hola ${clientName},\n\n¿Confirmas tu asistencia a tu próxima cita?\n\nPor favor responde para confirmar.`;
                }
            default:
                return '';
        }
    };

    const sendWhatsApp = (template: string) => {
        const message = template === 'custom' ? '' : getMessageTemplate(template);
        const phone = formatPhoneForWhatsApp(clientPhone);
        const whatsappUrl = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

        window.open(whatsappUrl, '_blank');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="glass-card-strong rounded-2xl p-6 w-full max-w-sm">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-neutral-800 dark:text-white">
                        Mensaje a {clientName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-400">close</span>
                    </button>
                </div>

                {/* Template Options */}
                <div className="space-y-3 mb-6">
                    {/* Recordatorio */}
                    <button
                        onClick={() => sendWhatsApp('reminder')}
                        className="w-full glass-panel p-4 rounded-xl flex items-center gap-3 hover:bg-white/80 dark:hover:bg-neutral-800/80 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">schedule</span>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-neutral-800 dark:text-white">Recordatorio de Cita</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Les recuerda su próxima cita</p>
                        </div>
                        <span className="material-symbols-outlined text-neutral-400">chevron_right</span>
                    </button>

                    {/* Confirmar */}
                    <button
                        onClick={() => sendWhatsApp('confirm')}
                        className="w-full glass-panel p-4 rounded-xl flex items-center gap-3 hover:bg-white/80 dark:hover:bg-neutral-800/80 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-xl">check_circle</span>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-neutral-800 dark:text-white">Confirmar Asistencia</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Solicita confirmación de la cita</p>
                        </div>
                        <span className="material-symbols-outlined text-neutral-400">chevron_right</span>
                    </button>

                    {/* Personalizado */}
                    <button
                        onClick={() => sendWhatsApp('custom')}
                        className="w-full glass-panel p-4 rounded-xl flex items-center gap-3 hover:bg-white/80 dark:hover:bg-neutral-800/80 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl">edit</span>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-neutral-800 dark:text-white">Mensaje Personalizado</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Abre chat para escribir lo que quieras</p>
                        </div>
                        <span className="material-symbols-outlined text-neutral-400">chevron_right</span>
                    </button>
                </div>

                {/* Cancel Button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 glass-panel rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:bg-white/80 dark:hover:bg-neutral-800/80 transition-colors"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}
