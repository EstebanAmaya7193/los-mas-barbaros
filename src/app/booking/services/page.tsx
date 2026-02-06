"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
    const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
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
                .eq("activo", true)  // Solo servicios activos
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

    // Filtrado dinámico con useMemo
    const filteredServices = useMemo(() => {
        if (selectedCategory === "Todos") {
            return services;
        } else {
            return services.filter(service =>
                service.nombre.toLowerCase().includes(selectedCategory.toLowerCase())
            );
        }
    }, [selectedCategory, services]);

    // Categorías dinámicas basadas en los servicios
    const categories = useMemo(() => {
        const uniqueCategories = ["Todos"];
        const serviceCategories = services.map(service => {
            // Extraer categoría del nombre (ej: "Corte Clásico" -> "Corte")
            const words = service.nombre.split(' ');
            return words[0]; // Primera palabra como categoría
        });

        // Eliminar duplicados y ordenar
        const filtered = [...new Set(serviceCategories)].filter(cat =>
            cat && cat !== "Todos"
        ).sort();

        return [...uniqueCategories, ...filtered];
    }, [services]);

    const toggleService = (id: string) => {
        // Enforce single selection: if clicked, it replaces the previous one
        // If clicking the already selected one, we can either deselect or keep it.
        // Usually for single selection, clicking selected keeps it selected, or toggles off.
        // Let's implement toggle behavior for the single item.
        setSelectedServices((prev) =>
            prev.includes(id) ? [] : [id]
        );
    };

    const totalPrice = filteredServices
        .filter((s) => selectedServices.includes(s.id))
        .reduce((acc, curr) => acc + Number(curr.precio), 0);

    const totalDuration = filteredServices
        .filter((s) => selectedServices.includes(s.id))
        .reduce((acc, curr) => acc + Number(curr.duracion_minutos), 0);

    return (
        <div className="relative mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden bg-background-light liquid-bg">
            {/* Decorative abstract shape for glass effect refraction */}
            <div className="pointer-events-none absolute -right-20 top-20 h-64 w-64 rounded-full bg-gray-100 opacity-60 blur-3xl"></div>
            <div className="pointer-events-none absolute -left-20 top-80 h-96 w-96 rounded-full bg-gray-50 opacity-80 blur-3xl"></div>

            {/* Header */}
            <header className="z-20 flex items-center justify-between px-6 py-4 pt-12 backdrop-blur-sm bg-white/80 border-b border-gray-200/50">
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
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 transition-transform active:scale-95 ${selectedCategory === cat
                                ? "bg-black shadow-lg shadow-black/10"
                                : "liquid-card"
                                }`}
                        >
                            <p className={`text-xs font-medium ${selectedCategory === cat
                                ? "text-white font-semibold"
                                : "text-primary/70"
                                }`}>
                                {cat}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Service List */}
            <main className="no-scrollbar z-10 flex-1 overflow-y-visible px-6 py-4 pb-24">
                {loading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="liquid-card h-24 w-full animate-pulse rounded-2xl bg-white/50"></div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredServices.map((service) => (
                            (() => {
                                const isSelected = selectedServices.includes(service.id);

                                return (
                                    <label
                                        key={service.id}
                                        className={`group relative flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-all active:scale-[0.98] ${isSelected
                                            ? "bg-black text-white shadow-lg shadow-black/10"
                                            : "liquid-card"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleService(service.id)}
                                            className="sr-only"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <p className={`text-sm font-bold ${isSelected ? "text-white" : "text-primary"
                                                        }`}>
                                                        {service.nombre}
                                                    </p>
                                                    <p className={`text-xs ${isSelected ? "text-white/70" : "text-gray-500"
                                                        }`}>
                                                        {service.descripcion}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-primary"
                                                        }`}>
                                                        ${formatCOP(service.precio)}
                                                    </span>
                                                    <span className={`text-xs ${isSelected ? "text-white/70" : "text-gray-400"
                                                        }`}>
                                                        {service.duracion_minutos} min
                                                    </span>
                                                </div>
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
            <div className="fixed bottom-0 w-full z-30">
                {/* Content */}
                <div className="relative pb-4 pt-4 px-6">
                    <div className="relative flex items-center justify-between mb-6 px-1">
                        {/* Blur Background - cubre exactamente este elemento */}
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl -mx-2 -my-1"></div>

                        <div className="relative flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-500">
                                {selectedServices.length > 0 ? "1 servicio seleccionado" : "0 servicios seleccionados"}
                            </span>
                            {selectedServices.length > 0 && (
                                <span className="text-xs text-gray-400">
                                    {totalDuration} min
                                </span>
                            )}
                        </div>
                        <div className="relative text-right">
                            <span className="text-lg font-bold text-primary">
                                ${formatCOP(totalPrice)}
                            </span>
                        </div>
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
        </div>
    );
}
