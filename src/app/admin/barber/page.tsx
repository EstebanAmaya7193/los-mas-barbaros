"use client";

import PushPermissionPrompt from "@/components/PushPermissionPrompt";
import { supabase } from "@/lib/supabase";
import { formatTime12Hour } from "@/lib/timeFormat";
import WhatsAppContactModal from "@/components/WhatsAppContactModal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BarberStats {
    totalCuts: number;
    totalEarnings: number;
}

interface Appointment {
    id: string;
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

interface Service {
    id: string;
    nombre: string;
    precio: number;
    duracion_minutos: number;
}

// Función segura para inicializar notificaciones push con validación iOS
const initPushNotifications = async (barberId?: string): Promise<boolean> => {
    // Validación de entorno
    if (typeof window === 'undefined') {
        console.log('Entorno servidor - omitiendo inicialización push');
        return false;
    }

    // Validación de APIs con seguridad para iOS
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker no soportado en este dispositivo');
        return false;
    }

    if (!('Notification' in window)) {
        console.log('API de Notification no soportada');
        return false;
    }

    if (!('PushManager' in window)) {
        console.log('Push Manager no soportado');
        return false;
    }

    // Detección de PWA para iOS (las push solo funcionan en PWA instalada)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) {
        console.log('iOS detectado - Push solo disponible en PWA instalada');
        return false;
    }

    try {
        // Acceso seguro a Notification.permission
        const currentPermission = typeof Notification !== 'undefined' ?
            Notification.permission : 'unsupported';
        console.log('Permiso actual:', currentPermission);

        if (currentPermission === 'granted') {
            console.log('Permisos ya concedidos');
            return await registerPushSubscription(barberId);
        }

        if (currentPermission === 'denied') {
            console.log('Permisos denegados previamente');
            return false;
        }

        // Solicitar permiso de forma segura
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            console.log('Permisos no concedidos:', permission);
            return false;
        }

        console.log('Permisos concedidos exitosamente');
        return await registerPushSubscription(barberId);

    } catch (err) {
        console.error('Error inicializando notificaciones push:', err);
        return false;
    }
};



const registerPushSubscription = async (barberId?: string): Promise<boolean> => {
    try {
        // Validación adicional de seguridad
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Worker no disponible');
        }

        const registration = await navigator.serviceWorker.register('/push-sw.js', {
            scope: '/'
        });
        console.log('Service worker registrado:', registration.scope);

        await navigator.serviceWorker.ready;
        console.log('Service worker listo');

        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('Ya existe una suscripción push');
            return true;
        }

        const applicationServerKey = urlBase64ToUint8Array(
            'BEDW4o4KdY7RnEhHZMzSOrxrFvCrbhfAg2By3ZjrMDwd-ArMA4KaSC1pEJMRhFUrA-GeUztAVzqX0I3D8FrHZUQ'
        );

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });

        console.log('Suscripción push creada:', subscription);

        if (barberId) {
            await savePushTokenToSupabase(barberId, subscription);
        }

        return true;

    } catch (err) {
        console.error('Error registrando suscripción push:', err);
        return false;
    }
};

