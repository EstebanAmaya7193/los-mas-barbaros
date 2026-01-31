/**
 * Servicio de Backend para Envío Push Real
 * Llama al backend API para enviar notificaciones push
 */

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: unknown;
    requireInteraction?: boolean;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}

/**
 * Llama al backend para enviar notificación push
 * El backend usará web-push library para enviar a FCM
 */
export async function sendPushViaBackend(
    pushToken: string, 
    payload: PushPayload
): Promise<boolean> {
    try {
        console.log('📡 Enviando notificación via backend...');
        
        // Llamar a tu API route de Next.js
        const response = await fetch('/api/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pushToken,
                payload
            })
        });
        
        if (!response.ok) {
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Backend response:', result);
        return result.success;
        
    } catch (error) {
        console.error('❌ Error en backend push:', error);
        return false;
    }
}
