"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

interface Client {
    id: string;
    nombre: string;
    telefono: string;
    lastVisit?: string;
    totalVisits?: number;
    nextAppointment?: {
        fecha: string;
        hora_inicio: string;
    };
}

interface RawClientData {
    id: string;
    nombre: string;
    telefono: string;
    citas: {
        fecha: string;
        estado: string;
        hora_inicio: string;
    }[];
}

export default function ClientsDirectory() {
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');

    const fetchClients = React.useCallback(async () => {
        let isMounted = true;
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push("/login");
            return;
        }

        // Fetch clients with their recent appointments
        const { data, error } = await supabase
            .from("clientes")
            .select(`
                id,
                nombre,
                telefono,
                citas (
                    fecha,
                    estado,
                    hora_inicio
                )
            `)
            .order("nombre");

        if (data && isMounted) {
            const formattedClients = data.map((c: RawClientData) => {
                const completedCitas = c.citas
                    .filter((apt) => apt.estado === "COMPLETADA")
                    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

                // Get today's date without time for comparison
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const upcomingCitas = c.citas
                    .filter((apt) => apt.estado === "PROGRAMADA" || apt.estado === "CREADA")
                    .filter((apt) => {
                        const aptDate = new Date(apt.fecha + "T00:00:00");
                        aptDate.setHours(0, 0, 0, 0);
                        return aptDate >= today;
                    })
                    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

                let lastVisit = "Sin visitas";
                if (completedCitas.length > 0) {
                    const latest = new Date(completedCitas[0].fecha + "T00:00:00");
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (latest.getTime() === today.getTime()) {
                        lastVisit = "Hoy";
                    } else {
                        lastVisit = latest.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
                    }
                }

                return {
                    id: c.id,
                    nombre: c.nombre,
                    telefono: c.telefono,
                    lastVisit,
                    totalVisits: completedCitas.length,
                    nextAppointment: upcomingCitas.length > 0 ? {
                        fecha: upcomingCitas[0].fecha,
                        hora_inicio: upcomingCitas[0].hora_inicio
                    } : undefined
                };
            });
            // Deduplicar clientes por nombre + teléfono (mantener el con más visitas)
            const clientMap = new Map<string, Client>();
            formattedClients.forEach(client => {
                const key = `${client.nombre.toLowerCase()}_${client.telefono}`;
                const existing = clientMap.get(key);

                // Si no existe o el actual tiene más visitas, guardarlo
                if (!existing || (client.totalVisits || 0) >= (existing.totalVisits || 0)) {
                    clientMap.set(key, client);
                }
            });

            // Convertir Map a array y ordenar por nombre
            const uniqueClients = Array.from(clientMap.values()).sort((a, b) =>
                a.nombre.localeCompare(b.nombre)
            );

            setClients(uniqueClients);
        }
        setLoading(false);
    }, [router]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    useAutoRefresh(fetchClients);

    const filteredClients = clients.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefono.includes(searchTerm)
    );

    const handleWhatsAppClick = (client: Client) => {
        setSelectedClient(client);
        setShowWhatsAppModal(true);
    };

    const formatPhoneForWhatsApp = (phone: string | null | undefined): string => {
        if (!phone) return '';
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleaned.startsWith('+') && !cleaned.startsWith('57')) {
            cleaned = '57' + cleaned;
        }
        return cleaned.replace('+', '');
    };

    const getMessageTemplate = (template: string): string => {
        if (!selectedClient) return '';

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

        switch (template) {
            case 'reminder':
                if (selectedClient.nextAppointment) {
                    const fecha = formatDate(selectedClient.nextAppointment.fecha);
                    const hora = formatTime(selectedClient.nextAppointment.hora_inicio);
                    return `Hola ${selectedClient.nombre} ✂️\n\nTe recordamos tu cita programada para el ${fecha} a las ${hora}.\n\nTe esperamos en Los Más Bárbaros 💈`;
                } else {
                    return `Hola ${selectedClient.nombre} ✂️\n\nTe recordamos tu próxima cita.\n\nTe esperamos en Los Más Bárbaros 💈`;
                }
            case 'confirm':
                if (selectedClient.nextAppointment) {
                    const fecha = formatDate(selectedClient.nextAppointment.fecha);
                    const hora = formatTime(selectedClient.nextAppointment.hora_inicio);
                    return `Hola ${selectedClient.nombre},\n\n¿Confirmas tu asistencia para el ${fecha} a las ${hora}?\n\nPor favor responde para confirmar tu cita.`;
                } else {
                    return `Hola ${selectedClient.nombre},\n\n¿Confirmas tu asistencia a tu próxima cita?\n\nPor favor responde para confirmar.`;
                }
            default:
                return '';
        }
    };

    const sendWhatsApp = (template: string) => {
        if (!selectedClient) return;

        // Debug log
        console.log('Cliente seleccionado:', selectedClient);

        if (!selectedClient.telefono) {
            alert("Este cliente no tiene número de teléfono registrado.");
            return;
        }

        const message = template === 'custom' ? '' : getMessageTemplate(template);
        console.log('Mensaje generado:', message);

        const phone = formatPhoneForWhatsApp(selectedClient.telefono);

        if (!phone) {
            alert("El número de teléfono no es válido para WhatsApp.");
            return;
        }

        const whatsappUrl = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

        window.open(whatsappUrl, '_blank');
        setShowWhatsAppModal(false);
        setSelectedTemplate('');
    };

    const recentClients = [...filteredClients]
        .filter(c => c.totalVisits && c.totalVisits > 0)
        .slice(0, 3);

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-[#141414] dark:text-white antialiased selection:bg-black selection:text-white min-h-screen">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-gray-200 to-transparent opacity-60 blur-3xl dark:from-gray-800"></div>
                <div className="absolute bottom-[10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-gray-300 to-transparent opacity-60 blur-3xl dark:from-gray-700"></div>
            </div>

            <div className="relative flex flex-col min-h-screen w-full max-w-md mx-auto pb-24">
                <header className="flex flex-col p-6 pb-4 pt-12">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                                Clientes
                            </h1>
                            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium mt-1">
                                {clients.length} Total
                            </p>
                        </div>
                    </div>
                </header>

                <div className="px-4 mb-2 sticky top-4 z-40">
                    <div className="glass-card-strong rounded-2xl flex items-center px-4 py-3 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-xl transition-all">
                        <span className="material-symbols-outlined text-neutral-400 text-xl">
                            search
                        </span>
                        <input
                            className="bg-transparent border-none focus:ring-0 w-full text-sm font-medium placeholder-neutral-400 text-neutral-900 dark:text-white ml-2 p-0"
                            placeholder="Buscar por nombre o teléfono..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <main className="flex flex-col gap-3 px-4 pt-4">
                    {loading ? (
                        <div className="text-center py-20 text-neutral-400 font-medium">Cargando clientes...</div>
                    ) : filteredClients.length === 0 ? (
                        <div className="text-center py-20">
                            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">person_search</span>
                            <p className="text-neutral-400 font-medium">No se encontraron clientes</p>
                        </div>
                    ) : (
                        <>
                            {recentClients.length > 0 && !searchTerm && (
                                <>
                                    <div className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider ml-1 mt-2 mb-1">
                                        Fieles y Recientes
                                    </div>
                                    {recentClients.map((client) => (
                                        <ClientCard key={client.id} client={client} onWhatsAppClick={handleWhatsAppClick} />
                                    ))}
                                    <div className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider ml-1 mt-6 mb-1">
                                        Todos los clientes
                                    </div>
                                </>
                            )}

                            {(searchTerm ? filteredClients : clients).map((client) => (
                                <ClientCard key={client.id} client={client} onWhatsAppClick={handleWhatsAppClick} />
                            ))}
                        </>
                    )}
                </main>

                {/* WhatsApp Modal */}
                {showWhatsAppModal && selectedClient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                        <div className="glass-card-strong rounded-2xl p-6 w-full max-w-sm">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-neutral-800 dark:text-white">Mensaje a {selectedClient.nombre}</h3>
                                <button
                                    onClick={() => setShowWhatsAppModal(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-400">close</span>
                                </button>
                            </div>

                            {/* Template Options */}
                            <div className="space-y-3 mb-6">
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
                                onClick={() => setShowWhatsAppModal(false)}
                                className="w-full py-3 glass-panel rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:bg-white/80 dark:hover:bg-neutral-800/80 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 w-full z-30 flex justify-center pb-2 pt-2 px-4 pointer-events-none">
                    <div className="glass-card-strong w-full max-w-md rounded-2xl flex justify-around items-center h-16 pointer-events-auto shadow-2xl">
                        <Link
                            href="/admin/barber"
                            className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[26px]">grid_view</span>
                            <span className="text-[10px] font-medium">Panel</span>
                        </Link>
                        <Link
                            href="/admin/agenda"
                            className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
                            <span className="text-[10px] font-medium">Agenda</span>
                        </Link>
                        <button className="flex flex-col items-center justify-center w-16 h-full gap-1 text-primary dark:text-white">
                            <span className="material-symbols-outlined text-[26px]">groups</span>
                            <span className="text-[10px] font-medium">Clientes</span>
                        </button>
                        <Link
                            href="/admin/ingresos"
                            className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[26px]">trending_up</span>
                            <span className="text-[10px] font-medium">Ingresos</span>
                        </Link>
                        <Link
                            href="/admin/settings"
                            className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[26px]">settings</span>
                            <span className="text-[10px] font-medium">Config</span>
                        </Link>
                    </div>
                </nav>
            </div>
        </div>
    );
}

function ClientCard({ client, onWhatsAppClick }: { client: Client, onWhatsAppClick: (client: Client) => void }) {
    return (
        <div className="glass-panel p-3 rounded-2xl">
            <div className="flex items-center gap-4">
                <div className="bg-neutral-200 dark:bg-neutral-800 focus-within:ring-2 ring-primary rounded-full w-14 h-14 shadow-sm border-2 border-white/40 dark:border-white/10 flex items-center justify-center text-lg font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                    {client.nombre.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                        {client.nombre}
                    </h3>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">call</span>
                            {client.telefono}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                            Última visita: {client.lastVisit}
                        </p>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3">
                <a
                    href={`tel:${client.telefono}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 py-2 rounded-xl text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/20 transition-all active:scale-95"
                >
                    {/* <span className="material-symbols-outlined text-sm">call</span> */}
                    Llamar
                </a>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onWhatsAppClick(client);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 py-2 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all active:scale-95"
                >
                    {/* <span className="material-symbols-outlined text-sm">chat</span> */}
                    WhatsApp
                </button>
            </div>
        </div>
    );
}
