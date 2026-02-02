/**
 * API Route para Envío Push Real
 * Usa web-push library para enviar notificaciones a FCM
 */

import { NextRequest, NextResponse } from 'next/server';
import * as webPush from 'web-push';

// VAPID keys - deben coincidir con las del frontend
const vapidKeys = {
    publicKey: 'BEDW4o4KdY7RnEhHZMzSOrxrFvCrbhfAg2By3ZjrMDwd-ArMA4KaSC1pEJMRhFUrA-GeUztAVzqX0I3D8FrHZUQ',
    privateKey: 'UuIrRsCVHio8RvYJ6aPznZ9yAayD2F97bO70LmreSQY'
};

// Configurar VAPID
webPush.setVapidDetails(
    'mailto:esteban@barberapp.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

export async function POST(request: NextRequest) {
    try {
        console.log('API: Recibida solicitud de envío push');
        
        const body = await request.json();
        const { pushToken, payload } = body;
        
        if (!pushToken || !payload) {
            return NextResponse.json(
                { error: 'Faltan pushToken o payload' },
                { status: 400 }
            );
        }
        
        // Parsear la suscripción
        let subscription;
        try {
            subscription = JSON.parse(pushToken);
            console.log('API: Suscripción parseada:', {
                endpoint: subscription.endpoint,
                hasKeys: !!subscription.keys
            });
        } catch (parseError) {
            console.error('API: Error parseando token:', parseError);
            return NextResponse.json(
                { error: 'Token inválido' },
                { status: 400 }
            );
        }
        
        // Enviar notificación usando web-push
        try {
            console.log('API: Enviando a web-push...');
            
            const result = await webPush.sendNotification(
                subscription,
                JSON.stringify(payload),
                {
                    TTL: 60, // Time to live en segundos
                    urgency: 'high'
                }
            );
            
            console.log('API: Notificación enviada exitosamente');
            console.log('API: Resultado web-push:', result);
            
            return NextResponse.json({
                success: true,
                message: 'Notificación enviada exitosamente',
                result: result
            });
            
        } catch (pushError) {
            console.error('API: Error en web-push:', pushError);
            
            // Si el suscriptor ya no es válido, podría ser un error 410 Gone
            if (pushError instanceof Error) {
                if (pushError.message.includes('410') || pushError.message.includes('Gone')) {
                    console.log('Suscripción expirada, limpiando token de la base de datos');
                    
                    // Intentar eliminar el token inválido de la base de datos
                    try {
                        // Esto requeriría pasar el barbero_id, por ahora solo logueamos
                        console.log('Token inválido detectado, debería eliminarse:', subscription.endpoint);
                    } catch (cleanupError) {
                        console.error('Error limpiando token:', cleanupError);
                    }
                    
                    return NextResponse.json({
                        success: false,
                        error: 'Suscripción expirada',
                        code: 'SUBSCRIPTION_EXPIRED',
                        details: pushError.message
                    }, { status: 410 });
                }
                
                // Error de rate limiting
                if (pushError.message.includes('429') || pushError.message.includes('rate')) {
                    console.log('Rate limit excedido');
                    return NextResponse.json({
                        success: false,
                        error: 'Demasiadas solicitudes',
                        code: 'RATE_LIMIT_EXCEEDED',
                        details: pushError.message
                    }, { status: 429 });
                }
                
                // Error de token inválido (400/404)
                if (pushError.message.includes('400') || pushError.message.includes('404') || 
                    pushError.message.includes('Invalid') || pushError.message.includes('Not Found')) {
                    console.log('Token inválido detectado:', subscription.endpoint);
                    return NextResponse.json({
                        success: false,
                        error: 'Token inválido',
                        code: 'INVALID_TOKEN',
                        details: pushError.message
                    }, { status: 400 });
                }
            }
            
            return NextResponse.json({
                success: false,
                error: 'Error enviando notificación',
                code: 'PUSH_ERROR',
                details: pushError instanceof Error ? pushError.message : 'Unknown error'
            }, { status: 500 });
        }
        
    } catch (error) {
        console.error('API: Error general:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
