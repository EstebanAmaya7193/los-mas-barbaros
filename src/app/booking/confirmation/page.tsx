"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface AppointmentData {
    fecha: string;
    hora_inicio: string;
    monto_total: number;
    barbero_id: string;
    barberos: {
        nombre: string;
        foto_url: string;
    }[] | null;
    clientes: {
        nombre: string;
    } | null;
    servicios: {
        nombre: string;
    } | null;
}

function ConfirmationContent() {
    const searchParams = useSearchParams();
    const appointmentId = searchParams.get("id");
    const [appointment, setAppointment] = useState<AppointmentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [fallbackBarber, setFallbackBarber] = useState<{ nombre: string; foto_url: string } | null>(null);

    const formatCOP = (value: number) => {
        const n = Math.round(Number(value) || 0);
        return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    };

    useEffect(() => {
        async function fetchAppointment() {
            if (!appointmentId) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("citas")
                .select(`
                    fecha,
                    hora_inicio,
                    monto_total,
                    barbero_id,
                    barberos (nombre, foto_url),
                    servicios (nombre),
                    clientes (nombre)
                `)
                .eq("id", appointmentId)
                .single();

            if (error) {
                console.error('Error fetching appointment:', error);
            }

            if (data) setAppointment(data as unknown as AppointmentData);
            setLoading(false);
        }
        fetchAppointment();
    }, [appointmentId]);

    useEffect(() => {
        async function fetchFallbackBarber() {
            if (!appointment?.barbero_id) return;
            if (appointment.barberos?.[0]?.nombre) return;

            const { data, error } = await supabase
                .from('barberos')
                .select('nombre, foto_url')
                .eq('id', appointment.barbero_id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching fallback barber:', error);
                return;
            }

            if (data) setFallbackBarber(data);
        }

        fetchFallbackBarber();
    }, [appointment]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-background-dark flex items-center justify-center font-display font-medium">
                Confirmando detalles...
            </div>
        );
    }

    if (!appointment) {
        return (
            <div className="min-h-screen bg-white dark:bg-background-dark flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-bold mb-4">No se encontró la cita</h1>
                <Link href="/" className="text-primary font-bold underline">Volver al inicio</Link>
            </div>
        );
    }

    const formattedDate = new Date(appointment.fecha + "T00:00:00").toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "short"
    });

    const clientName = appointment.clientes?.nombre || '';
    const firstName = (clientName === 'Cliente Web' || !clientName) ? "Bárbaro" : clientName.split(' ')[0];
    


    const barberName = appointment.barberos?.[0]?.nombre || fallbackBarber?.nombre || '';
    const barberPhoto = appointment.barberos?.[0]?.foto_url || fallbackBarber?.foto_url || '';

    // Simplificar lógica de servicios - manejar objeto
    const allServices = appointment.servicios?.nombre ? [appointment.servicios.nombre] : ['Servicio'];
    
    const serviceText = allServices.length > 1 
        ? `${allServices[0]} +${allServices.length - 1} más` 
        : allServices[0] || 'Servicio';

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-white dark:bg-background-dark transition-colors duration-300">
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-gray-100 dark:bg-white/5 rounded-full blur-[80px] opacity-80"></div>
                <div className="absolute bottom-[10%] left-[-10%] w-[400px] h-[400px] bg-gray-50 dark:bg-white/5 rounded-full blur-[60px] opacity-80"></div>
            </div>

            <main className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 pb-32 w-full max-w-md mx-auto">
                <div className="mb-10 flex flex-col items-center text-center">
                    <div className="relative flex items-center justify-center size-24 mb-6">
                        <div className="absolute inset-0 rounded-full border border-black/5 dark:border-white/10 animate-ping opacity-20"></div>
                        <div className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/5 scale-110 blur-xl"></div>
                        <svg 
                            className="w-full h-full text-primary dark:text-white drop-shadow-sm" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                        >
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </div>
                    <h1 className="text-[32px] font-bold tracking-tight text-primary dark:text-white mb-2 leading-tight">
                        ¡Listo, {firstName}!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base font-normal">
                        Tu cita ha sido confirmada con éxito.
                    </p>
                </div>

                <div className="w-full relative group">
                    <div className="backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] w-full rounded-[24px] p-6 flex flex-col gap-6 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                        <div className="flex flex-col gap-1 border-b border-black/5 dark:border-white/10 pb-5 relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-lg">
                                    calendar_month
                                </span>
                                <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
                                    Fecha y Hora
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold text-primary dark:text-white tracking-tight capitalize">
                                    {formattedDate}
                                </span>
                                <span className="text-xl font-medium text-gray-600 dark:text-gray-300">
                                    {appointment.hora_inicio.substring(0, 5)}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="size-14 rounded-full overflow-hidden border-2 border-white dark:border-white/20 shadow-sm bg-gray-100 dark:bg-gray-800">
                                        <img
                                            className="w-full h-full object-cover"
                                            alt={barberName}
                                            src="/assets/barberos/barbero1.jpg"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-0.5">
                                            Barbero
                                        </span>
                                        <span className="text-lg font-bold text-primary dark:text-white leading-none">
                                            {barberName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-white/50 dark:bg-white/5 p-4 rounded-xl border border-white/60 dark:border-white/10 shadow-sm">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
                                        Servicio Principal
                                    </span>
                                    <span className="text-base font-semibold text-primary dark:text-white">
                                        {serviceText}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
                                        Total
                                    </span>
                                    <span className="text-lg font-bold text-primary dark:text-white">
                                        ${formatCOP(appointment.monto_total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Link
                    href="/"
                    className="mt-12 w-full h-14 bg-primary dark:bg-white text-white dark:text-primary rounded-xl font-bold text-lg shadow-xl flex items-center justify-center transition-all active:scale-[0.98]"
                >
                    Volver al Inicio
                </Link>
            </main>
        </div>
    );
}

export default function BookingConfirmation() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Cargando...</div>}>
            <ConfirmationContent />
        </Suspense>
    );
}
