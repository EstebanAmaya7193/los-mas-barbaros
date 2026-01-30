"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
    const router = useRouter();
    // Modo barber por defecto
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // Solo modo barber disponible
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            setMessage({
                type: 'success',
                text: "✅ ¡Acceso correcto! Redirigiendo..."
            });

            setTimeout(() => {
                router.push('/admin');
                router.refresh();
            }, 1000);
        } catch (err: unknown) {
            console.error("Login error:", err);
            const errorMessage = err instanceof Error ? err.message : "Error al iniciar sesión";
            setMessage({
                type: 'error',
                text: errorMessage
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-primary dark:text-white font-display antialiased selection:bg-black selection:text-white h-[100dvh] w-full flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuDt0VNJ6CtJi5Qv9DwQVktLkHHSJcf6K1irKxGNvl33hzrFpbWmbkytwxBvZRk0FpqCJ-qFbjZLtDd7VG2uwvQNLbUPlQh5hBuMueRth2uruqbC5AC40aLuZu6eTOP2a8qdW-1zuU3WVlWSIhyrCb19yoUjvbbhGRGbNhPI2p5-_bCryb3gY3xz42gtI2bnpv9C1MhPN1OTqM6FMCgBxl2FvCtGEPctn0ourl3q8gAmYIKdYlrRT3myaASMKlcrrqA7utEiNiWev_g')] bg-cover bg-center grayscale opacity-[0.03]"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/50 to-white dark:via-neutral-900/50 dark:to-neutral-900"></div>
            </div>

            <nav className="absolute top-8 left-6 z-20">
                <Link href="/" className="group flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90">
                    <span className="material-symbols-outlined text-[28px] font-light text-primary dark:text-white transition-transform group-hover:-translate-x-0.5">chevron_left</span>
                </Link>
            </nav>

            <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 w-full max-w-md mx-auto">
                <div className="flex flex-col items-center mb-6">
                    <div className="size-14 bg-black dark:bg-white rounded-2xl flex items-center justify-center shadow-xl rotate-3 mb-4 transition-transform hover:scale-110 active:scale-95 overflow-hidden">
                        <img 
                            src="/assets/logo.jpg" 
                            alt="Los Más Bárbaros Logo" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase text-center leading-none">
                        Los Más<br />Bárbaros
                    </h1>
                </div>

                {/* Role Switcher - Oculto temporalmente */}

                <div className="glass-panel w-full p-8 rounded-[32px] relative overflow-hidden group border border-white/20">
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold mb-6 text-center text-gray-800 dark:text-white">
                            Acceso Master Admin
                        </h2>

                        <form onSubmit={handleLogin} className="flex flex-col gap-5">
                            {message && (
                                <div className={`p-3 rounded-xl text-xs font-bold border animate-in fade-in zoom-in-95 ${message.type === 'success'
                                    ? "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/10 dark:text-green-400 dark:border-green-900/20"
                                    : "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/20"
                                    }`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1" htmlFor="email">Email</label>
                                <div className="relative">
                                    <input
                                        className="w-full h-12 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 px-4 text-sm font-medium focus:ring-2 ring-primary transition-all text-black dark:text-white"
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="ejemplo@correo.com"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                        <span className="material-symbols-outlined text-[20px]">mail</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1" htmlFor="password">Password</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-12 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 px-4 text-sm font-medium focus:ring-2 ring-primary transition-all text-black dark:text-white"
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                            <span className="material-symbols-outlined text-[20px]">lock</span>
                                        </div>
                                    </div>
                                </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold mt-2 shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <span>{loading ? "Procesando..." : "Entrar al Panel"}</span>
                                <span className="material-symbols-outlined text-[20px]">login</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* Ocultado temporalmente - Enlaces de registro */}

                <div className="absolute bottom-6 left-0 right-0 text-center opacity-30">
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Premium Grooming</p>
                </div>
            </main>
        </div>
    );
}
