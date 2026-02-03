/**
 * Sistema de Logs para Notificaciones Push
 * Permite debugging en dispositivos iOS sin necesidad de Mac
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
    environment?: EnvironmentInfo;
}

export interface EnvironmentInfo {
    userAgent: string;
    isIOS: boolean;
    iOSVersion: string;
    isStandalone: boolean;
    hasServiceWorker: boolean;
    hasServiceWorkerAPI: boolean;
    hasServiceWorkerContainer: boolean;
    hasPushManager: boolean;
    hasNotification: boolean;
    notificationPermission: string;
    isSecureContext: boolean;
    protocol: string;
    screenSize: string;
    url: string;
}

class PushLogger {
    private static instance: PushLogger;
    private readonly MAX_LOGS = 500;
    private readonly STORAGE_KEY = 'push_notification_logs';

    private constructor() {
        this.log('Push Logger initialized', 'info');
    }

    static getInstance(): PushLogger {
        if (!PushLogger.instance) {
            PushLogger.instance = new PushLogger();
        }
        return PushLogger.instance;
    }

    /**
     * Obtener información del entorno
     */
    getEnvironmentInfo(): EnvironmentInfo {
        if (typeof window === 'undefined') {
            return {
                userAgent: 'server',
                isIOS: false,
                iOSVersion: 'unknown',
                isStandalone: false,
                hasServiceWorker: false,
                hasServiceWorkerAPI: false,
                hasServiceWorkerContainer: false,
                hasPushManager: false,
                hasNotification: false,
                notificationPermission: 'unsupported',
                isSecureContext: false,
                protocol: 'server',
                screenSize: 'unknown',
                url: 'server'
            };
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as { standalone?: boolean }).standalone === true;

        // Detectar versión de iOS
        let iOSVersion = 'unknown';
        if (isIOS) {
            const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            if (match) {
                iOSVersion = `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
            }
        }

        // Detección detallada de APIs
        const hasServiceWorkerAPI = 'serviceWorker' in navigator;
        const hasServiceWorkerContainer = navigator.serviceWorker !== undefined;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;

        let notificationPermission: string = 'unsupported';
        try {
            if (hasNotification) {
                notificationPermission = Notification.permission;
            }
        } catch {
            notificationPermission = 'error';
        }

        // Verificar HTTPS
        const isSecureContext = window.isSecureContext;
        const protocol = window.location.protocol;

        return {
            userAgent: navigator.userAgent,
            isIOS,
            iOSVersion,
            isStandalone,
            hasServiceWorker: hasServiceWorkerAPI && hasServiceWorkerContainer,
            hasServiceWorkerAPI,
            hasServiceWorkerContainer,
            hasPushManager,
            hasNotification,
            notificationPermission,
            isSecureContext,
            protocol,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            url: window.location.href
        };
    }

    /**
     * Registrar un log
     */
    log(message: string, level: LogLevel = 'info', data?: any): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data: data ? this.sanitizeData(data) : undefined,
            environment: level === 'error' ? this.getEnvironmentInfo() : undefined
        };

        // Guardar en localStorage
        this.saveLog(entry);

        // También hacer console.log en desarrollo
        const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        const emoji = this.getEmoji(level);
        console[consoleMethod](`${emoji} [PushLogger] ${message}`, data || '');
    }

    /**
     * Sanitizar datos para evitar referencias circulares
     */
    private sanitizeData(data: any): any {
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return String(data);
        }
    }

    /**
     * Obtener emoji según el nivel
     */
    private getEmoji(level: LogLevel): string {
        switch (level) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warn': return '⚠️';
            case 'debug': return '🔍';
            default: return 'ℹ️';
        }
    }

    /**
     * Guardar log en localStorage
     */
    private saveLog(entry: LogEntry): void {
        if (typeof window === 'undefined') return;

        try {
            const logs = this.getLogs();
            logs.push(entry);

            // Mantener solo los últimos MAX_LOGS
            const trimmedLogs = logs.slice(-this.MAX_LOGS);

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedLogs));
        } catch (error) {
            console.error('Error saving log to localStorage:', error);
        }
    }

    /**
     * Obtener todos los logs
     */
    getLogs(): LogEntry[] {
        if (typeof window === 'undefined') return [];

        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading logs from localStorage:', error);
            return [];
        }
    }

    /**
     * Limpiar logs
     */
    clearLogs(): void {
        if (typeof window === 'undefined') return;

        try {
            localStorage.removeItem(this.STORAGE_KEY);
            this.log('Logs cleared', 'info');
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }

    /**
     * Exportar logs como archivo JSON
     */
    exportLogs(): void {
        if (typeof window === 'undefined') return;

        try {
            const logs = this.getLogs();
            const environment = this.getEnvironmentInfo();

            const exportData = {
                exportedAt: new Date().toISOString(),
                environment,
                totalLogs: logs.length,
                logs
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `push-logs-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.log('Logs exported successfully', 'success');
        } catch (error) {
            this.log('Error exporting logs', 'error', error);
        }
    }

    /**
     * Obtener logs filtrados por nivel
     */
    getLogsByLevel(level: LogLevel): LogEntry[] {
        return this.getLogs().filter(log => log.level === level);
    }

    /**
     * Obtener estadísticas de logs
     */
    getStats(): { [key in LogLevel]: number } {
        const logs = this.getLogs();
        return {
            info: logs.filter(l => l.level === 'info').length,
            warn: logs.filter(l => l.level === 'warn').length,
            error: logs.filter(l => l.level === 'error').length,
            success: logs.filter(l => l.level === 'success').length,
            debug: logs.filter(l => l.level === 'debug').length
        };
    }
}

// Exportar instancia singleton
export const pushLogger = PushLogger.getInstance();

// Helpers para uso rápido
export const logPushInfo = (message: string, data?: any) =>
    pushLogger.log(message, 'info', data);

export const logPushSuccess = (message: string, data?: any) =>
    pushLogger.log(message, 'success', data);

export const logPushWarn = (message: string, data?: any) =>
    pushLogger.log(message, 'warn', data);

export const logPushError = (message: string, data?: any) =>
    pushLogger.log(message, 'error', data);

export const logPushDebug = (message: string, data?: any) =>
    pushLogger.log(message, 'debug', data);
