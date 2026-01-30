"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Appointment {
    id: string;
    fecha: string;
    hora_inicio: string;
    estado: string;
    monto_total: number;
    servicios: {
        nombre: string;
    } | null;
    barberos: {
        nombre: string;
    } | null;
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ nombre: "", telefono: "" });

    async function getProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }
        setUser(user);

        // Fetch profile data from 'clientes'
        const { data: profileData } = await supabase
            .from("clientes")
            .select("*")
            .eq("id", user.id)
            .single();

        if (profileData) {
            setProfile(profileData);
            setEditForm({
                nombre: profileData.nombre || "",
                telefono: profileData.telefono || ""
            });
        } else {
            // Default if no record yet
            setEditForm({
                nombre: user.user_metadata?.full_name || "",
                telefono: user.user_metadata?.phone || ""
            });
        }

        // Fetch appointments
        const { data: appointmentsData } = await supabase
            .from("citas")
            .select(`
                id, fecha, hora_inicio, estado, monto_total,
                servicios (nombre),
                barberos (nombre)
            `)
            .eq("cliente_id", user.id)
            .order("fecha", { ascending: false })
            .order("hora_inicio", { ascending: false });

        if (appointmentsData) setAppointments(appointmentsData as any[]);
        setLoading(false);
    }

    useEffect(() => {
        getProfile();
    }, [router]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from("clientes")
                .upsert({
                    id: user.id,
                    nombre: editForm.nombre,
                    telefono: editForm.telefono,
                });

            if (error) throw error;
            setIsEditing(false);
            getProfile();
            alert("¡Perfil actualizado! ✨");
        } catch (error: any) {
            alert("Error al actualizar: " + error.message);
        }
    };


    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const nextAppointment = appointments.find(a => a.estado === "PROGRAMADA" || a.estado === "EN_ATENCION");
    const history = appointments.filter(a => a.estado === "COMPLETADA");

    return (
        <div className="bg-background-light dark:bg-background-dark text-primary dark:text-white font-display antialiased selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black pb-24 min-h-screen">
            <div className="relative flex w-full flex-col overflow-x-hidden">
                <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
                    <div className="glass-panel mx-4 mt-4 rounded-full px-4 py-3 flex items-center justify-between">
                        <Link href="/" className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                        </Link>
                        <h1 className="text-lg font-black tracking-tighter uppercase">Mi Perfil</h1>
                        <div className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-[24px]">settings</span>
                        </div>
                    </div>
                </header>

                <main className="flex-grow flex flex-col relative pt-24 px-6 gap-8">
                    {/* User Hero Section */}
                    <div className="flex flex-col items-center text-center gap-4 relative z-10">
                        <div className="relative">
                            <div className="size-24 rounded-3xl bg-black dark:bg-white flex items-center justify-center shadow-2xl relative z-10">
                                <span className="text-4xl font-black text-white dark:text-black uppercase">
                                    {(profile?.nombre || user?.email || "?")[0]}
                                </span>
                            </div>
                            <div className="absolute inset-0 bg-black/20 dark:bg-white/20 blur-xl rounded-full transform scale-90 translate-y-2 -z-10"></div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tight uppercase">{profile?.nombre || user?.email?.split('@')[0]}</h2>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">
                                    Miembro desde {new Date(user?.created_at).getFullYear()}
                                </span>
                                <div className="size-1 w-1 rounded-full bg-gray-300"></div>
                                <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest">
                                    Cliente Gold
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Next Appointment Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold uppercase tracking-tight">Próximas Citas</h3>
                            <Link className="text-xs font-semibold text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors" href="/booking/services">Nueva Cita</Link>
                        </div>

                        {nextAppointment ? (
                            <div className="glass-card-highlight backdrop-blur-md rounded-2xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-200/50 to-transparent dark:from-white/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                            {nextAppointment.fecha}
                                        </span>
                                        <span className="text-3xl font-black">{nextAppointment.hora_inicio.substring(0, 5)}</span>
                                        <div className="flex items-center gap-1.5 mt-2 text-sm font-medium">
                                            <span className="material-symbols-outlined text-[18px]">content_cut</span>
                                            <span>{nextAppointment.servicios?.nombre}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="size-10 rounded-full overflow-hidden bg-gray-200">
                                            <div className="w-full h-full flex items-center justify-center bg-primary text-white text-xs font-bold">
                                                {nextAppointment.barberos?.nombre?.substring(0, 1)}
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-right text-gray-400">Barbero:<br /><span className="text-primary dark:text-white">{nextAppointment.barberos?.nombre}</span></span>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex gap-3">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${nextAppointment.estado === 'EN_ATENCION' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                        {nextAppointment.estado === 'EN_ATENCION' ? 'En Atención' : 'Confirmada'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-panel p-8 rounded-2xl text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No tienes citas pendientes</p>
                                <Link href="/booking/services" className="inline-block mt-4 text-xs font-bold border-b border-black dark:border-white uppercase tracking-widest pb-1">Agendar Ahora</Link>
                            </div>
                        )}
                    </div>

                    {/* History Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold uppercase tracking-tight">Historial de Cortes</h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            {history.length > 0 ? (
                                history.map(apt => (
                                    <div key={apt.id} className="glass-panel p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gray-100 dark:bg-white/10 p-2.5 rounded-lg text-green-600">
                                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{apt.servicios?.nombre}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{apt.fecha} • {apt.hora_inicio.substring(0, 5)}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black">${apt.monto_total}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-xs text-gray-400 py-4">Aún no tienes historial de cortes</p>
                            )}
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-auto flex flex-col gap-3 pb-8">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full glass-panel hover:bg-black/5 dark:hover:bg-white/5 text-primary dark:text-white font-bold text-sm py-4 rounded-xl transition-all flex items-center justify-center gap-2 group border-black/10 dark:border-white/10"
                        >
                            <span className="material-symbols-outlined group-hover:scale-110 transition-transform">manage_accounts</span>
                            Editar Perfil
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full bg-transparent border border-red-500/20 text-red-600 dark:text-red-400 font-bold text-sm py-4 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            Cerrar Sesión
                        </button>
                    </div>
                </main>

                {/* Bottom Navbar */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                    <nav className="glass-panel px-6 py-3 rounded-full flex items-center gap-8 shadow-2xl bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/20">
                        <Link className="flex flex-col items-center gap-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors" href="/">
                            <span className="material-symbols-outlined text-[24px]">home</span>
                        </Link>
                        <Link className="flex flex-col items-center gap-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors" href="/booking/services">
                            <span className="material-symbols-outlined text-[24px]">calendar_month</span>
                        </Link>
                        <div className="w-px h-6 bg-gray-300 dark:bg-white/10"></div>
                        <button className="flex flex-col items-center gap-1 text-black dark:text-white">
                            <span className="material-symbols-outlined text-[24px] fill-current">person</span>
                            <span className="w-1 h-1 bg-black dark:bg-white rounded-full mt-1"></span>
                        </button>
                    </nav>
                </div>

                {/* Edit Profile Modal */}
                {isEditing && (
                    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8 transition-all">
                        <div className="glass-panel w-full max-w-sm rounded-[32px] p-8 shadow-2xl bg-white dark:bg-neutral-900 animate-in fade-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black uppercase tracking-tighter">Editar Perfil</h3>
                                <button onClick={() => setIsEditing(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.nombre}
                                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                                        className="w-full h-12 rounded-xl bg-neutral-50 dark:bg-white/5 border-none px-4 text-sm font-medium focus:ring-2 ring-primary transition-all"
                                        placeholder="P. ej. Juan Pérez"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={editForm.telefono}
                                        onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                                        className="w-full h-12 rounded-xl bg-neutral-50 dark:bg-white/5 border-none px-4 text-sm font-medium focus:ring-2 ring-primary transition-all"
                                        placeholder="+52 55 1234 5678"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full h-14 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold mt-2 shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">save</span>
                                    Guardar Cambios
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
