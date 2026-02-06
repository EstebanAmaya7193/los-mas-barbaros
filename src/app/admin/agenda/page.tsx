"use client";

import { supabase } from "@/lib/supabase";
import { formatTime12Hour } from "@/lib/timeFormat";
import WhatsAppContactModal from "@/components/WhatsAppContactModal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

interface Barber {
    id: string;
    nombre: string;
    foto_url: string;
}

interface Appointment {
    id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    estado: string;
    monto_total: number;
    duracion_minutos: number;
    clientes: {
        nombre: string;
        telefono: string;
    } | null;
    servicios: {
        nombre: string;
    } | null;
}

interface Bloqueo {
    id: string;
    barbero_id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    motivo?: string;
}

interface ScheduleData {
    hora_inicio?: string;
    hora_fin?: string;
    [dateKey: string]: {
        [timeKey: string]: {
            available: boolean;
            appointment?: Appointment;
        };
    } | string | undefined;
}

export default function DetailedAgenda() {
    const router = useRouter();
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);

    // Inicializar con cadena vacía para evitar hydration mismatch
    // La fecha real se establece en useEffect solo en el cliente
    const [selectedDate, setSelectedDate] = useState("");
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
    const [schedule, setSchedule] = useState<ScheduleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false); // Flag para evitar hydration mismatch
    const [showCalendar, setShowCalendar] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

    // Establecer fecha inicial solo en el cliente (evita hydration mismatch)
    useEffect(() => {
        setMounted(true); // Marca el componente como montado
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${day}`);
    }, []);


    // Fetch Barbers
    useEffect(() => {
        async function fetchBarbers() {
            const { data } = await supabase.from("barberos").select("*").eq("activo", true).order("nombre");
            if (data) {
                setBarbers(data);
                if (data.length > 0 && !selectedBarberId) setSelectedBarberId(data[0].id);
            }
        }
        fetchBarbers();
    }, []); // Run only once

    const fetchData = React.useCallback(async () => {
        if (!selectedBarberId || !selectedDate) return;

        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push("/login");
            return;
        }

        const dayOfWeek = new Date(selectedDate + "T12:00:00").getDay();

        const [citasRes, bloqueosRes, scheduleRes] = await Promise.all([
            supabase
                .from("citas")
                .select(`
                    id, fecha, hora_inicio, hora_fin, estado, monto_total, duracion_minutos,
                    clientes (nombre, telefono),
                    servicios (nombre)
                `)
                .eq("barbero_id", selectedBarberId)
                .eq("fecha", selectedDate)
                .order("hora_inicio"),
            supabase
                .from("bloqueos_barberos")
                .select("*")
                .eq("barbero_id", selectedBarberId)
                .or(`fecha.eq.${selectedDate},dia_semana.eq.${dayOfWeek},and(fecha.is.null,dia_semana.is.null)`),
            supabase
                .from("horarios_barberos")
                .select("*")
                .eq("barbero_id", selectedBarberId)
                .eq("dia_semana", dayOfWeek)
                .single()
        ]);

        if (citasRes.data) setAppointments(citasRes.data as unknown as Appointment[]);
        if (bloqueosRes.data) setBloqueos(bloqueosRes.data);
        if (scheduleRes.data) setSchedule(scheduleRes.data);
        else setSchedule(null);
        setLoading(false);
    }, [selectedBarberId, selectedDate, router]);

    // Fetch Appointments & Blocks
    useEffect(() => {
        fetchData();

        // Realtime subscription
        const channel = supabase
            .channel('agenda-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueos_barberos' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_barberos' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    useAutoRefresh(fetchData);

    const changeDate = (days: number) => {
        const date = new Date(selectedDate + "T00:00:00");
        date.setDate(date.getDate() + days);
        // Usar formato local consistente
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${day}`);
    };

    const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case "COMPLETADA": return "bg-neutral-100 text-neutral-500";
            case "EN_ESPERA": return "bg-yellow-100/80 text-yellow-700";
            case "EN_ATENCION": return "bg-black text-white";
            case "CREADA":
            case "PROGRAMADA": return "bg-blue-100 text-blue-700";
            default: return "bg-gray-100 text-gray-500";
        }
    };

    const getStatusLabel = (status: string) => {
        return status.replace("_", " ");
    };

    // Calendar functions
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const generateCalendarDays = () => {
        const date = new Date(selectedDate + "T00:00:00");
        const daysInMonth = getDaysInMonth(date);
        const firstDay = getFirstDayOfMonth(date);
        const days = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    };

    const handleDateSelect = (day: number) => {
        const date = new Date(selectedDate + "T00:00:00");
        const newDate = new Date(date.getFullYear(), date.getMonth(), day);
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(newDate.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${dayStr}`);
        setShowCalendar(false);
    };

    const handleMonthChange = (increment: number) => {
        const date = new Date(selectedDate + "T00:00:00");
        date.setMonth(date.getMonth() + increment);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${day}`);
    };

    // Timeline Generation Logic
    const timelineHours = [];
    const startHourStr = schedule?.hora_inicio || "10:00:00";
    const endHourStr = schedule?.hora_fin || "20:00:00";

    const [sH, sM] = startHourStr.split(":").map(Number);
    const [eH, eM] = endHourStr.split(":").map(Number);

    const current = new Date();
    current.setHours(sH, sM, 0, 0);
    const endTime = new Date();
    endTime.setHours(eH, eM, 0, 0);

    while (current < endTime) {
        timelineHours.push(`${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`);
        current.setMinutes(current.getMinutes() + 15); // Cambiado de 30 a 15 minutos
    }

    // Helper to check if a slot is in the past
    const isSlotPast = (time: string, date: string) => {
        const now = new Date();
        // Usar formato local consistente
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        if (date < todayStr) return true;
        if (date > todayStr) return false;

        // It's today, compare hours and minutes
        const [h, m] = time.split(":").map(Number);
        const nowH = now.getHours();
        const nowM = now.getMinutes();

        // If current hour is greater, or same hour but current minute is greater or equal
        return h < nowH || (h === nowH && m < nowM);
    };

    // Helper to check if a slot is blocked
    const isSlotBlocked = (time: string) => {
        return bloqueos.some(b => {
            const start = b.hora_inicio.substring(0, 5);
            const end = b.hora_fin.substring(0, 5);
            return time >= start && time < end;
        });
    };

    // Helper to check if a slot is occupied by an appointment
    const isSlotOccupied = (time: string, apts: Appointment[]) => {
        return apts.find(apt => {
            const start = apt.hora_inicio.substring(0, 5);
            return start === time;
        });
    };

    // Helper to check if a slot is "covered" by a previous multi-slot appointment
    const isSlotCovered = (time: string, apts: Appointment[]) => {
        return apts.some(apt => {
            const start = apt.hora_inicio.substring(0, 5);
            const end = apt.hora_fin.substring(0, 5);
            // This slot is "inside" an appointment (starts after it begins and ends before it finishes)
            return time > start && time < end;
        });
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-[#141414] dark:text-white antialiased selection:bg-black selection:text-white min-h-screen">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-gray-200 to-transparent opacity-60 blur-3xl dark:from-gray-800"></div>
                <div className="absolute bottom-[10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-gray-300 to-transparent opacity-60 blur-3xl dark:from-gray-700"></div>
            </div>

            <div className="relative flex flex-col min-h-screen w-full md:max-w-6xl max-w-md mx-auto pb-28 md:px-6">
                <header className="flex flex-col pt-6 pb-2 z-10 sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md transition-all border-b border-transparent dark:border-white/5">
                    <div className="flex items-center px-6 justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/barber" className="relative group cursor-pointer">
                                <div className="bg-neutral-200 dark:bg-neutral-800 rounded-full w-10 h-10 shadow-sm border border-white dark:border-neutral-700 flex items-center justify-center overflow-hidden">
                                    <img src="/assets/barberos/barbero1.jpg" className="w-full h-full object-cover" alt="Foto de perfil del barbero" />
                                </div>
                            </Link>
                            <div className="flex flex-col">
                                <h2 className="text-xl font-bold leading-none tracking-tight">Agenda Detallada</h2>
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Los Más Bárbaros</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="flex cursor-pointer items-center justify-center rounded-full size-10 text-neutral-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            <span className="material-symbols-outlined">calendar_today</span>
                        </button>
                    </div>

                    <div className="flex gap-4 px-6 overflow-x-auto scrollbar-hide snap-x items-start pb-2">
                        {barbers.map((barber) => (
                            <div
                                key={barber.id}
                                onClick={() => setSelectedBarberId(barber.id)}
                                className={`snap-start flex flex-col items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all ${selectedBarberId === barber.id ? "opacity-100" : "opacity-40"}`}
                            >
                                <div className={`w-12 h-12 rounded-full p-0.5 border-2 ${selectedBarberId === barber.id ? "border-black dark:border-white" : "border-transparent"}`}>
                                    <div className="w-full h-full rounded-full bg-neutral-200 overflow-hidden">
                                        <img src="/assets/barberos/barbero1.jpg" className={`w-full h-full object-cover ${selectedBarberId === barber.id ? "" : "grayscale"}`} alt={barber.nombre} />
                                    </div>
                                </div>
                                <span className="text-[10px] text-center uppercase tracking-tighter font-bold">{barber.nombre}</span>
                            </div>
                        ))}
                    </div>
                </header>

                {/* Calendar Modal */}
                {showCalendar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                        <div className="glass-panel rounded-2xl p-6 w-full max-w-sm">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => handleMonthChange(-1)}
                                    className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-neutral-800 dark:text-white">chevron_left</span>
                                </button>
                                <h3 className="text-neutral-800 dark:text-white text-lg font-bold">
                                    {selectedDate && new Date(selectedDate + "T00:00:00").toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button
                                    onClick={() => handleMonthChange(1)}
                                    className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-neutral-800 dark:text-white">chevron_right</span>
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                                    <div key={day} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {generateCalendarDays().map((day, index) => (
                                    <div key={index} className="aspect-square">
                                        {day ? (
                                            <button
                                                onClick={() => handleDateSelect(day)}
                                                className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-medium transition-all ${selectedDate && day === new Date(selectedDate + "T00:00:00").getDate()
                                                    ? 'bg-black dark:bg-white text-white dark:text-black'
                                                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-neutral-800 dark:text-white'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ) : (
                                            <div className="w-full h-full"></div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => setShowCalendar(false)}
                                className="w-full mt-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-medium text-neutral-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                <main className="flex flex-col md:grid md:grid-cols-12 md:gap-8 px-4 md:px-0 w-full h-full relative">
                    {/* Left Column: Desktop Calendar */}
                    <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col gap-4 sticky top-24 self-start">
                        <div className="glass-panel p-6 rounded-2xl border border-white/20 shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => handleMonthChange(-1)} className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <span className="material-symbols-outlined text-neutral-800 dark:text-white">chevron_left</span>
                                </button>
                                <h3 className="text-neutral-800 dark:text-white text-md font-bold">
                                    {selectedDate && new Date(selectedDate + "T00:00:00").toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button onClick={() => handleMonthChange(1)} className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <span className="material-symbols-outlined text-neutral-800 dark:text-white">chevron_right</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => (
                                    <div key={day} className="text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {generateCalendarDays().map((day, index) => (
                                    <div key={index} className="aspect-square">
                                        {day ? (
                                            <button
                                                onClick={() => handleDateSelect(day)}
                                                className={`w-full h-full flex items-center justify-center rounded-lg text-xs font-bold transition-all ${selectedDate && day === new Date(selectedDate + "T00:00:00").getDate()
                                                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg scale-110'
                                                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-neutral-800 dark:text-white'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ) : <div className="w-full h-full"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Timeline */}
                    <div className="md:col-span-8 lg:col-span-9 flex flex-col w-full">
                        <div className="flex items-center justify-between py-4 mb-2 z-10">
                            <button onClick={() => changeDate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full glass-panel hover:bg-white dark:hover:bg-neutral-800 transition-all font-bold">
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="flex flex-col items-center">
                                {mounted ? (
                                    <>
                                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                                            {selectedDate && new Date(selectedDate + "T00:00:00").toDateString() === new Date().toDateString() ? "Hoy" : ""}
                                        </span>
                                        <span className="text-lg font-bold">
                                            {selectedDate ? formatDateHeader(selectedDate) : ""}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-lg font-bold">Cargando...</span>
                                )}
                            </div>
                            <button onClick={() => changeDate(1)} className="w-10 h-10 flex items-center justify-center rounded-full glass-panel hover:bg-white dark:hover:bg-neutral-800 transition-all">
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>

                        <div className="relative flex flex-col gap-6 w-full pb-10">
                            <div className="timeline-line"></div>

                            {loading ? (
                                <div className="text-center py-20 text-neutral-400 font-medium">Cargando agenda...</div>
                            ) : (
                                timelineHours.map((time) => {
                                    const apt = appointments.find(a => a.hora_inicio.substring(0, 5) === time);
                                    const isCovered = isSlotCovered(time, appointments);
                                    const isBlocked = isSlotBlocked(time);

                                    if (isCovered) return null; // Don't show anything for "middle" of a long appointment

                                    return (
                                        <div key={time} className="flex flex-col gap-6">
                                            <div className={`group relative grid grid-cols-[3.5rem_1fr] gap-3`}>
                                                <div className="flex flex-col items-end pt-3 z-10">
                                                    <span className="text-sm font-bold font-mono text-neutral-800 dark:text-white">{formatTime12Hour(time)}</span>
                                                </div>

                                                <div className="flex flex-col justify-center">
                                                    {apt ? (
                                                        <div className={`glass-panel p-3 rounded-2xl flex items-center gap-3 relative transition-all ${apt.estado === "EN_ATENCION" ? "glass-card-strong border-l-4 border-l-black dark:border-l-white scale-[1.02]" : "hover:bg-white/80 dark:hover:bg-white/10"} ${isSlotPast(time, selectedDate) ? "opacity-50" : apt.estado === "COMPLETADA" ? "opacity-60" : ""}`}>
                                                            <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-sm font-bold text-neutral-500">
                                                                {apt.clientes?.nombre?.substring(0, 2).toUpperCase() || "WN"}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-center mb-0.5">
                                                                    <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{apt.clientes?.nombre || "Walk-in"}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        {isSlotPast(time, selectedDate) && <span className="material-symbols-outlined text-neutral-400 text-lg">history</span>}
                                                                        {apt.estado === "COMPLETADA" && <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>}
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs text-neutral-500 dark:text-neutral-400 block truncate">{apt.servicios?.nombre || "Corte"}</span>
                                                                <div className="mt-1 flex items-center gap-2">
                                                                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(apt.estado)}`}>
                                                                        {getStatusLabel(apt.estado)}
                                                                    </div>
                                                                    <span className="text-[10px] text-neutral-400 font-mono">{apt.duracion_minutos} min</span>
                                                                    {isSlotPast(time, selectedDate) && <span className="text-[8px] text-neutral-400 italic">Histórico</span>}
                                                                </div>

                                                                {/* Contact Buttons */}
                                                                {apt.clientes?.telefono && (
                                                                    <div className="flex gap-1.5 mt-2">
                                                                        <a
                                                                            href={`tel:${apt.clientes.telefono}`}
                                                                            className="flex-1 flex items-center justify-center gap-1 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 py-1.5 px-2 rounded-lg text-[10px] font-bold hover:bg-green-100 dark:hover:bg-green-900/20 transition-all active:scale-95"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {/* <span className="material-symbols-outlined text-xs">call</span> */}
                                                                            Llamar
                                                                        </a>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedAppointment(apt);
                                                                                setShowWhatsAppModal(true);
                                                                            }}
                                                                            className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 py-1.5 px-2 rounded-lg text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all active:scale-95"
                                                                        >
                                                                            {/* <span className="material-symbols-outlined text-xs">chat</span> */}
                                                                            WhatsApp
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : isBlocked ? (
                                                        <div className="h-16 flex items-center px-4 opacity-20 italic text-[10px] uppercase tracking-widest text-neutral-400">
                                                            Bloqueado
                                                        </div>
                                                    ) : isSlotPast(time, selectedDate) ? (
                                                        <div className="h-16 flex items-center px-4 opacity-30 italic text-[10px] uppercase tracking-widest text-neutral-400">
                                                            Horario pasado
                                                        </div>
                                                    ) : (
                                                        <button className="w-full h-16 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-3 text-neutral-300 dark:text-neutral-700 hover:border-neutral-300 hover:text-neutral-400 transition-all group">
                                                            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">add</span>
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Espacio Disponible</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </main>

                {/* WhatsApp Contact Modal */}
                {selectedAppointment && (
                    <WhatsAppContactModal
                        isOpen={showWhatsAppModal}
                        onClose={() => {
                            setShowWhatsAppModal(false);
                            setSelectedAppointment(null);
                        }}
                        clientName={selectedAppointment.clientes?.nombre || "Cliente"}
                        clientPhone={selectedAppointment.clientes?.telefono || ""}
                        appointmentDate={selectedAppointment.fecha}
                        appointmentTime={selectedAppointment.hora_inicio}
                    />
                )}

                <nav className="fixed bottom-0 left-0 w-full z-30 flex justify-center pb-2 pt-2 px-4 pointer-events-none">
                    <div className="glass-card-strong w-full max-w-md rounded-2xl flex justify-around items-center h-16 pointer-events-auto shadow-2xl">
                        <Link href="/admin/barber" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                            <span className="material-symbols-outlined text-[26px]">grid_view</span>
                            <span className="text-[10px] font-medium">Panel</span>
                        </Link>
                        <button className="flex flex-col items-center justify-center w-16 h-full gap-1 text-primary dark:text-white">
                            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
                            <span className="text-[10px] font-medium">Agenda</span>
                        </button>
                        <Link href="/admin/clients" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                            <span className="material-symbols-outlined text-[26px]">groups</span>
                            <span className="text-[10px] font-medium">Clientes</span>
                        </Link>
                        <Link href="/admin/ingresos" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                            <span className="material-symbols-outlined text-[26px]">trending_up</span>
                            <span className="text-[10px] font-medium">Ingresos</span>
                        </Link>
                        <Link href="/admin/settings" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                            <span className="material-symbols-outlined text-[26px]">settings</span>
                            <span className="text-[10px] font-medium">Config</span>
                        </Link>
                    </div>
                </nav>
            </div>
        </div>
    );
}
