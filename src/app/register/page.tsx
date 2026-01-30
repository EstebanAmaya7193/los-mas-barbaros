"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // In Magic Link flow, signUp also works or we can just use signInWithOtp 
            // but we need to capture metadata for the 'clientes' table.

            // 1. Send Magic Link (OTP)
            const { error: authError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/profile`,
                    data: {
                        full_name: name,
                        phone: phone
                    }
                },
            });

            if (authError) throw authError;

            // Note: We'll normally use a Supabase Trigger to sync auth.users metadata 
            // to public.clientes. For now, we inform the user.

            setMessage({
                type: 'success',
                text: "¡Cuenta creada! ✨ Revisa tu correo para confirmar y entrar."
            });
        } catch (err: any) {
            console.error("Registration error:", err);
            setMessage({
                type: 'error',
                text: err.message || "Error al crear la cuenta"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-primary h-screen w-full overflow-hidden">
            {/* Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gray-200/40 dark:bg-white/5 rounded-full blur-[80px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-gray-300/30 dark:bg-white/5 rounded-full blur-[60px]"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full w-full max-w-md mx-auto overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between px-6 pt-8 pb-2">
                    <Link href="/" className="group flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90">
                        <span className="material-symbols-outlined text-[24px] leading-none font-light text-[#141414] dark:text-white transition-transform group-hover:-translate-x-0.5">chevron_left</span>
                    </Link>
                </div>

                <div className="flex-1 flex flex-col px-6 pb-10">
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="size-16 bg-primary dark:bg-white text-white dark:text-primary rounded-xl flex items-center justify-center mb-4 shadow-xl">
                            <span className="material-symbols-outlined text-[32px]">content_cut</span>
                        </div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-[#141414] dark:text-white">Los Más Bárbaros</h1>
                    </div>

                    <div className="glass-card rounded-2xl p-6 sm:p-8 animate-fade-in-up">
                        <h2 className="text-xl font-bold text-center text-[#141414] dark:text-white mb-6">Crear Cuenta</h2>

                        <form onSubmit={handleRegister} className="flex flex-col gap-5">
                            {message && (
                                <div className={`p-4 rounded-xl text-xs font-bold border animate-in fade-in zoom-in-95 ${message.type === 'success'
                                    ? "bg-green-50 text-green-600 border-green-100"
                                    : "bg-red-50 text-red-600 border-red-100"
                                    }`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="group">
                                <label className="block text-sm font-semibold text-[#141414] dark:text-gray-200 mb-1.5 pl-1">Nombre completo</label>
                                <input
                                    className="w-full h-12 px-4 bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-lg text-[#141414] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="Juan Pérez"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-sm font-semibold text-[#141414] dark:text-gray-200 mb-1.5 pl-1">Correo electrónico</label>
                                <input
                                    className="w-full h-12 px-4 bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-lg text-[#141414] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="juan@ejemplo.com"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-sm font-semibold text-[#141414] dark:text-gray-200 mb-1.5 pl-1">Teléfono</label>
                                <input
                                    className="w-full h-12 px-4 bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-lg text-[#141414] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="+52 55 1234 5678"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 mt-4 bg-primary dark:bg-white text-white dark:text-primary font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <span>{loading ? "Preparando..." : "Crear cuenta y entrar"}</span>
                                <span className="material-symbols-outlined">bolt</span>
                            </button>
                        </form>

                        {/* Ocultado temporalmente - Enlace a login
                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                ¿Ya tienes cuenta?
                                <Link className="text-primary dark:text-white font-bold hover:underline decoration-2 underline-offset-4 ml-1" href="/login">Iniciar sesión</Link>
                            </p>
                        </div>
                        */}
                    </div>
                </div>
            </div>
        </div>
    );
}
