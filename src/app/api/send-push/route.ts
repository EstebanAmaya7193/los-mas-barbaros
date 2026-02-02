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
            console.log('API: Endpoint:', subscription.endpoint);
            
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
            console.error('API: Tipo de error:', typeof pushError);
            console.error('API: Mensaje de error:', pushError instanceof Error ? pushError.message : 'Unknown error');
            console.error('API: Stack trace:', pushError instanceof Error ? pushError.stack : 'No stack available');
            
            // Si el suscriptor ya no es válido, podría ser un error 410 Gone
            if (pushError instanceof Error) {
                const errorMessage = pushError.message;
                
                if (errorMessage.includes('410') || errorMessage.includes('Gone')) {
                    console.log('Suscripción expirada, limpiando token de la base de datos');
                    
                    // Intentar eliminar el token inválido de la base de datos
                    try {
                        console.log('Token inválido detectado, debería eliminarse:', subscription.endpoint);
                    } catch (cleanupError) {
                        console.error('Error limpiando token:', cleanupError);
                    }
                    
                    return NextResponse.json({
                        success: false,
                        error: 'Suscripción expirada',
                        code: 'SUBSCRIPTION_EXPIRED',
                        details: errorMessage
                    }, { status: 410 });
                }
                
                // Error de rate limiting
                if (errorMessage.includes('429') || errorMessage.includes('rate')) {
                    console.log('Rate limit excedido');
                    return NextResponse.json({
                        success: false,
                        error: 'Demasiadas solicitudes',
                        code: 'RATE_LIMIT_EXCEEDED',
                        details: errorMessage
                    }, { status: 429 });
                }
                
                // Error de token inválido (400/404)
                if (errorMessage.includes('400') || errorMessage.includes('404') || 
                    errorMessage.includes('Invalid') || errorMessage.includes('Not Found')) {
                    console.log('Token inválido detectado:', subscription.endpoint);
                    return NextResponse.json({
                        success: false,
                        error: 'Token inválido',
                        code: 'INVALID_TOKEN',
                        details: errorMessage
                    }, { status: 400 });
                }
                
                // Error de respuesta inesperada
                if (errorMessage.includes('Received unexpected response code')) {
                    console.log('Error de respuesta inesperada de FCM');
                    return NextResponse.json({
                        success: false,
                        error: 'Error en el servicio de notificaciones',
                        code: 'FCM_ERROR',
                        details: errorMessage
                    }, { status: 500 });
                }
            }
            
            // Error genérico
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
