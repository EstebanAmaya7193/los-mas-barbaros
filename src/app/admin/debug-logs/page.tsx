'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { pushLogger, LogEntry, EnvironmentInfo } from '@/lib/pushLogger';
import { logPushInfo, logPushSuccess } from '@/lib/pushLogger';

export default function DebugLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [filter, setFilter] = useState<string>('all');
    const [autoRefresh, setAutoRefresh] = useState(true);

    const loadData = () => {
        setLogs(pushLogger.getLogs());
        setEnvironment(pushLogger.getEnvironmentInfo());
        setStats(pushLogger.getStats());
    };

    useEffect(() => {
        logPushInfo('Debug logs page opened');
        loadData();

        if (autoRefresh) {
            const interval = setInterval(loadData, 2000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    const handleClearLogs = () => {
        if (confirm('¿Estás seguro de que quieres borrar todos los logs?')) {
            pushLogger.clearLogs();
            loadData();
        }
    };

    const handleExportLogs = () => {
        pushLogger.exportLogs();
    };

    const handleTestNotification = async () => {
        logPushInfo('Testing notification from debug page');

        if ('serviceWorker' in navigator && 'Notification' in window) {
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.ready;

                registration.active?.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                        title: '🧪 Prueba de Notificación',
                        body: 'Esta es una notificación de prueba desde la página de debug',
                        icon: '/assets/logo.jpg',
                        tag: 'debug-test-notification'
                    }
                });

                logPushSuccess('Test notification sent successfully');
            } else {
                logPushInfo('Notification permission denied', { permission });
            }
        }
    };

    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(log => log.level === filter);

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
            case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
            case 'warn': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
            case 'debug': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
            default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
        }
    };

    const getLevelEmoji = (level: string) => {
        switch (level) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warn': return '⚠️';
            case 'debug': return '🔍';
            default: return 'ℹ️';
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-primary dark:text-white p-4">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <Link href="/admin/barber" className="size-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black">Debug Logs</h1>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Sistema de notificaciones push
                        </p>
                    </div>
                </div>

                {/* Environment Info */}
                {environment && (
                    <div className="glass-card-strong rounded-2xl p-4 mb-4">
                        <h2 className="font-bold mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500">info</span>
                            Información del Entorno
                        </h2>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-neutral-500">iOS:</span>
                                <span className={`ml-2 font-semibold ${environment.isIOS ? 'text-green-600' : 'text-neutral-600'}`}>
                                    {environment.isIOS ? 'Sí' : 'No'}
                                </span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Standalone:</span>
                                <span className={`ml-2 font-semibold ${environment.isStandalone ? 'text-green-600' : 'text-red-600'}`}>
                                    {environment.isStandalone ? 'Sí' : 'No'}
                                </span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Service Worker:</span>
                                <span className={`ml-2 font-semibold ${environment.hasServiceWorker ? 'text-green-600' : 'text-red-600'}`}>
                                    {environment.hasServiceWorker ? 'Soportado' : 'No soportado'}
                                </span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Push Manager:</span>
                                <span className={`ml-2 font-semibold ${environment.hasPushManager ? 'text-green-600' : 'text-red-600'}`}>
                                    {environment.hasPushManager ? 'Soportado' : 'No soportado'}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-neutral-500">Permiso:</span>
                                <span className={`ml-2 font-semibold ${environment.notificationPermission === 'granted' ? 'text-green-600' :
                                        environment.notificationPermission === 'denied' ? 'text-red-600' :
                                            'text-yellow-600'
                                    }`}>
                                    {environment.notificationPermission}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-neutral-500">Pantalla:</span>
                                <span className="ml-2 font-mono text-xs">{environment.screenSize}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {stats && (
                    <div className="glass-card-strong rounded-2xl p-4 mb-4">
                        <h2 className="font-bold mb-3">Estadísticas</h2>
                        <div className="flex gap-2 flex-wrap">
                            <div className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 text-xs font-semibold">
                                Info: {stats.info}
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 text-xs font-semibold">
                                Success: {stats.success}
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 text-xs font-semibold">
                                Warn: {stats.warn}
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 text-xs font-semibold">
                                Error: {stats.error}
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400 text-xs font-semibold">
                                Debug: {stats.debug}
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex gap-2 flex-wrap mb-4">
                    <button
                        onClick={handleExportLogs}
                        className="flex-1 min-w-[140px] h-10 bg-blue-500 text-white rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Exportar
                    </button>
                    <button
                        onClick={handleTestNotification}
                        className="flex-1 min-w-[140px] h-10 bg-green-500 text-white rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <span className="material-symbols-outlined text-sm">notifications</span>
                        Probar
                    </button>
                    <button
                        onClick={handleClearLogs}
                        className="flex-1 min-w-[140px] h-10 bg-red-500 text-white rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Limpiar
                    </button>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`h-10 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${autoRefresh
                                ? 'bg-neutral-800 text-white'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">
                            {autoRefresh ? 'pause' : 'play_arrow'}
                        </span>
                        Auto
                    </button>
                </div>

                {/* Filter */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {['all', 'info', 'success', 'warn', 'error', 'debug'].map((level) => (
                        <button
                            key={level}
                            onClick={() => setFilter(level)}
                            className={`px-4 py-2 rounded-xl font-semibold text-xs whitespace-nowrap transition-all ${filter === level
                                    ? 'bg-primary text-white scale-105'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:scale-105'
                                }`}
                        >
                            {level.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Logs List */}
            <div className="max-w-4xl mx-auto space-y-2">
                {filteredLogs.length === 0 ? (
                    <div className="glass-card-strong rounded-2xl p-8 text-center">
                        <span className="material-symbols-outlined text-5xl text-neutral-400 mb-2">inbox</span>
                        <p className="text-neutral-500">No hay logs disponibles</p>
                    </div>
                ) : (
                    filteredLogs.slice().reverse().map((log, index) => (
                        <div key={index} className="glass-card rounded-xl p-3">
                            <div className="flex items-start gap-3">
                                <span className="text-xl">{getLevelEmoji(log.level)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getLevelColor(log.level)}`}>
                                            {log.level.toUpperCase()}
                                        </span>
                                        <span className="text-xs text-neutral-500">
                                            {new Date(log.timestamp).toLocaleString('es-ES', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                                day: '2-digit',
                                                month: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium mb-1">{log.message}</p>
                                    {log.data && (
                                        <pre className="text-xs bg-neutral-100 dark:bg-neutral-900 p-2 rounded overflow-x-auto">
                                            {JSON.stringify(log.data, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
