"use client";

import RealPushService from "@/lib/realPushService";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface Barber {
    id: string;
    nombre: string;
    foto_url: string;
}

interface Service {
    id: string;
    nombre: string;
    precio: number;
    duracion_minutos: number;
}

interface TimeSlot {
    time: string;
    available: boolean;
}

interface Appointment {
    hora_inicio: string;
    hora_fin: string;
    estado: string;
}

interface Schedule {
    activo: boolean;
    hora_inicio: string;
    hora_fin: string;
}

interface Block {
    id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
}

interface User {
    id: string;
    email?: string;
    user_metadata?: {
        name?: string;
        full_name?: string;
        phone?: string;
        role?: string;
    };
}

function BookingDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const serviceIds = searchParams.get("services")?.split(",") || [];

    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedBarber, setSelectedBarber] = useState<string | null>(null);

    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedServiceDetails, setSelectedServiceDetails] = useState<Service[]>([]);
    const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

    const [loading, setLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);

    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");

    const [dates, setDates] = useState<{ day: string, date: string }[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isBarber, setIsBarber] = useState(false);

    // 0. Check Auth & Pre-fill
    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);

                // Check if this user is a barber
                const { data: barberData } = await supabase
                    .from("barberos")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (barberData) {
                    setIsBarber(true);
                    // If it's a barber, they are likely booking for someone else,
                    // so we don't pre-fill their name/phone to avoid confusion.
                } else {
                    // It's a client, pre-fill from profile
                    const { data: profile } = await supabase
                        .from("clientes")
                        .select("nombre, telefono")
                        .eq("id", user.id)
                        .maybeSingle();

                    if (profile) {
                        setClientName(profile.nombre || "");
                        setClientPhone(profile.telefono || "");
                    } else {
                        // Fallback to metadata
                        setClientName(user.user_metadata?.full_name || "");
                        setClientPhone(user.user_metadata?.phone || "");
                    }
                }
            }
        }
        checkAuth();
    }, []);

    useEffect(() => {
        const generatedDates = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];
            const dayName = i === 0 ? "HOY" : i === 1 ? "MAÑ" : d.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase().replace(".", "");
            return { day: dayName, date: dateStr };
        });
        setDates(generatedDates);
        if (generatedDates.length > 0 && !selectedDate) {
            setSelectedDate(generatedDates[0].date);
        }
    }, []);

    // 1. Fetch Master Data (Barbers & Services)
    useEffect(() => {
        async function fetchMasterData() {
            const [barbersRes, servicesRes] = await Promise.all([
                supabase.from("barberos").select("*").order("nombre"),
                supabase.from("servicios").select("id, nombre, precio, duracion_minutos").in("id", serviceIds)
            ]);

            if (barbersRes.data) {
                setBarbers(barbersRes.data);
                if (barbersRes.data.length > 0) setSelectedBarber(barbersRes.data[0].id);
            }
            if (servicesRes.data) setSelectedServiceDetails(servicesRes.data);
        }
        if (serviceIds.length > 0) fetchMasterData();
    }, []);

    async function fetchAvailability() {
        if (!selectedBarber || !selectedDate) return;
        setLoading(true);

        // 1. Fetch appointments
        const { data: apts } = await supabase
            .from("citas")
            .select("hora_inicio, hora_fin, estado")
            .eq("barbero_id", selectedBarber)
            .eq("fecha", selectedDate)
            .neq("estado", "CANCELADA");

        // 2. Fetch specific schedule for this day
        const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
        const { data: schedule } = await supabase
            .from("horarios_barberos")
            .select("*")
            .eq("barbero_id", selectedBarber)
            .eq("dia_semana", dayOfWeek)
            .single();

        // 3. Fetch specific blocks for this day OR recurring blocks for this day of week
        const { data: blocks } = await supabase
            .from("bloqueos_barberos")
            .select("*")
            .eq("barbero_id", selectedBarber)
            .or(`fecha.eq.${selectedDate},dia_semana.eq.${dayOfWeek}`);

        setExistingAppointments(apts || []);
        generateTimeSlots(apts || [], schedule, blocks || []);
        setLoading(false);
    }

    // 2. Fetch occupied slots when selection changes
    useEffect(() => {
        fetchAvailability();
    }, [selectedBarber, selectedDate]);

    const generateTimeSlots = (occupied: Appointment[], schedule: Schedule | null, blocks: Block[]) => {
        const slots: TimeSlot[] = [];

        // If day is not active, return no slots
        if (schedule && !schedule.activo) {
            setTimeSlots([]);
            return;
        }

        // Use schedule hours or default 10-20
        const startHourStr = schedule?.hora_inicio || "10:00:00";
        const endHourStr = schedule?.hora_fin || "20:00:00";

        const [sH, sM] = startHourStr.split(":").map(Number);
        const [eH, eM] = endHourStr.split(":").map(Number);

        // Iterate through slots
        const current = new Date();
        current.setHours(sH, sM, 0, 0);
        const endTime = new Date();
        endTime.setHours(eH, eM, 0, 0);

        while (current < endTime) {
            const h = current.getHours();
            const m = current.getMinutes();
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            // 1. Check if occupied by appointment
            const isOccupiedByApt = occupied.some(apt => {
                const start = apt.hora_inicio.substring(0, 5);
                const end = apt.hora_fin.substring(0, 5);
                return time >= start && time < end;
            });

            // 2. Check if blocked by barber
            const isBlocked = blocks.some(blk => {
                const start = blk.hora_inicio.substring(0, 5);
                const end = blk.hora_fin.substring(0, 5);
                return time >= start && time < end;
            });

            // 3. Check if past time
            let isPast = false;
            if (selectedDate === new Date().toISOString().split("T")[0]) {
                const now = new Date();
                isPast = current < now;
            }

            slots.push({ time, available: !isOccupiedByApt && !isBlocked && !isPast });

            // Advance 30 mins
            current.setMinutes(current.getMinutes() + 30);
        }

        setTimeSlots(slots);

        // Deselect if current time becomes unavailable
        if (selectedTime) {
            const currentSlot = slots.find(s => s.time === selectedTime);
            if (!currentSlot || !currentSlot.available) {
                setSelectedTime(null);
            }
        }
    };

    const totalDuration = selectedServiceDetails.reduce((acc, curr) => acc + (curr.duracion_minutos || 30), 0);
    const totalPrice = selectedServiceDetails.reduce((acc, curr) => acc + Number(curr.precio), 0);

    const formatCOP = (value: number) => {
        const n = Math.round(Number(value) || 0);
        return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    };

    const handleConfirm = async () => {
        if (!selectedBarber || !selectedTime || !selectedDate) {
            alert("Por favor selecciona barbero, fecha y hora.");
            return;
        }
        setIsBooking(true);

        try {
            // 3. Final overlap check (Race condition protection)
            const timeWithSec = `${selectedTime}:00`;
            const { data: conflicts } = await supabase
                .from("citas")
                .select("id")
                .eq("barbero_id", selectedBarber)
                .eq("fecha", selectedDate)
                .neq("estado", "CANCELADA")
                .or(`and(hora_inicio.lte.${timeWithSec},hora_fin.gt.${timeWithSec})`);

            if (conflicts && conflicts.length > 0) {
                alert("Lo sentimos, este horario se acaba de ocupar. Por favor elige otro.");
                setIsBooking(false);
                // Refresh availability
                fetchAvailability();
                return;
            }

            // 4. Create or get client
            let clientId = null;

            if (user && !isBarber) {
                clientId = user.id;
                // Ensure client exists in public.clientes (Upsert)
                const { error: upsertError } = await supabase
                    .from("clientes")
                    .upsert({
                        id: user.id,
                        nombre: clientName || user.user_metadata?.full_name || "Cliente",
                        telefono: clientPhone || user.user_metadata?.phone || ""
                    }, { onConflict: 'id' });

                if (upsertError) throw upsertError;
            } else {
                // Not logged in OR logged in as barber: create guest record using the form data
                const { data: clientData, error: clientError } = await supabase
                    .from("clientes")
                    .insert([{ nombre: clientName || "Cliente Web", telefono: clientPhone }])
                    .select()
                    .single();

                if (clientError) throw clientError;
                if (clientData) clientId = clientData.id;
            }

            // 5. Calculate hour_fin
            const [hours, minutes] = selectedTime.split(":").map(Number);
            const refDate = new Date();
            refDate.setHours(hours, minutes, 0, 0);
            const endDate = new Date(refDate.getTime() + totalDuration * 60000);
            const horaFin = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

            // 6. Create appointment
            const { data: bookingData, error: bookingError } = await supabase.from("citas").insert([
                {
                    cliente_id: clientId,
                    barbero_id: selectedBarber,
                    servicio_id: serviceIds[0],
                    fecha: selectedDate,
                    hora_inicio: timeWithSec,
                    hora_fin: horaFin,
                    duracion_minutos: totalDuration,
                    monto_total: totalPrice,
                    origen: 'ONLINE',
                    estado: 'PROGRAMADA',
                    notas: serviceIds.length > 1 ? `Servicios extra: ${serviceIds.slice(1).join(", ")}` : ''
                }
            ]).select().single();

            if (bookingError) throw bookingError;

            // Enviar notificación push al barbero
            try {
                // Obtener información del barbero para la notificación
                const { data: barberInfo } = await supabase
                    .from("barberos")
                    .select("nombre")
                    .eq("id", selectedBarber)
                    .single();

                // Obtener información del cliente y servicio
                const { data: clientInfo } = await supabase
                    .from("clientes")
                    .select("nombre")
                    .eq("id", clientId)
                    .single();

                const { data: serviceInfo } = await supabase
                    .from("servicios")
                    .select("nombre")
                    .eq("id", serviceIds[0])
                    .single();

                // Preparar payload para notificación push
                const notificationPayload = {
                    title: 'Nueva Cita Agendada',
                    body: `${clientInfo?.nombre || 'Cliente'} - ${serviceInfo?.nombre || 'Servicio'} - ${timeWithSec.substring(0, 5)}`,
                    icon: '/assets/logo.jpg',
                    tag: 'new-appointment',
                    data: {
                        type: 'new_appointment',
                        appointmentId: bookingData.id,
                        barberId: selectedBarber,
                        clientId: clientId,
                        serviceId: serviceIds[0],
                        timestamp: new Date().toISOString()
                    },
                    requireInteraction: true,
                    actions: [
                        {
                            action: 'open',
                            title: 'Ver Panel'
                        },
                        {
                            action: 'dismiss',
                            title: 'Descartar'
                        }
                    ]
                };

                // Enviar notificación push a todos los tokens del barbero
                const { data: tokens } = await supabase
                    .from('barberos_push_tokens')
                    .select('push_token')
                    .eq('barbero_id', selectedBarber)
                    .eq('is_active', true);

                if (tokens && tokens.length > 0) {
                    console.log(`Enviando notificación push a ${tokens.length} dispositivos...`);
                    
                    // Usar el servicio de envío push real
                    const pushService = RealPushService.getInstance();
                    const successCount = await pushService.sendPushNotificationToMultiple(
                        tokens.map(t => t.push_token),
                        notificationPayload
                    );
                    
                    console.log(`Notificación push enviada a ${successCount} dispositivos`);
                } else {
                    console.log('No hay tokens push registrados para este barbero');
                }

                console.log('Notificación enviada al barbero:', barberInfo?.nombre);
            } catch (notificationError) {
                console.log('Error en notificación push (continuando normalmente):', notificationError);
            }

            router.push(`/booking/confirmation?id=${bookingData.id}`);
        } catch (error: unknown) {
            console.error("Booking error:", error);
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            alert(`Error al agendar cita: ${errorMessage}`);
        } finally {
            setIsBooking(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-primary dark:text-white min-h-screen flex flex-col relative overflow-x-hidden antialiased selection:bg-black selection:text-white">
            <div className="fixed top-20 right-[-50px] w-64 h-64 bg-gray-200 dark:bg-gray-800 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-60 pointer-events-none animate-pulse"></div>
            <div className="fixed bottom-40 left-[-50px] w-72 h-72 bg-gray-300 dark:bg-gray-700 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-40 pointer-events-none"></div>

            <div className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-6 py-4 pt-12 justify-between border-b border-transparent dark:border-white/5">
                <Link href="/booking/services" className="group flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90">
                    <span className="material-symbols-outlined text-[28px] font-light text-primary dark:text-white transition-transform group-hover:-translate-x-0.5">chevron_left</span>
                </Link>
                <h2 className="text-primary dark:text-white text-lg font-bold flex-1 text-center pr-10">Agendar Cita</h2>
            </div>

            <div className="flex-1 flex flex-col pb-32">
                {/* Barber Selection */}
                <div className="flex flex-col w-full mt-4">
                    <h3 className="text-primary dark:text-white text-lg font-bold px-4 pb-3">Elige tu Barbero</h3>
                    <div className="flex gap-4 px-4 overflow-x-auto scrollbar-hide snap-x items-start pb-2">
                        {barbers.map((barber) => (
                            <div
                                key={barber.id}
                                onClick={() => setSelectedBarber(barber.id)}
                                className={`snap-start flex flex-col items-center gap-2 shrink-0 cursor-pointer transition-all ${selectedBarber === barber.id ? "opacity-100" : "opacity-60"}`}
                            >
                                <div className={`w-16 h-16 rounded-full p-0.5 border-2 ${selectedBarber === barber.id ? "border-black dark:border-white shadow-md" : "border-transparent"}`}>
                                    <div className="w-full h-full rounded-full bg-neutral-200 overflow-hidden relative border border-white/10">
                                        <img className={`w-full h-full object-cover ${selectedBarber === barber.id ? "" : "grayscale"}`} src="/assets/barberos/barbero1.jpg" alt={barber.nombre} />
                                    </div>
                                </div>
                                <span className={`text-xs ${selectedBarber === barber.id ? "font-bold text-primary dark:text-white" : "font-medium text-gray-500"}`}>{barber.nombre}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Date Selection */}
                <div className="flex flex-col w-full mt-2">
                    <h3 className="text-primary dark:text-white text-lg font-bold px-6 pb-3 pt-4">Fecha</h3>
                    <div className="flex gap-3 px-6 pb-4 overflow-x-auto scrollbar-hide snap-x scroll-px-6">
                        {dates.map((d) => (
                            <div
                                key={d.date}
                                onClick={() => setSelectedDate(d.date)}
                                className={`snap-start flex flex-col h-16 min-w-[70px] items-center justify-center rounded-xl cursor-pointer transition-all ${selectedDate === d.date ? "bg-primary text-white shadow-lg" : "bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-neutral-400"}`}
                            >
                                <p className="text-[11px] font-bold uppercase opacity-60">{d.day}</p>
                                <p className="text-xl font-bold">{d.date.split("-")[2]}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Slots Grid */}
                <div className="flex flex-col w-full mt-2">
                    <h3 className="text-primary dark:text-white text-lg font-bold px-4 pb-3 pt-2">Disponibilidad</h3>
                    {loading ? (
                        <div className="grid grid-cols-4 gap-3 px-4 animate-pulse">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded-lg"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-3 px-4">
                            {timeSlots.map((slot) => (
                                <button
                                    key={slot.time}
                                    disabled={!slot.available}
                                    onClick={() => setSelectedTime(slot.time)}
                                    className={`flex h-10 items-center justify-center rounded-lg text-sm transition-all ${!slot.available
                                        ? "bg-neutral-50 dark:bg-neutral-900 line-through text-neutral-300 dark:text-neutral-700 opacity-50"
                                        : selectedTime === slot.time
                                            ? "bg-primary dark:bg-white text-white dark:text-primary font-bold shadow-md scale-105"
                                            : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                                        }`}
                                >
                                    {slot.time}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 mt-8 relative">
                    <div className="glass-card rounded-2xl p-6 shadow-xl border border-white/20 dark:border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest opacity-50">Tus Datos</h4>
                            {user && !isBarber && (
                                <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1 rounded-full border border-green-100 dark:border-green-900/30">
                                    <span className="material-symbols-outlined text-[14px] fill-current">verified</span>
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">Perfíl Conectado</span>
                                </div>
                            )}
                        </div>
                        <div className="space-y-6">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tu Nombre</label>
                                <div className="flex items-center gap-3 border-b border-gray-300 dark:border-neutral-700 pb-2">
                                    <span className="material-symbols-outlined text-gray-400">person</span>
                                    <input
                                        className="w-full bg-transparent border-none p-0 text-lg font-medium focus:ring-0"
                                        placeholder="Escribe tu nombre"
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Teléfono</label>
                                <div className="flex items-center gap-3 border-b border-gray-300 dark:border-neutral-700 pb-2">
                                    <span className="material-symbols-outlined text-gray-400">call</span>
                                    <input
                                        className="w-full bg-transparent border-none p-0 text-lg font-medium focus:ring-0"
                                        placeholder="Para recordarte tu cita"
                                        type="tel"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Espacio de separación antes del precio */}
            <div className="h-8"></div>

            <div className="fixed bottom-0 w-full z-40">
                {/* Content */}
                <div className="relative p-4 pb-4 pt-4">
                    <div className="relative flex items-center justify-between mb-6 px-2">
                        {/* Blur Background - cubre exactamente este elemento */}
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl -mx-2 -my-1"></div>
                        
                        <div className="relative flex flex-col gap-1">
                            <span className="text-sm font-medium text-neutral-500">Total {totalDuration} min</span>
                            {selectedDate && selectedTime && (
                                <span className="text-xs text-neutral-400">
                                    {selectedDate} • {selectedTime}
                                </span>
                            )}
                        </div>
                        <div className="relative text-right">
                            <span className="text-xl font-bold text-primary dark:text-white">${formatCOP(totalPrice)}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={isBooking || loading || !selectedTime}
                        className="w-full bg-primary dark:bg-white text-white dark:text-primary h-14 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                    >
                        <span>{isBooking ? "Confirmando..." : "Finalizar Reserva"}</span>
                        <span className="material-symbols-outlined font-bold">check_circle</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function BookingDetails() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background-light flex items-center justify-center font-display font-medium">Cargando detalles...</div>}>
            <BookingDetailsContent />
        </Suspense>
    );
}
