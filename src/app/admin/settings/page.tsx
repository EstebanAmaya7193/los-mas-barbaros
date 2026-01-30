"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Barber {
    id: string;
    nombre: string;
    email: string;
    foto_url?: string;
    telefono?: string;
    especialidad?: string;
}

interface Schedule {
    id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fin: string;
    activo: boolean;
}

interface Block {
    id: string;
    nombre: string;
    dia_semana: number | null;
    fecha: string | null;
    hora_inicio: string;
    hora_fin: string;
}

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function SettingsPage() {
    const router = useRouter();
    const [barber, setBarber] = useState<Barber | null>(null);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictData, setConflictData] = useState<{ count: number; message: string } | null>(null);
    const [newBlock, setNewBlock] = useState({
        nombre: "",
        fecha: "",
        hora_inicio: "13:00",
        hora_fin: "14:00"
    });

    useEffect(() => {
        async function fetchData() {
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

                // Fetch schedules
                const { data: scheds } = await supabase
                    .from("horarios_barberos")
                    .select("*")
                    .eq("barbero_id", barberData.id)
                    .order("dia_semana");

                if (scheds) setSchedules(scheds);

                // Fetch blocks
                const { data: blks } = await supabase
                    .from("bloqueos_barberos")
                    .select("*")
                    .eq("barbero_id", barberData.id)
                    .order("created_at", { ascending: false });

                if (blks) setBlocks(blks);
            }
            setLoading(false);
        }
        fetchData();
    }, [router]);

    const handleToggleDay = (dia: number) => {
        setSchedules(prev => prev.map(s =>
            s.dia_semana === dia ? { ...s, activo: !s.activo } : s
        ));
    };

    const handleTimeChange = (dia: number, field: 'hora_inicio' | 'hora_fin', value: string) => {
        setSchedules(prev => prev.map(s =>
            s.dia_semana === dia ? { ...s, [field]: value } : s
        ));
    };

    const handleSave = async () => {
        if (!barber) return;
        setSaving(true);
        try {
            // Upsert schedules
            const schedulesByDay = new Map(schedules.map((s) => [s.dia_semana, s]));
            const schedulesPayload = Array.from(schedulesByDay.values()).map((s) => ({
                barbero_id: barber.id,
                dia_semana: s.dia_semana,
                hora_inicio: s.hora_inicio,
                hora_fin: s.hora_fin,
                activo: s.activo,
            }));

            const { error } = await supabase
                .from("horarios_barberos")
                .upsert(schedulesPayload, { onConflict: "barbero_id,dia_semana" });

            if (error) throw error;
            alert("¡Cambios guardados correctamente! ✨");
        } catch (err: unknown) {
            console.error("Error saving settings:", err);
            const errorMessage = err instanceof Error ? err.message : "Error desconocido";
            alert("Error al guardar: " + errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barber) return;
        setSaving(true);
        
        try {
            // Validar si hay citas existentes en el rango a bloquear
            if (newBlock.fecha) {
                const { data: existingAppointments, error: checkError } = await supabase
                    .from("citas")
                    .select("id, hora_inicio, hora_fin")
                    .eq("barbero_id", barber.id)
                    .eq("fecha", newBlock.fecha)
                    .in("estado", ["PROGRAMADA", "EN_ATENCION"])
                    .or(`hora_inicio.lt.${newBlock.hora_fin}:00,hora_fin.gt.${newBlock.hora_inicio}:00`);

                if (checkError) throw checkError;

                if (existingAppointments && existingAppointments.length > 0) {
                    setConflictData({
                        count: existingAppointments.length,
                        message: `Hay ${existingAppointments.length} cita(s) agendada(s) en este rango. Por favor, cancela o reprograma las citas primero.`
                    });
                    setShowConflictModal(true);
                    return;
                }
            }

            // Si no hay citas, proceder con el bloqueo
            const { data, error } = await supabase
                .from("bloqueos_barberos")
                .insert([{
                    ...newBlock,
                    barbero_id: barber.id,
                    hora_inicio: newBlock.hora_inicio + ":00",
                    hora_fin: newBlock.hora_fin + ":00",
                    fecha: newBlock.fecha || null
                }])
                .select()
                .single();

            if (error) throw error;
            setBlocks(prev => [data, ...prev]);
            setShowBlockModal(false);
            setNewBlock({ nombre: "", fecha: "", hora_inicio: "13:00", hora_fin: "14:00" });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error desconocido";
            alert("Error: " + errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBlock = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar este bloqueo?")) return;
        const { error } = await supabase.from("bloqueos_barberos").delete().eq("id", id);
        if (error) alert("Error al eliminar");
        else setBlocks(prev => prev.filter(b => b.id !== id));
    };

    if (loading) return (
        <div className="min-h-screen bg-background-light flex items-center justify-center font-display">
            <p className="animate-pulse font-bold text-neutral-400 italic">Cargando configuración...</p>
        </div>
    );

    return (
        <div className="bg-background-light font-display text-primary antialiased h-screen flex flex-col overflow-hidden">
            {/* Top App Bar */}
            <header className="flex items-center justify-between bg-white/80 backdrop-blur-md px-5 py-4 sticky top-0 z-50 border-b border-gray-100">
                <Link href="/admin/barber" className="group flex size-10 items-center justify-center rounded-full hover:bg-black/5 transition-all active:scale-90">
                    <span className="material-symbols-outlined text-[28px] font-light">chevron_left</span>
                </Link>
                <h1 className="text-lg font-bold tracking-tight text-center flex-1 pr-10">Configuración</h1>
                <div className="w-2"></div>
            </header>

            {/* Scrollable Main Content */}
            <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
                <div className="p-5 flex flex-col gap-6 max-w-lg mx-auto w-full">

                    {/* Section: Semana Laboral */}
                    <div>
                        <h2 className="text-xl font-extrabold tracking-tight mb-4 px-1">Semana Laboral</h2>
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                                const sched = schedules.find(s => s.dia_semana === dia) || {
                                    dia_semana: dia,
                                    hora_inicio: "09:00:00",
                                    hora_fin: "18:00:00",
                                    activo: false
                                } as Schedule;

                                return (
                                    <div key={dia} className={`liquid-card rounded-2xl p-5 group transition-all duration-300 ${!sched.activo ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`text-lg font-bold ${!sched.activo ? 'text-gray-500' : ''}`}>{DAYS[dia]}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={sched.activo}
                                                    onChange={() => handleToggleDay(dia)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black"></div>
                                            </label>
                                        </div>

                                        {sched.activo && (
                                            <div className="grid grid-cols-2 gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-xs font-medium text-gray-500 ml-1">Desde</span>
                                                    <input
                                                        type="time"
                                                        value={sched.hora_inicio.substring(0, 5)}
                                                        onChange={(e) => handleTimeChange(dia, 'hora_inicio', e.target.value + ":00")}
                                                        className="liquid-input h-12 rounded-xl flex items-center justify-center text-sm font-semibold text-gray-900 w-full px-4 focus:ring-0 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-xs font-medium text-gray-500 ml-1">Hasta</span>
                                                    <input
                                                        type="time"
                                                        value={sched.hora_fin.substring(0, 5)}
                                                        onChange={(e) => handleTimeChange(dia, 'hora_fin', e.target.value + ":00")}
                                                        className="liquid-input h-12 rounded-xl flex items-center justify-center text-sm font-semibold text-gray-900 w-full px-4 focus:ring-0 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gray-200 w-full"></div>

                    {/* Section: Pausas y Bloqueos */}
                    <div>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="text-xl font-extrabold tracking-tight">Bloquear Horario</h2>
                            <button
                                onClick={() => setShowBlockModal(true)}
                                className="flex items-center justify-center size-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                <span className="material-symbols-outlined text-black" style={{ fontSize: '20px' }}>add</span>
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            {blocks.length === 0 ? (
                                <p className="text-center py-4 text-sm text-gray-400 italic">No tienes bloques configurados</p>
                            ) : (
                                blocks.map((block) => (
                                    <div key={block.id} className="liquid-card rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold text-gray-900">{block.nombre}</span>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                                    {block.fecha ? 'event' : 'schedule'}
                                                </span>
                                                <span>
                                                    {block.fecha ? `${block.fecha}, ` : ''}
                                                    {block.hora_inicio.substring(0, 5)} - {block.hora_fin.substring(0, 5)}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteBlock(block.id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-2"
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="h-10"></div>
                </div>
            </main>

            {/* Sticky Footer */}
            <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-white/50 p-5 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-lg mx-auto w-full">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-primary text-white font-bold text-base h-14 rounded-full shadow-lg shadow-black/20 hover:shadow-black/30 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
                    </button>
                </div>
            </footer>

            {/* Block Modal */}
            {showBlockModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm rounded-[32px] p-8 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-6">Nuevo Bloqueo</h3>
                        <form onSubmit={handleAddBlock} className="flex flex-col gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Motivo</label>
                                <input
                                    type="text"
                                    placeholder="P. ej. Almuerzo"
                                    required
                                    value={newBlock.nombre}
                                    onChange={e => setNewBlock({ ...newBlock, nombre: e.target.value })}
                                    className="liquid-input h-12 rounded-xl w-full px-4 text-sm font-medium focus:ring-0 focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Fecha (Opcional)</label>
                                <input
                                    type="date"
                                    value={newBlock.fecha}
                                    onChange={e => setNewBlock({ ...newBlock, fecha: e.target.value })}
                                    className="liquid-input h-12 rounded-xl w-full px-4 text-sm font-medium focus:ring-0 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Desde</label>
                                    <input
                                        type="time"
                                        required
                                        value={newBlock.hora_inicio}
                                        onChange={e => setNewBlock({ ...newBlock, hora_inicio: e.target.value })}
                                        className="liquid-input h-12 rounded-xl w-full px-4 text-sm font-medium focus:ring-0 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Hasta</label>
                                    <input
                                        type="time"
                                        required
                                        value={newBlock.hora_fin}
                                        onChange={e => setNewBlock({ ...newBlock, hora_fin: e.target.value })}
                                        className="liquid-input h-12 rounded-xl w-full px-4 text-sm font-medium focus:ring-0 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowBlockModal(false)}
                                    className="flex-1 h-12 border border-gray-200 rounded-xl text-sm font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-12 bg-black text-white rounded-xl text-sm font-bold shadow-lg shadow-black/20"
                                >
                                    {saving ? "Creando..." : "Crear"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 w-full z-30 flex justify-center pb-2 pt-2 px-4 pointer-events-none">
                <div className="glass-card-strong w-full max-w-md rounded-2xl flex justify-around items-center h-16 pointer-events-auto shadow-2xl">
                    <Link href="/admin/barber" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                        <span className="material-symbols-outlined text-[26px]">grid_view</span>
                        <span className="text-[10px] font-medium">Panel</span>
                    </Link>
                    <Link href="/admin/agenda" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                        <span className="material-symbols-outlined text-[26px]">calendar_month</span>
                        <span className="text-[10px] font-medium">Agenda</span>
                    </Link>
                    <Link href="/admin/clients" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                        <span className="material-symbols-outlined text-[26px]">groups</span>
                        <span className="text-[10px] font-medium">Clientes</span>
                    </Link>
                    <Link href="/admin/ingresos" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                        <span className="material-symbols-outlined text-[26px]">trending_up</span>
                        <span className="text-[10px] font-medium">Ingresos</span>
                    </Link>
                    <button className="flex flex-col items-center justify-center w-16 h-full gap-1 text-primary dark:text-white">
                        <span className="material-symbols-outlined text-[26px]">settings</span>
                        <span className="text-[10px] font-medium">Config</span>
                    </button>
                </div>
            </nav>

            {/* Conflict Modal */}
            {showConflictModal && conflictData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm rounded-[32px] p-8 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6 mx-auto">
                            <span className="material-symbols-outlined text-red-600 text-[32px]">event_busy</span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-center mb-4">Conflicto de Horario</h3>
                        
                        <div className="text-center mb-6">
                            <div className="text-3xl font-bold text-red-600 mb-2">{conflictData.count}</div>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {conflictData.message}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setShowConflictModal(false)}
                                className="w-full bg-black dark:bg-white dark:text-black text-white h-12 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all"
                            >
                                Entendido
                            </button>
                            
                            <button
                                onClick={() => {
                                    setShowConflictModal(false);
                                    router.push('/admin/agenda');
                                }}
                                className="w-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 h-12 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Ver Agenda
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
