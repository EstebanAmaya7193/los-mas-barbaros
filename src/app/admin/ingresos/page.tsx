"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Transaction {
    id: string;
    fecha: string;
    hora_inicio: string;
    monto_total: number;
    estado: string;
    clientes: {
        nombre: string;
    }[];
    servicios: {
        nombre: string;
    }[];
}

interface ServiceStats {
    id: string;
    nombre: string;
    total_ingresos: number;
    cantidad_servicios: number;
}

export default function ControlIngresos() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString("en-CA"));
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [serviceStats, setServiceStats] = useState<ServiceStats[]>([]);
    const [dailyTotal, setDailyTotal] = useState(0);
    const [monthlyTotal, setMonthlyTotal] = useState(0);
    const [weeklyData, setWeeklyData] = useState<number[]>([]);
    const [monthlyTotals, setMonthlyTotals] = useState<number[]>([]);
    const [showCalendar, setShowCalendar] = useState(false);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/login");
                return;
            }

            try {
                // Fetch today's transactions
                const { data: todayData } = await supabase
                    .from("citas")
                    .select(`
                        id, fecha, hora_inicio, monto_total, estado,
                        clientes (nombre),
                        servicios (nombre)
                    `)
                    .eq("fecha", selectedDate)
                    .in("estado", ["COMPLETADA", "EN_ATENCION"])
                    .order("hora_inicio", { ascending: false });

                // Fetch monthly data - dinámico basado en la fecha seleccionada
                const selectedDateObj = new Date(selectedDate + "T00:00:00");
                const selectedMonth = selectedDateObj.toISOString().slice(0, 7);
                const startOfMonth = `${selectedMonth}-01`;
                const endOfMonth = `${selectedMonth}-31`;
                
                const { data: monthData } = await supabase
                    .from("citas")
                    .select("monto_total, fecha")
                    .gte("fecha", startOfMonth)
                    .lte("fecha", endOfMonth)
                    .in("estado", ["COMPLETADA", "EN_ATENCION"]);

                // Fetch weekly data - dinámico basado en la fecha seleccionada
                const weeklyTotals = [];
                const selectedDateForWeek = new Date(selectedDate + "T00:00:00");
                
                // Calcular el inicio de la semana (lunes) de la fecha seleccionada
                const dayOfWeek = selectedDateForWeek.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo (0), ir 6 días atrás; si no, ir al lunes
                const monday = new Date(selectedDateForWeek);
                monday.setDate(selectedDateForWeek.getDate() + mondayOffset);
                
                // Obtener datos de los 7 días de la semana (lunes a domingo)
                for (let i = 0; i < 7; i++) {
                    const weekDate = new Date(monday);
                    weekDate.setDate(monday.getDate() + i);
                    const dateStr = weekDate.toLocaleDateString("en-CA");
                    
                    const { data: dayData } = await supabase
                        .from("citas")
                        .select("monto_total")
                        .eq("fecha", dateStr)
                        .in("estado", ["COMPLETADA", "EN_ATENCION"]);
                    
                    const dayTotal = dayData?.reduce((sum, cita) => sum + Number(cita.monto_total), 0) || 0;
                    weeklyTotals.push(dayTotal);
                }

                // Fetch monthly weekly data (4 weeks of the month)
                const monthWeeklyTotals = [];
                const selectedDateForMonth = new Date(selectedDate + "T00:00:00");
                const currentMonth = selectedDateForMonth.toISOString().slice(0, 7);
                
                // Get 4 weeks of the selected month
                for (let week = 0; week < 4; week++) {
                    const weekStartDate = new Date(selectedDateForMonth);
                    weekStartDate.setDate(1 + (week * 7)); // Start of each week
                    
                    let weekTotal = 0;
                    
                    // Para la última semana, incluir todos los días restantes del mes
                    const lastDayOfMonth = new Date(selectedDateForMonth.getFullYear(), selectedDateForMonth.getMonth() + 1, 0);
                    const daysInMonth = lastDayOfMonth.getDate();
                    const daysInWeek = week === 3 ? daysInMonth - (week * 7) : 7; // Última semana puede tener más días
                    
                    for (let day = 0; day < daysInWeek; day++) {
                        const currentDay = new Date(weekStartDate);
                        currentDay.setDate(weekStartDate.getDate() + day);
                        
                        // Skip if we go to next month
                        if (currentDay.toISOString().slice(0, 7) !== currentMonth) {
                            break;
                        }
                        
                        const dateStr = currentDay.toLocaleDateString("en-CA");
                        const dayData = monthData?.filter(cita => cita.fecha === dateStr) || [];
                        const dayTotal = dayData?.reduce((sum: number, cita: any) => sum + Number(cita.monto_total), 0) || 0;
                        weekTotal += dayTotal;
                    }
                    
                    monthWeeklyTotals.push(weekTotal);
                }
                
                setMonthlyTotals(monthWeeklyTotals);

                // Fetch service statistics - dinámico basado en el mes seleccionado
                const { data: serviceData } = await supabase
                    .from("citas")
                    .select(`
                        servicio_id,
                        monto_total,
                        estado,
                        fecha
                    `)
                    .gte("fecha", startOfMonth)
                    .lte("fecha", endOfMonth);

                // Fetch services to get names
                const { data: servicesList } = await supabase
                    .from("servicios")
                    .select("id, nombre");

                // Process service statistics
                const serviceMap = new Map<string, ServiceStats>();
                serviceData?.forEach(item => {
                    const service = servicesList?.find(s => s.id === item.servicio_id);
                    if (service) {
                        const serviceName = service.nombre;
                        const existing = serviceMap.get(serviceName) || {
                            id: serviceName,
                            nombre: serviceName,
                            total_ingresos: 0,
                            cantidad_servicios: 0
                        };
                        
                        existing.total_ingresos += Number(item.monto_total);
                        existing.cantidad_servicios += 1;
                        serviceMap.set(serviceName, existing);
                    }
                });

                const sortedServices = Array.from(serviceMap.values())
                    .sort((a, b) => b.total_ingresos - a.total_ingresos)
                    .slice(0, 3);

                if (todayData) setTransactions(todayData);
                if (sortedServices) setServiceStats(sortedServices);
                setWeeklyData(weeklyTotals);
                setMonthlyTotals(monthWeeklyTotals);
                
                const dayTotal = todayData?.reduce((sum, t) => sum + Number(t.monto_total), 0) || 0;
                const monthTotal = monthData?.reduce((sum, t) => sum + Number(t.monto_total), 0) || 0;
                
                setDailyTotal(dayTotal);
                setMonthlyTotal(monthTotal);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [selectedDate, router]);

    const changeDate = (days: number) => {
        const date = new Date(selectedDate + "T00:00:00");
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toLocaleDateString("en-CA"));
    };

    const formatCOP = (value: number) => {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP',
            maximumFractionDigits: 0 
        }).format(value);
    };

    const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
    };

    const getWeekTotal = () => {
        return weeklyData.reduce((sum, val) => sum + val, 0);
    };

    const getChartData = () => {
        const max = Math.max(...weeklyData, 1);
        return weeklyData.map(value => (value / max) * 100);
    };

    const getMonthlyChartData = () => {
        const max = Math.max(...monthlyTotals, 1);
        const chartData = monthlyTotals.map(value => (value / max) * 100);
        return chartData;
    };

    // Calendar functions
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const generateCalendarDays = () => {
        const date = new Date(selectedDate);
        const daysInMonth = getDaysInMonth(date);
        const firstDay = getFirstDayOfMonth(date);
        const days = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    };

    const handleDateSelect = (day: number) => {
        const date = new Date(selectedDate);
        const newDate = new Date(date.getFullYear(), date.getMonth(), day);
        const dateString = newDate.toLocaleDateString("en-CA");
        setSelectedDate(dateString);
        setShowCalendar(false);
    };

    const handleMonthChange = (increment: number) => {
        const date = new Date(selectedDate);
        date.setMonth(date.getMonth() + increment);
        const dateString = date.toLocaleDateString("en-CA");
        setSelectedDate(dateString);
    };

    const today = new Date().toISOString().split('T')[0];
    const isToday = selectedDate === today;


    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-primary dark:text-white antialiased selection:bg-black selection:text-white min-h-screen">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-gray-200 to-transparent opacity-60 blur-3xl dark:from-gray-800"></div>
                <div className="absolute bottom-[10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-gray-300 to-transparent opacity-60 blur-3xl dark:from-gray-700"></div>
            </div>

            <div className="relative flex flex-col min-h-screen w-full max-w-md mx-auto pb-28">
                {/* Header */}
                <header className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between border-b border-transparent dark:border-white/5">
                    <Link href="/admin/barber" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90">
                        <span className="material-symbols-outlined text-[28px] font-light text-primary dark:text-white transition-transform group-hover:-translate-x-0.5">arrow_back</span>
                    </Link>
                    <h2 className="text-primary dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Control de Ingresos</h2>
                    <button 
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="flex cursor-pointer items-center justify-center rounded-full size-10 text-primary dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        <span className="material-symbols-outlined">calendar_today</span>
                    </button>
                </header>

                {/* Calendar Modal */}
                {showCalendar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                        <div className="glass-panel rounded-2xl p-6 w-full max-w-sm">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between mb-4">
                                <button 
                                    onClick={() => handleMonthChange(-1)}
                                    className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-primary dark:text-white">chevron_left</span>
                                </button>
                                <h3 className="text-primary dark:text-white text-lg font-bold">
                                    {new Date(selectedDate).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button 
                                    onClick={() => handleMonthChange(1)}
                                    className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-primary dark:text-white">chevron_right</span>
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                                    <div key={day} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {generateCalendarDays().map((day, index) => (
                                    <div key={index} className="aspect-square">
                                        {day ? (
                                            <button
                                                onClick={() => handleDateSelect(day)}
                                                className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                                                    day === new Date(selectedDate).getDate()
                                                        ? 'bg-primary dark:bg-white text-white dark:text-black'
                                                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-primary dark:text-white'
                                                }`}
                                            >
                                                {day}
                                            </button>
                                        ) : (
                                            <div className="w-full h-full"></div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Close Button */}
                            <button 
                                onClick={() => setShowCalendar(false)}
                                className="w-full mt-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-medium text-primary dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex flex-col flex-1 px-5 pt-6 pb-20 gap-8">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <>
                            {/* Hero KPI Section */}
                            <section className="flex flex-col gap-6">
                                {/* Total Day */}
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">Total Día</p>
                                        <span className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                                                {isToday && 'Hoy '}
                                                {` ${formatDateHeader(selectedDate)}`}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-primary dark:text-white text-6xl font-black tracking-tighter leading-none">{formatCOP(dailyTotal)}</p>
                                        
                                    </div>
                                </div>

                                {/* Total Month */}
                                <div className="glass-panel rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden group">
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-200/50 dark:bg-white/5 rounded-full blur-2xl group-hover:bg-gray-300/50 transition-all duration-500"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">Total Mes</p>
                                                <p className="text-primary dark:text-white text-4xl font-black tracking-tighter leading-none">{formatCOP(monthlyTotal)}</p>
                                            </div>
                                            <span className="text-green-600 dark:text-green-400 text-sm font-bold bg-white/50 dark:bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm shadow-sm">
                                                {new Date().toLocaleDateString('es-ES', { month: 'long' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Charts Section */}
                            <section className="flex flex-col gap-4">
                                <div className="flex justify-between items-end px-1">
                                    <h3 className="text-primary dark:text-white text-xl font-bold tracking-tight">Tendencia Semanal</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                        Esta Semana: <span className="text-primary dark:text-white font-bold">{formatCOP(getWeekTotal())}</span>
                                    </p>
                                </div>
                                <div className="glass-panel rounded-2xl p-5 pt-8">
                                    <div className="h-[180px] flex items-end justify-between gap-2 px-2">
                                        {getChartData().map((value, index) => (
                                            <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                                <div className="relative w-full flex flex-col items-center">
                                                    {/* Valor */}
                                                    {value > 0 && (
                                                        <span className="text-[10px] font-bold text-primary dark:text-white mb-1">
                                                            {formatCOP(weeklyData[index])}
                                                        </span>
                                                    )}
                                                    {/* Barra */}
                                                    <div 
                                                        className="w-full bg-primary dark:bg-white rounded-t transition-all duration-500"
                                                        style={{ 
                                                            height: `${value * 1.5}px`,
                                                            minHeight: value > 0 ? '4px' : '1px',
                                                            backgroundColor: value > 0 ? '' : 'transparent',
                                                            border: value > 0 ? 'none' : '1px solid #e5e5e5'
                                                        }}
                                                    ></div>
                                                    {/* Punto */}
                                                    {value > 0 && (
                                                        <div className="absolute -bottom-1 w-3 h-3 bg-white dark:bg-black border-2 border-primary dark:border-white rounded-full"></div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-4 px-2">
                                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => (
                                            <span key={day} className={`text-[11px] font-bold ${index === 6 ? 'text-primary dark:text-white' : 'text-gray-400'} uppercase`}>{day}</span>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Monthly Chart Section */}
                            <section className="flex flex-col gap-4">
                                <div className="flex justify-between items-end px-1">
                                    <h3 className="text-primary dark:text-white text-xl font-bold tracking-tight">Tendencia Mensual</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                        Este Mes: <span className="text-primary dark:text-white font-bold">{formatCOP(monthlyTotal)}</span>
                                    </p>
                                </div>
                                <div className="glass-panel rounded-2xl p-5 pt-8">
                                    <div className="h-[180px] flex items-end justify-between gap-2 px-2">
                                        {getMonthlyChartData().map((value: number, index: number) => (
                                            <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                                <div className="relative w-full flex flex-col items-center">
                                                    {/* Valor */}
                                                    {value > 0 && (
                                                        <span className="text-[10px] font-bold text-primary dark:text-white mb-1">
                                                            {formatCOP(monthlyTotals[index])}
                                                        </span>
                                                    )}
                                                    {/* Barra */}
                                                    <div 
                                                        className="w-full bg-primary dark:bg-white rounded-t transition-all duration-500"
                                                        style={{ 
                                                            height: `${value * 1.5}px`,
                                                            minHeight: value > 0 ? '4px' : '1px',
                                                            backgroundColor: value > 0 ? '' : 'transparent',
                                                            border: value > 0 ? 'none' : '1px solid #e5e5e5'
                                                        }}
                                                    ></div>
                                                    {/* Punto */}
                                                    {value > 0 && (
                                                        <div className="absolute -bottom-1 w-3 h-3 bg-white dark:bg-black border-2 border-primary dark:border-white rounded-full"></div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-4 px-2">
                                        {['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'].map((week, index) => (
                                            <span key={week} className={`text-[11px] font-bold ${index === 3 ? 'text-primary dark:text-white' : 'text-gray-400'} uppercase`}>{week}</span>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Top Services Section */}
                            <section className="flex flex-col gap-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-primary dark:text-white text-xl font-bold tracking-tight">Servicios Top</h3>
                                </div>
                                <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 scrollbar-hide snap-x">
                                    {serviceStats.map((service, index) => (
                                        <div key={service.id} className="snap-center shrink-0 min-w-[200px] glass-panel p-5 rounded-2xl flex flex-col justify-between h-[160px] relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <div className="relative z-10 flex justify-between items-start">
                                                <div className="size-10 rounded-full bg-primary/5 dark:bg-white/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-primary dark:text-white text-xl">content_cut</span>
                                                </div>
                                                <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                                            </div>
                                            <div className="relative z-10">
                                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{service.nombre}</p>
                                                <p className="text-primary dark:text-white text-2xl font-bold tracking-tight">{formatCOP(service.total_ingresos)}</p>
                                                <p className="text-gray-400 text-xs">{service.cantidad_servicios} servicios</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Recent Transactions */}
                            <section className="flex flex-col gap-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-primary dark:text-white text-xl font-bold tracking-tight">Actividad Reciente</h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => changeDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full glass-panel hover:bg-white dark:hover:bg-neutral-800 transition-all">
                                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                                        </button>
                                        <span className="text-xs text-gray-500 font-medium">{formatDateHeader(selectedDate)}</span>
                                        <button onClick={() => changeDate(1)} className="w-8 h-8 flex items-center justify-center rounded-full glass-panel hover:bg-white dark:hover:bg-neutral-800 transition-all">
                                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {transactions.length > 0 ? (
                                        transactions.map((transaction) => (
                                            <div key={transaction.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined text-gray-600 dark:text-gray-300 text-[20px]">person</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-primary dark:text-white font-semibold text-base">{transaction.clientes?.nombre || "Cliente"}</span>
                                                        <span className="text-gray-400 text-xs font-medium">{transaction.hora_inicio.substring(0, 5)} • {transaction.servicios?.nombre || "Servicio"}</span>
                                                    </div>
                                                </div>
                                                <span className="text-primary dark:text-white font-bold text-lg">+{formatCOP(transaction.monto_total)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
                                            <p className="text-sm">No hay transacciones para este día</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 w-full z-30 flex justify-center pb-2 pt-2 px-4 pointer-events-none">
                    <div className="glass-card-strong w-full max-w-md rounded-2xl flex justify-around items-center h-16 pointer-events-auto shadow-2xl">
                        <Link href="/admin/barber" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
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
                        <Link href="/admin/ingresos" className="flex flex-col items-center justify-center w-16 h-full gap-1 text-primary dark:text-white">
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
