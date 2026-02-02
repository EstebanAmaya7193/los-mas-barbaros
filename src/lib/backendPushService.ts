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
        console.log('Enviando notificación via backend...');
        
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
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (jsonError) {
                console.error('No se pudo parsear el error JSON:', jsonError);
                errorData = { error: 'No se pudo parsear la respuesta del servidor' };
            }
            
            console.error(`Backend error: ${response.status} ${response.statusText}`, errorData);
            
            // Para errores 500, asumir que es un problema temporal y no marcar tokens
            if (response.status === 500) {
                console.log('Error 500 del backend - posible problema temporal con FCM');
                return false;
            }
            
            // Si es un token inválido o expirado, marcarlo para limpieza
            if (response.status === 400 || response.status === 410) {
                console.log('Token inválido detectado, debería limpiarse:', pushToken.substring(0, 50) + '...');
                await markTokenAsInvalid(pushToken);
            }
            
            return false;
        }
        
        const result = await response.json();
        console.log('Backend response:', result);
        return result.success;
        
    } catch (error) {
        console.error('Error en backend push:', error);
        return false;
    }
}

// Función para marcar tokens inválidos (implementación simple)
async function markTokenAsInvalid(_pushToken: string): Promise<void> {
    try {
        // Esta función podría implementarse para limpiar tokens inválidos
        // Por ahora solo logueamos para debugging
        console.log('Token marcado como inválido (pendiente implementación limpieza)');
    } catch (error) {
        console.error('Error marcando token como inválido:', error);
    }
}
