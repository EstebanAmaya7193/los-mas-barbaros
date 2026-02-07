"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import SystemModal from "@/components/SystemModal";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

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
        hora_fin: "14:00",
        selectedDays: [] as number[] // For recurring blocks
    });

    // System Modal State
    const [systemModal, setSystemModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'alert' as 'alert' | 'confirm',
        variant: 'info' as 'info' | 'success' | 'warning' | 'danger',
        onConfirm: undefined as (() => void) | undefined,
        confirmText: 'Aceptar',
        cancelText: 'Cancelar'
    });

    const closeSystemModal = () => {
        setSystemModal(prev => ({ ...prev, isOpen: false }));
    };

    const fetchData = React.useCallback(async () => {
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

            // Fetch schedules with dynamic cache-busting
            // We use a non-matching ID filter generated dynamically to ensure a unique URL every request
            // preventing browser/PWA caching.
            const uniqueId = crypto.randomUUID();
            const { data: scheds } = await supabase
                .from("horarios_barberos")
                .select("*")
                .eq("barbero_id", barberData.id)
                .neq("id", uniqueId)
                .order("dia_semana");

            // Normalize schedules to ensure all 7 days exist in state
            const days = [0, 1, 2, 3, 4, 5, 6];
            const normalizedSchedules: Schedule[] = days.map(dia => {
                const existing = scheds?.find(s => s.dia_semana === dia);
                if (existing) return existing;
                return {
                    id: `temp-${dia}`, // Temporary ID for UI handling
                    dia_semana: dia,
                    hora_inicio: "09:00:00",
                    hora_fin: "20:00:00", // Default matching booking fallback roughly
                    activo: false
                };
            });

            setSchedules(normalizedSchedules);

            // Fetch blocks
            const { data: blks } = await supabase
                .from("bloqueos_barberos")
                .select("*")
                .eq("barbero_id", barberData.id)
                .order("created_at", { ascending: false });

            if (blks) setBlocks(blks);
        }
        setLoading(false);
    }, [router]);

    useEffect(() => {
        fetchData();

        // Subscribe to changes to ensure fresh data
        const channel = supabase
            .channel('settings_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'horarios_barberos' },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    useAutoRefresh(fetchData);

    const handleToggleDay = async (dia: number) => {
        // Find current state
        const currentSchedule = schedules.find(s => s.dia_semana === dia);
        if (!currentSchedule) return;

        // If currently active and we are disabling it...
        if (currentSchedule.activo) {
            // Check for future appointments on this day of week
            const today = new Date().toISOString().split('T')[0];
            const uniqueId = crypto.randomUUID();

            const { data: conflicts, error } = await supabase
                .from("citas")
                .select("id, fecha, hora_inicio")
                .eq("barbero_id", barber?.id)
                .gte("fecha", today)
                .in("estado", ["PROGRAMADA", "EN_ATENCION"])
                .neq("id", uniqueId); // Cache Buster

            if (conflicts && conflicts.length > 0) {
                // Filter client-side to be precise about day of week (0-6)
                // Use T12:00:00 to avoid timezone shifts
                const conflictsOnDay = conflicts.filter(c => {
                    const d = new Date(c.fecha + "T12:00:00");
                    return d.getDay() === dia;
                });

                if (conflictsOnDay.length > 0) {
                    setSystemModal({
                        isOpen: true,
                        title: 'Horario con Citas Activas',
                        message: `No puedes deshabilitar este día porque tienes ${conflictsOnDay.length} citas futuras programadas. ¿Deseas ir a la agenda para gestionarlas?`,
                        type: 'confirm',
                        variant: 'warning',
                        confirmText: 'Ir a la Agenda',
                        cancelText: 'Entendido',
                        onConfirm: () => router.push("/admin/agenda")
                    });
                    return; // Abort toggle
                }
            }
        }

        // Proceed with toggle if no conflicts or enabling
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
            // Process each schedule
            const updatedSchedules = [...schedules];

            for (let i = 0; i < updatedSchedules.length; i++) {
                const schedule = updatedSchedules[i];
                const isTemp = schedule.id.startsWith('temp-');

                let resultData = null;

                if (isTemp) {
                    // Insert new schedule
                    const { data, error } = await supabase
                        .from("horarios_barberos")
                        .insert([{
                            barbero_id: barber.id,
                            dia_semana: schedule.dia_semana,
                            hora_inicio: schedule.hora_inicio,
                            hora_fin: schedule.hora_fin,
                            activo: schedule.activo
                        }])
                        .select()
                        .single();

                    if (error) throw error;
                    resultData = data;
                } else {
                    // Update existing schedule and return it
                    const { data, error } = await supabase
                        .from("horarios_barberos")
                        .update({
                            hora_inicio: schedule.hora_inicio,
                            hora_fin: schedule.hora_fin,
                            activo: schedule.activo,
                        })
                        .eq("id", schedule.id)
                        .select()
                        .single();

                    if (error) throw error;
                    resultData = data;
                }

                // Update the object in our local array to match the DB response
                if (resultData) {
                    updatedSchedules[i] = resultData;
                }
            }

            // Batch update state with the authoritative data from DB
            setSchedules(updatedSchedules);

            setSystemModal({
                isOpen: true,
                title: '¡Cambios Guardados!',
                message: 'Tu configuración de horarios se ha actualizado correctamente.',
                type: 'alert',
                variant: 'success',
                onConfirm: undefined,
                confirmText: 'Genial',
                cancelText: ''
            });
            // REMOVED fetchData() to avoid PWA cache race conditions. 
            // The local state is now in sync with what the server just confirmed.
        } catch (err: unknown) {
            console.error("Error saving settings:", err);
            const errorMessage = err instanceof Error ? err.message : "Error desconocido";
            setSystemModal({
                isOpen: true,
                title: 'Error al Guardar',
                message: errorMessage,
                type: 'alert',
                variant: 'danger',
                onConfirm: undefined,
                confirmText: 'Entendido',
                cancelText: ''
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barber) return;
        setSaving(true);

        try {
            if (newBlock.fecha) {
                // Check for existing appointments
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

                const { data, error } = await supabase
                    .from("bloqueos_barberos")
                    .insert([{
                        nombre: newBlock.nombre,
                        barbero_id: barber.id,
                        hora_inicio: newBlock.hora_inicio + ":00",
                        hora_fin: newBlock.hora_fin + ":00",
                        fecha: newBlock.fecha,
                        dia_semana: null
                    }])
                    .select()
                    .single();

                if (error) throw error;
                setBlocks(prev => [data, ...prev]);
            } else {
                const { data, error } = await supabase
                    .from("bloqueos_barberos")
                    .insert([{
                        nombre: newBlock.nombre,
                        barbero_id: barber.id,
                        hora_inicio: newBlock.hora_inicio + ":00",
                        hora_fin: newBlock.hora_fin + ":00",
                        fecha: null,
                        dia_semana: null
                    }])
                    .select()
                    .single();

                if (error) throw error;
                setBlocks(prev => [data, ...prev]);
            }

            setShowBlockModal(false);
            setNewBlock({ nombre: "", fecha: "", hora_inicio: "13:00", hora_fin: "14:00", selectedDays: [] });
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
                <div className="p-5 flex flex-col gap-6 max-w-lg mx-auto w-full md:max-w-4xl md:grid md:grid-cols-2 md:gap-8">

                    {/* Left Column (Desktop): Schedule */}
                    <div className="md:col-span-1">
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

                    <div className="h-px bg-gray-200 w-full md:hidden"></div>

                    {/* Right Column (Desktop): Blocks & Footer Actions */}
                    <div className="md:col-span-1 flex flex-col gap-8">
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

                        {/* Save Button */}
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg"
                            >
                                {saving ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>
                    </div>

                </div>

                {/* Team Access Management Section */}
                <div className="max-w-lg mx-auto md:max-w-4xl w-full px-5 mt-8">
                    <TeamAccessManagement />
                </div>

                <div className="h-10"></div>
            </main>

            {/* System Modal */}
            <SystemModal
                isOpen={systemModal.isOpen}
                onClose={closeSystemModal}
                title={systemModal.title}
                message={systemModal.message}
                type={systemModal.type}
                variant={systemModal.variant}
                onConfirm={systemModal.onConfirm}
                confirmText={systemModal.confirmText}
                cancelText={systemModal.cancelText}
            />

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
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Tipo de Bloqueo</label>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="blockType"
                                            checked={!newBlock.fecha}
                                            onChange={() => setNewBlock({ ...newBlock, fecha: "" })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm font-medium">Recurrente (todos los días activos)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="blockType"
                                            checked={!!newBlock.fecha}
                                            onChange={() => {
                                                const today = new Date();
                                                const dateStr = today.toISOString().split('T')[0];
                                                setNewBlock({ ...newBlock, fecha: dateStr });
                                            }}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm font-medium">Fecha específica</span>
                                    </label>
                                </div>
                                {newBlock.fecha && (
                                    <input
                                        type="date"
                                        value={newBlock.fecha}
                                        onChange={e => setNewBlock({ ...newBlock, fecha: e.target.value })}
                                        className="liquid-input h-12 rounded-xl w-full px-4 text-sm font-medium focus:ring-0 focus:outline-none mt-2"
                                    />
                                )}
                                {!newBlock.fecha && (
                                    <p className="text-xs text-gray-500 italic mt-1">
                                        Se aplicará a todos los días habilitados en tu semana laboral
                                    </p>
                                )}
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

// Subcomponent for managing barber access
function TeamAccessManagement() {
    const [allBarbers, setAllBarbers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        fetchAllBarbers();
    }, []);

    async function fetchAllBarbers() {
        setLoading(true);
        // We fetch ALL barbers to allow linking
        const { data } = await supabase.from("barberos").select("*").order("nombre");
        if (data) setAllBarbers(data);
        setLoading(false);
    }

    async function handleUpdateUserId(barberId: string, newUserId: string) {
        setSavingId(barberId);
        const { error } = await supabase
            .from("barberos")
            .update({ user_id: newUserId || null })
            .eq("id", barberId);

        if (error) {
            alert("Error al vincular: " + error.message);
        } else {
            await fetchAllBarbers();
            alert("✅ Vinculación exitosa");
        }
        setSavingId(null);
    }

    if (loading) return null;

    return (
        <section className="glass-panel p-6 rounded-[32px] bg-white border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">shield_person</span>
                Gestión de Acceso del Equipo
            </h3>
            <p className="text-neutral-500 mb-6 text-sm">
                Vincula los usuarios de Supabase con los perfiles de barbero para permitirles el acceso.
                <br />
                1. Crea el usuario en Supabase Auth. 2. Copia su <strong>User UID</strong>. 3. Pégalo aquí.
            </p>

            <div className="grid gap-4">
                {allBarbers.map((b) => (
                    <div key={b.id} className="flex flex-col md:flex-row items-center gap-4 bg-gray-50 dark:bg-black/5 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-3 w-full md:w-1/3">
                            <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-neutral-500">
                                {b.nombre.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold">{b.nombre}</p>
                                <p className="text-xs text-neutral-400">{b.email}</p>
                            </div>
                        </div>

                        <div className="flex-1 w-full relative">
                            <label className="text-[10px] font-bold uppercase text-neutral-400 absolute -top-2 left-2 bg-white px-1">
                                Supabase User UID
                            </label>
                            <input
                                type="text"
                                placeholder="Pegar UUID aquí"
                                defaultValue={b.user_id || ''}
                                className="w-full h-10 rounded-lg bg-white border border-neutral-200 px-3 text-sm font-mono"
                                onBlur={(e) => {
                                    if (e.target.value !== (b.user_id || '')) {
                                        handleUpdateUserId(b.id, e.target.value);
                                    }
                                }}
                            />
                        </div>

                        <div className="w-full md:w-auto flex justify-end">
                            {savingId === b.id ? (
                                <span className="text-xs font-bold text-primary animate-pulse">Guardando...</span>
                            ) : b.user_id ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                                    <span className="material-symbols-outlined text-[14px]">link</span>
                                    Vinculado
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
                                    <span className="material-symbols-outlined text-[14px]">link_off</span>
                                    Sin Acceso
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
