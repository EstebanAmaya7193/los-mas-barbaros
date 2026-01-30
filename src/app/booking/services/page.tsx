"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Service {
    id: string;
    nombre: string;
    precio: number;
    descripcion: string;
    duracion_minutos: number;
    icono: string;
}

export default function ServiceSelection() {
    const [services, setServices] = useState<Service[]>([]);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const formatCOP = (value: number) => {
        const n = Math.round(Number(value) || 0);
        return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    };

    useEffect(() => {
        async function fetchServices() {
            const { data, error } = await supabase
                .from("servicios")
                .select("*")
                .order("nombre");

            if (error) {
                console.error("Error fetching services:", error);
            } else {
                setServices(data || []);
            }
            setLoading(false);
        }
        fetchServices();
    }, []);

    const toggleService = (id: string) => {
        setSelectedServices((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const totalPrice = services
        .filter((s) => selectedServices.includes(s.id))
        .reduce((acc, curr) => acc + Number(curr.precio), 0);

    return (
        <div className="relative mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden bg-background-light liquid-bg">
            {/* Decorative abstract shape for glass effect refraction */}
            <div className="pointer-events-none absolute -right-20 top-20 h-64 w-64 rounded-full bg-gray-100 opacity-60 blur-3xl"></div>
            <div className="pointer-events-none absolute -left-20 top-80 h-96 w-96 rounded-full bg-gray-50 opacity-80 blur-3xl"></div>

            {/* Header */}
            <header className="z-20 flex items-center justify-between px-6 py-4 pt-12 backdrop-blur-sm">
                <Link
                    href="/"
                    className="group flex size-10 items-center justify-center rounded-full border border-transparent bg-transparent transition-colors hover:bg-black/5 active:scale-95"
                >
                    <span className="material-symbols-outlined text-[28px] font-light text-primary">
                        chevron_left
                    </span>
                </Link>
                <h1 className="text-lg font-bold tracking-tight text-primary">
                    Seleccionar Servicio
                </h1>
                <div className="size-10"></div> {/* Spacer for centering */}
            </header>

            {/* Category Filters */}
            <div className="z-20 w-full shrink-0 px-6 pb-2">
                <div className="no-scrollbar flex gap-3 overflow-x-auto py-2">
                    {/* Active Chip */}
                    <button className="flex h-9 shrink-0 items-center justify-center rounded-full bg-black px-5 shadow-lg shadow-black/10 transition-transform active:scale-95">
                        <p className="text-xs font-semibold text-white">Todos</p>
                    </button>
                    {/* Inactive Chips */}
                    {["Corte", "Barba", "Combos", "Facial"].map((cat) => (
                        <button
                            key={cat}
                            className="liquid-card flex h-9 shrink-0 items-center justify-center rounded-full px-5 transition-transform active:scale-95"
                        >
                            <p className="text-xs font-medium text-primary/70">{cat}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Service List */}
            <main className="no-scrollbar z-10 flex-1 overflow-y-auto px-6 py-4 pb-32">
                {loading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="liquid-card h-24 w-full animate-pulse rounded-2xl bg-white/50"></div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {services.map((service) => (
                            (() => {
                                const isSelected = selectedServices.includes(service.id);

                                return (
                            <label key={service.id} className="group relative cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={isSelected}
                                    onChange={() => toggleService(service.id)}
                                />
                                <div className={`liquid-card relative flex items-center gap-4 rounded-2xl p-4 transition-all duration-300 ring-1 ring-black/5 ${isSelected ? 'bg-white ring-2 ring-black/30 shadow-lg shadow-black/10' : ''}`}>
                                    {/* Icon Container */}
                                    <div className={`flex size-14 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 transition-all duration-300 ${isSelected ? 'bg-black ring-black/20' : 'bg-white'}`}>
                                        <span className={`material-symbols-outlined text-[28px] font-light ${isSelected ? 'text-white' : 'text-black'}`}>
                                            {service.icono || "content_cut"}
                                        </span>
                                    </div>
                                    {/* Content */}
                                    <div className="flex flex-1 flex-col justify-center gap-0.5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-bold text-primary">
                                                {service.nombre}
                                            </h3>
                                            <span className="text-base font-bold text-primary">
                                                ${formatCOP(service.precio)}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-500">
                                            {service.descripcion}
                                        </p>
                                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                                            <span className="material-symbols-outlined text-[14px]">
                                                schedule
                                            </span>
                                            <span>{service.duracion_minutos} min</span>
                                        </div>
                                    </div>
                                    {/* Check Indicator */}
                                    <div className={`absolute right-4 bottom-4 flex size-5 items-center justify-center rounded-full border transition-colors ${isSelected ? 'border-black bg-black' : 'border-gray-300 bg-transparent'}`}>
                                        <span className={`material-symbols-outlined text-[14px] text-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                                            check
                                        </span>
                                    </div>
                                </div>
                            </label>
                                );
                            })()
                        ))}
                    </div>
                )}
            </main>

            {/* Sticky Bottom Action */}
            <div className="absolute bottom-0 z-30 w-full bg-gradient-to-t from-white via-white/90 to-transparent pb-8 pt-12 px-6">
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-sm font-medium text-gray-500">
                        {selectedServices.length} servicio
                        {selectedServices.length !== 1 ? "s" : ""} seleccionado
                        {selectedServices.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-lg font-bold text-primary">
                        ${formatCOP(totalPrice)}
                    </span>
                </div>
                <Link
                    href={`/booking/details?services=${selectedServices.join(",")}`}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl bg-black py-4 text-white shadow-lg shadow-black/20 transition-transform active:scale-[0.98] ${selectedServices.length === 0 ? "opacity-50 pointer-events-none" : ""
                        }`}
                >
                    <span className="text-base font-semibold">Continuar</span>
                    <span className="material-symbols-outlined text-[20px]">
                        arrow_forward
                    </span>
                </Link>
            </div>
        </div>
    );
}