const savePushTokenToSupabase = async (barberId: string, subscription: PushSubscription): Promise<void> => {

    try {
        const { error } = await supabase
            .from('barberos_push_tokens')
            .insert({
                barbero_id: barberId,
                push_token: JSON.stringify(subscription),
                is_active: true,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error guardando token push:', error);
        } else {
            console.log('Token push guardado exitosamente');
        }
    } catch (err) {
        console.error('Error guardando token en Supabase:', err);
    }
};



const urlBase64ToUint8Array = (base64String: string): BufferSource => {

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
};

export default function BarberAdmin() {

    const router = useRouter();
    const [barber, setBarber] = useState<any>(null);
    const [stats, setStats] = useState<BarberStats>({ totalCuts: 0, totalEarnings: 0 });
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
    const [notificationPromptShown, setNotificationPromptShown] = useState(false);

    // Inicializar notificaciones de forma segura después del login
    useEffect(() => {
        if (barber && !notificationPromptShown) {
            // Verificar si ya se mostró el prompt anteriormente
            const promptShown = localStorage.getItem('notification_prompt_shown');

            if (!promptShown) {
                // Verificar estado actual de forma segura
                const getNotificationStatus = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
                    if (typeof window === 'undefined') return 'unsupported';
                    if (!('Notification' in window)) return 'unsupported';

                    // Acceso seguro a Notification.permission
                    try {
                        return Notification.permission;
                    } catch {
                        return 'unsupported';
                    }
                };

                const notificationStatus = getNotificationStatus();

                if (notificationStatus === 'default') {
                    // Mostrar prompt para solicitar permisos
                    const timer = setTimeout(() => {
                        setShowNotificationPrompt(true);
                    }, 2000);
                    return () => clearTimeout(timer);
                } else if (notificationStatus === 'granted') {

                    // Ya tiene permisos, inicializar notificaciones
                    initPushNotifications(barber.id);
                    setNotificationPromptShown(true);
                    localStorage.setItem('notification_prompt_shown', 'true');
                } else {
                    // Denegado o no soportado
                    setNotificationPromptShown(true);
                    localStorage.setItem('notification_prompt_shown', 'true');
                }
            }
        }
    }, [barber, notificationPromptShown]);

    // Manejar aceptación del prompt
    const handleNotificationAccept = async () => {

        console.log('Usuario aceptó notificaciones');
        setNotificationPromptShown(true);
        setShowNotificationPrompt(false);

        // Guardar que el prompt ya fue mostrado y aceptado
        localStorage.setItem('notification_prompt_shown', 'true');

        // Inicializar notificaciones de forma segura
        if (barber?.id) {
            const success = await initPushNotifications(barber.id);
            if (success) {
                console.log('Notificaciones configuradas exitosamente');
            } else {
                console.log('No se pudieron configurar las notificaciones');
            }
        }
    };

    // Manejar rechazo del prompt
    const handleNotificationDismiss = () => {
        console.log('Usuario rechazó notificaciones');
        setNotificationPromptShown(true);
        setShowNotificationPrompt(false);

        // Guardar que el prompt ya fue mostrado (aunque fue rechazado)
        localStorage.setItem('notification_prompt_shown', 'true');
    };

    // Botón de prueba de notificaciones
    const testNotification = async () => {

        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;

            // Enviar mensaje al service worker para mostrar notificación
            registration.active?.postMessage({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    title: '🧪 Notificación de Prueba',
                    body: 'Esta es una prueba del sistema push',
                    icon: '/assets/logo.jpg',
                    tag: 'test-notification'
                }
            });

            console.log('🧪 Mensaje de prueba enviado al service worker');
        }
    };

    // Walk-in form state
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictingApt, setConflictingApt] = useState<any>(null);
    const [walkInClientName, setWalkInClientName] = useState("");
    const [selectedServiceId, setSelectedServiceId] = useState("");
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);

    // Use local date (YYYY-MM-DD) for initial render and other functions
    const today = new Date().toLocaleDateString('en-CA');

    async function fetchData() {
        setLoading(true);
        // Recalculate today to ensure fresh data on every fetch (overrides outer today)
        const today = new Date().toLocaleDateString('en-CA');

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push("/login");
            return;
        }

        const { data: barberData } = await supabase
            .from("barberos")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

        if (barberData) {
            setBarber(barberData);

            const { data: apts } = await supabase
                .from("citas")
                .select(`
                    id, hora_inicio, hora_fin, estado, monto_total, duracion_minutos,
                    clientes (nombre, telefono),
                    servicios (nombre)
                `)
                .eq("barbero_id", barberData.id)
                .eq("fecha", today)
                .order("hora_inicio");

            if (apts) {
                const typedApts = apts as any[];
                setAppointments(typedApts);

                const activeCuts = typedApts.filter(a => a.estado !== "CANCELADA");
                const completed = typedApts.filter(a => a.estado === "COMPLETADA");

                setStats({
                    totalCuts: activeCuts.length,
                    totalEarnings: completed.reduce((acc, curr) => acc + (curr.monto_total || 0), 0)
                });

                const now = new Date();
                const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
                const next = typedApts.find(a => a.estado !== "COMPLETADA" && a.estado !== "CANCELADA" && a.hora_inicio >= currentTimeStr);
                setNextAppointment(next || null);
            }
        }

        const { data: srvs } = await supabase.from("servicios").select("*").order("nombre");
        if (srvs) setServices(srvs);

        setLoading(false);
    }

    useEffect(() => {

        fetchData();

        const channel = supabase
            .channel('dashboard-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const handleCheckIn = async (id: string) => {
        const { error } = await supabase
            .from("citas")
            .update({ estado: "EN_ATENCION" })
            .eq("id", id);
        if (error) alert("Error al hacer check-in");
        else fetchData();
    };

    const handleComplete = async (id: string) => {
        const { error } = await supabase
            .from("citas")
            .update({ estado: "COMPLETADA" })
            .eq("id", id);
        if (error) alert("Error al completar cita");
        else fetchData();
    };

    const handleConfirmAction = (action: () => void) => {
        setConfirmAction(() => action);
        setShowConfirmModal(true);
    };

    const handleCancel = async (id: string) => {
        const { error } = await supabase
            .from("citas")
            .update({ estado: "CANCELADA" })
            .eq("id", id);
        if (error) alert("Error al cancelar cita");
        else fetchData();
    };

    const handleWalkInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedServiceId || !barber) return;
        const service = services.find(s => s.id === selectedServiceId);
        if (!service) return;

        // Conflict check
        const now = new Date();
        const startStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
        const duration = service.duracion_minutos || 30;
        const end = new Date(now.getTime() + duration * 60000);
        const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`;
        const conflict = appointments.find(a =>
            (a.estado !== 'COMPLETADA' && a.estado !== 'CANCELADA') &&
            ((startStr >= a.hora_inicio && startStr < a.hora_fin) ||
                (endStr > a.hora_inicio && endStr <= a.hora_fin) ||
                (startStr <= a.hora_inicio && endStr >= a.hora_fin))
        );

        if (conflict) {
            setConflictingApt(conflict);
            setShowConflictModal(true);
            return;
        }

        saveWalkIn(walkInClientName, service, startStr, endStr, duration);
    };

    const saveWalkIn = async (clientName: string, service: Service, start: string, end: string, duration: number) => {
        setIsSubmittingManual(true);
        try {

            // 1. Create client
            const { data: clientData, error: clientError } = await supabase
                .from("clientes")
                .insert([{ nombre: clientName.trim() || "Cliente Presencial" }])
                .select()
                .single();

            if (clientError) throw clientError;

            // 2. Create appointment
            const { error: bookingError } = await supabase
                .from("citas")
                .insert([{
                    cliente_id: clientData.id,
                    barbero_id: barber.id,
                    servicio_id: service.id,
                    fecha: today,
                    hora_inicio: start,
                    hora_fin: end,
                    duracion_minutos: duration,
                    monto_total: service.precio,
                    origen: 'WALK_IN',
                    estado: 'EN_ATENCION'
                }]);
            if (bookingError) throw bookingError;

            // NOTA: Los walk-ins creados por admin no disparan notificaciones

            // porque el admin ya está al tanto de la cita

            setShowWalkInModal(false);
            setShowConflictModal(false);
            setWalkInClientName("");
            setSelectedServiceId("");
            fetchData();
        } catch (error: any) {
            console.error("Error creating walk-in:", error);
            alert("Error al registrar: " + error.message);
        } finally {
            setIsSubmittingManual(false);
        }
    };

    return (

        <div className="bg-background-light dark:bg-background-dark font-display text-primary dark:text-white antialiased selection:bg-black selection:text-white min-h-screen">
            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="glass-panel rounded-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-xl">warning</span>
                            </div>
                            <h3 className="text-primary dark:text-white text-lg font-bold">Confirmar Acción</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">¿Estás seguro de cancelar esta cita?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-medium text-primary dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    confirmAction();
                                    setShowConfirmModal(false);
                                }}
                                className="flex-1 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-gray-200 to-transparent opacity-60 blur-3xl dark:from-gray-800"></div>
                <div className="absolute bottom-[10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-gray-300 to-transparent opacity-60 blur-3xl dark:from-gray-700"></div>
            </div>

            <div className="relative flex flex-col min-h-screen w-full max-w-md mx-auto pb-24">
                <header className="flex items-center p-6 justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <div className="bg-neutral-200 dark:bg-neutral-800 rounded-full w-10 h-10 shadow-sm border-2 border-white flex items-center justify-center overflow-hidden">
                                <img src="/assets/barberos/barbero1.jpg" className="w-full h-full object-cover" alt="Foto de perfil del barbero" />
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Buenos días</span>
                            <h2 className="text-xl font-bold leading-none tracking-tight">{barber?.nombre || "Cargando..."}</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchData()}
                            className="w-10 h-10 rounded-full bg-white/50 dark:bg-white/5 active:bg-white/80 dark:active:bg-white/10 flex items-center justify-center transition-all hover:bg-white/60 dark:hover:bg-white/10"
                            title="Actualizar datos"
                        >
                            <span className="material-symbols-outlined text-[20px] text-neutral-600 dark:text-neutral-300">refresh</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-90"
                            title="Cerrar Sesión"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                        </button>
                    </div>
                </header>

                {/* Push Permission Prompt */}
                {showNotificationPrompt && barber && (
                    <PushPermissionPrompt
                        onAccept={handleNotificationAccept}
                        onDismiss={handleNotificationDismiss}
                    />
                )}

                {/* Botón de prueba de notificaciones */}
                {/* Test Notification Button - DISABLED (notifications working on newer iPhones) */}
                {/* Uncomment to enable test button */}
                {/* barber && (

                    <button

                        onClick={testNotification}

                        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 transition-colors z-50"

                    >

                        🧪 Probar Notificación

                    </button>

                ) */}

                <main className="flex flex-col gap-6 px-4">

                    {/* Walk-in Button (Prominent) */}
                    <button
                        onClick={() => setShowWalkInModal(true)}
                        className="w-full h-16 bg-white dark:bg-neutral-800 border-2 border-dashed border-primary/30 rounded-2xl flex items-center justify-center gap-3 text-primary dark:text-white hover:bg-primary/5 transition-all active:scale-[0.98] shadow-sm"
                    >
                        <span className="material-symbols-outlined text-2xl">person_add</span>
                        <span className="font-bold text-base">Registrar Turno Presencial</span>
                    </button>

                    {/* Next Appointment Card */}
                    <section className="relative group">
                        {loading ? (
                            <div className="glass-card-strong rounded-2xl p-5 h-40 animate-pulse flex items-center justify-center">
                                <span className="text-neutral-400 font-medium italic">Cargando siguiente turno...</span>
                            </div>
                        ) : nextAppointment ? (
                            <div className="glass-card-strong rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                                        Siguiente Turno
                                    </span>
                                    <div className="flex items-center text-primary dark:text-white font-mono font-bold text-lg">
                                        <span className="material-symbols-outlined mr-1 text-lg">schedule</span>
                                        {formatTime12Hour(nextAppointment.hora_inicio.substring(0, 5))}
                                    </div>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="w-14 h-14 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-neutral-500">
                                        {nextAppointment.clientes?.nombre?.substring(0, 2).toUpperCase() || "WN"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                                            {nextAppointment.clientes?.nombre || "Walk-in"}
                                        </h3>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                                            {nextAppointment.servicios?.nombre}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-700 flex gap-3">
                                    {nextAppointment.estado === "PROGRAMADA" ? (
                                        <button
                                            onClick={() => handleCheckIn(nextAppointment.id)}
                                            className="flex-1 bg-primary text-white h-11 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-xl">login</span>
                                            Iniciar Atención
                                        </button>
                                    ) : nextAppointment.estado === "EN_ATENCION" ? (
                                        <button
                                            onClick={() => handleComplete(nextAppointment.id)}
                                            className="flex-1 bg-black dark:bg-white dark:text-black text-white h-11 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-xl">check_circle</span>
                                            Finalizar Turno
                                        </button>
                                    ) : (
                                        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                                            {nextAppointment.estado}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card h-32 rounded-2xl flex flex-col items-center justify-center text-center p-6 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
                                <span className="material-symbols-outlined text-neutral-300 mb-1">event_available</span>
                                <p className="text-neutral-400 text-sm font-medium">No hay más citas agendadas por ahora</p>
                            </div>
                        )}
                    </section>

                    {/* Stats */}
                    <section className="grid grid-cols-2 gap-3">
                        <div className="glass-panel p-4 rounded-xl flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2 text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-sm">content_cut</span>
                                Cortes Hoy
                            </div>
                            <span className="text-3xl font-bold text-neutral-900 dark:text-white leading-none">{stats.totalCuts}</span>
                        </div>
                        <div className="glass-panel p-4 rounded-xl flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2 text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-sm">payments</span>
                                Ganancias
                            </div>
                            <span className="text-3xl font-bold text-neutral-900 dark:text-white leading-none tracking-tight">${stats.totalEarnings}</span>
                        </div>
                    </section>

                    {/* Today's Agenda List */}
                    <section className="flex flex-col gap-4 mt-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Agenda de Hoy</h3>
                            <Link href="/admin/agenda" className="text-xs font-bold text-neutral-400 uppercase tracking-widest hover:text-primary transition-colors">
                                Ver todo
                            </Link>
                        </div>

                        <div className="flex flex-col gap-3">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <div key={i} className="h-20 bg-white/50 dark:bg-neutral-800/50 rounded-2xl animate-pulse"></div>
                                ))
                            ) : appointments.length === 0 ? (
                                <div className="py-10 text-center">
                                    <p className="text-neutral-400 text-sm font-medium">No hay citas para hoy</p>
                                </div>
                            ) : (
                                appointments.map((apt) => (
                                    <div
                                        key={apt.id}
                                        className="glass-card-strong rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-white/40 dark:hover:bg-neutral-800/40 cursor-pointer relative group"
                                        onClick={() => {
                                            if (apt.estado === 'PROGRAMADA' || apt.estado === 'EN_ATENCION') {
                                                setSelectedAppointment(apt);
                                                setShowOptionsModal(true);
                                            }
                                        }}
                                    >
                                        <div className="flex flex-col items-center justify-center min-w-[50px]">
                                            <span className="text-sm font-bold text-neutral-900 dark:text-white">
                                                {formatTime12Hour(apt.hora_inicio.substring(0, 5))}
                                            </span>
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase">
                                                {parseInt(apt.hora_inicio.split(":")[0]) >= 12 ? "PM" : "AM"}
                                            </span>
                                        </div>

                                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-500 overflow-hidden">
                                            {apt.clientes?.nombre?.substring(0, 2).toUpperCase() || "W"}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                                                {apt.clientes?.nombre || "Walk-in"}
                                            </h4>
                                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                                                {apt.servicios?.nombre} • {formatTime12Hour(apt.hora_inicio.substring(0, 5))} • {apt.duracion_minutos || 30} min
                                            </p>

                                            {/* Contact Buttons */}
                                            {apt.clientes?.telefono && (
                                                <div className="flex gap-1.5 mt-2">
                                                    <a
                                                        href={`tel:${apt.clientes.telefono}`}
                                                        className="flex-1 flex items-center justify-center gap-1 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 py-1 px-2 rounded-lg text-[9px] font-bold hover:bg-green-100 dark:hover:bg-green-900/20 transition-all active:scale-95"
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
                                                        className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 py-1 px-2 rounded-lg text-[9px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all active:scale-95"
                                                    >
                                                        {/* <span className="material-symbols-outlined text-xs">chat</span> */}
                                                        WhatsApp
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${apt.estado === 'COMPLETADA' ? 'bg-green-100 text-green-600' :
                                            apt.estado === 'CANCELADA' ? 'bg-red-100 text-red-600' :
                                                apt.estado === 'EN_ATENCION' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-neutral-100 text-neutral-500'
                                            }`}>
                                            {apt.estado}
                                        </div>

                                        {/* Indicador de clic para citas activas */}
                                        {(apt.estado === 'PROGRAMADA' || apt.estado === 'EN_ATENCION') && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="material-symbols-outlined text-neutral-400 text-[16px]">more_vert</span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </main>

                {/* Walk-in Modal */}
                {showWalkInModal && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8 transition-all">
                        <div className="glass-card-strong w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Turno Presencial</h3>
                                <button onClick={() => setShowWalkInModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleWalkInSubmit} className="flex flex-col gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Nombre (Opcional)</label>
                                    <input
                                        type="text"
                                        value={walkInClientName}
                                        onChange={(e) => setWalkInClientName(e.target.value)}
                                        placeholder="P. ej. Juan Pérez"
                                        className="w-full h-12 rounded-xl bg-neutral-50 dark:bg-neutral-900 border-none px-4 text-sm font-medium focus:ring-2 ring-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Servicio</label>
                                    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1 no-scrollbar pb-2">
                                        {services.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => setSelectedServiceId(s.id)}
                                                className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${selectedServiceId === s.id
                                                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                                                    : "border-neutral-50 dark:border-neutral-900 hover:border-neutral-200 dark:hover:border-neutral-700"
                                                    }`}
                                            >
                                                <div className="flex flex-col items-start text-left">
                                                    <span className={`text-sm font-bold ${selectedServiceId === s.id ? "text-primary dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}>
                                                        {s.nombre}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">
                                                        {s.duracion_minutos} min
                                                    </span>
                                                </div>
                                                <span className={`text-sm font-black ${selectedServiceId === s.id ? "text-primary dark:text-white" : "text-neutral-900 dark:text-white font-mono"}`}>
                                                    ${s.precio}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    disabled={isSubmittingManual}
                                    type="submit"
                                    className="w-full h-14 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold mt-2 shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmittingManual ? "Registrando..." : (
                                        <>
                                            <span className="material-symbols-outlined">bolt</span>
                                            Comenzar Ahora
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Conflict Warning Modal */}
                {showConflictModal && conflictingApt && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md px-6 transition-all">
                        <div className="glass-card-strong w-full max-w-sm rounded-[32px] p-8 shadow-2xl border-2 border-primary/20 animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">warning</span>
                            </div>

                            <h3 className="text-2xl font-black text-center mb-3">¿Cita de último momento?</h3>
                            <p className="text-neutral-500 dark:text-neutral-400 text-center text-sm leading-relaxed mb-8">
                                Este registro choca con la cita de <span className="text-neutral-900 dark:text-white font-bold">{conflictingApt.clientes?.nombre || "otro cliente"}</span> a las <span className="text-primary font-mono font-bold">{conflictingApt.hora_inicio.substring(0, 5)}</span>.
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        const service = services.find(s => s.id === selectedServiceId);
                                        const now = new Date();
                                        const startStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
                                        const duration = service?.duracion_minutos || 30;
                                        const end = new Date(now.getTime() + duration * 60000);
                                        const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`;
                                        saveWalkIn(walkInClientName, service as any, startStr, endStr, duration);
                                    }}

                                    disabled={isSubmittingManual}
                                    className="w-full h-14 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {isSubmittingManual ? "Registrando..." : "Registrar de todas formas"}
                                </button>

                                <button
                                    onClick={() => setShowConflictModal(false)}
                                    className="w-full h-12 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold text-sm"
                                >
                                    Cancelar y revisar agenda
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {/* Options Modal */}
                {showOptionsModal && selectedAppointment && (

                    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8 transition-all">
                        <div className="glass-card-strong w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Opciones de Cita</h3>
                                <button onClick={() => setShowOptionsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 mb-6">
                                <div className="glass-panel p-4 rounded-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-500">
                                            {selectedAppointment.clientes?.nombre?.substring(0, 2).toUpperCase() || "W"}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-neutral-900 dark:text-white">
                                                {selectedAppointment.clientes?.nombre || "Walk-in"}
                                            </h4>
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                                {formatTime12Hour(selectedAppointment.hora_inicio.substring(0, 5))} • {selectedAppointment.servicios?.nombre}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter inline-block ${selectedAppointment.estado === 'COMPLETADA' ? 'bg-green-100 text-green-600' :
                                        selectedAppointment.estado === 'CANCELADA' ? 'bg-red-100 text-red-600' :
                                            selectedAppointment.estado === 'EN_ATENCION' ? 'bg-blue-100 text-blue-600' :
                                                'bg-neutral-100 text-neutral-500'
                                        }`}>
                                        {selectedAppointment.estado}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {selectedAppointment.estado === 'PROGRAMADA' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                handleCheckIn(selectedAppointment.id);
                                                setShowOptionsModal(false);
                                            }}

                                            className="w-full h-12 bg-primary text-white rounded-xl font-bold hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">login</span>
                                            Iniciar Atención
                                        </button>
                                        <button

                                            onClick={() => {
                                                handleComplete(selectedAppointment.id);
                                                setShowOptionsModal(false);
                                            }}

                                            className="w-full h-12 bg-black dark:bg-white dark:text-black text-white rounded-xl font-bold hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">check_circle</span>
                                            Marcar Completada
                                        </button>
                                    </>
                                )}

                                {selectedAppointment.estado === 'EN_ATENCION' && (
                                    <button
                                        onClick={() => {
                                            handleComplete(selectedAppointment.id);
                                            setShowOptionsModal(false);
                                        }}
                                        className="w-full h-12 bg-black dark:bg-white dark:text-black text-white rounded-xl font-bold hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Finalizar Turno
                                    </button>
                                )}

                                {(selectedAppointment.estado === 'PROGRAMADA' || selectedAppointment.estado === 'EN_ATENCION') && (
                                    <button
                                        onClick={() => {
                                            setShowOptionsModal(false);
                                            setTimeout(() => {
                                                handleConfirmAction(() => {
                                                    handleCancel(selectedAppointment.id);
                                                });
                                            }, 100);
                                        }}
                                        className="w-full h-12 border border-red-200 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">cancel</span>
                                        Cancelar Cita
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowOptionsModal(false)}
                                    className="w-full h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl font-bold"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                        appointmentDate={today}
                        appointmentTime={selectedAppointment.hora_inicio}
                    />
                )}

                {/* Bottom Navigation */}

                <nav className="fixed bottom-0 left-0 w-full z-30 flex justify-center pb-2 pt-2 px-4 pointer-events-none">
                    <div className="glass-card-strong w-full max-w-md rounded-2xl flex justify-around items-center h-16 pointer-events-auto shadow-2xl bg-white/60 backdrop-blur-sm">
                        <Link href="/admin/barber" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-primary dark:text-white">
                            <span className="material-symbols-outlined text-[26px]">grid_view</span>
                            <span className="text-[10px] font-medium">Panel</span>
                        </Link>
                        <Link href="/admin/agenda" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
                            <span className="text-[10px] font-medium">Agenda</span>
                        </Link>
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

