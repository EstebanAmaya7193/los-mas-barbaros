/**
 * Trigger de Supabase para Notificaciones Push Automáticas
 * Se ejecuta cuando un cliente crea un nuevo booking
 */

import { supabase } from './supabase';
import { sendPushViaBackend } from './backendPushService';

interface BookingData {
    id: string;
    cliente_id: string;
    barbero_id: string;
    servicio_id: string;
    hora_inicio: string;
    estado: string;
    clientes?: {
        nombre: string;
    };
    servicios?: {
        nombre: string;
        duracion_minutos: number;
        precio: number;
    };
}

/**
 * Función que se ejecuta cuando se crea un nuevo booking
 * Esta función debería llamarse desde un trigger de Supabase
 */
export async function handleNewBooking(bookingId: string): Promise<void> {
    try {
        console.log('🔔 Trigger: Nuevo booking detectado:', bookingId);
        
        // 1. Obtener detalles completos del booking
        const { data: booking, error: bookingError } = await supabase
            .from('citas')
            .select(`
                *,
                clientes(nombre),
                servicios(nombre, duracion_minutos, precio)
            `)
            .eq('id', bookingId)
            .single();
            
        if (bookingError || !booking) {
            console.error('❌ Error obteniendo booking:', bookingError);
            return;
        }
        
        console.log('📋 Booking details:', booking);
        
        // 2. Obtener el token push del barbero
        const { data: pushTokens, error: tokenError } = await supabase
            .from('barberos_push_tokens')
            .select('push_token')
            .eq('barbero_id', booking.barbero_id)
            .eq('is_active', true);
            
        if (tokenError) {
            console.error('❌ Error obteniendo tokens push:', tokenError);
            return;
        }
        
        if (!pushTokens || pushTokens.length === 0) {
            console.log('⚠️ No hay tokens push activos para el barbero:', booking.barbero_id);
            return;
        }
        
        console.log('📱 Tokens push encontrados:', pushTokens.length);
        
        // 3. Preparar payload de notificación
        const clientName = booking.clientes?.nombre || 'Cliente';
        const serviceName = booking.servicios?.nombre || 'Servicio';
        const startTime = new Date(booking.hora_inicio).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const payload = {
            title: '🔔 Nueva Cita Agendada',
            body: `${clientName} agendó ${serviceName} a las ${startTime}`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: `booking-${booking.id}`,
            data: {
                type: 'new_booking',
                bookingId: booking.id,
                clientId: booking.cliente_id,
                barberId: booking.barbero_id
            },
            requireInteraction: true,
            actions: [
                {
                    action: 'view',
                    title: 'Ver Cita'
                },
                {
                    action: 'dismiss',
                    title: 'Ocultar'
                }
            ]
        };
        
        // 4. Enviar notificación a todos los tokens del barbero
        for (const tokenData of pushTokens) {
            try {
                const success = await sendPushViaBackend(
                    tokenData.push_token,
                    payload
                );
                
                if (success) {
                    console.log('✅ Notificación enviada exitosamente');
                } else {
                    console.error('❌ Error enviando notificación');
                }
            } catch (error) {
                console.error('❌ Error en envío individual:', error);
            }
        }
        
        console.log('🎉 Proceso de notificación completado');
        
    } catch (error) {
        console.error('❌ Error general en trigger de booking:', error);
    }
}

/**
 * Función para pruebas manuales
 */
export async function testNotification(barberId: string): Promise<void> {
    const testPayload = {
        title: '🧪 Notificación de Prueba',
        body: 'Esta es una notificación de prueba desde el trigger',
        icon: '/icons/icon-192x192.png',
        tag: 'test-notification',
        data: { type: 'test' }
    };
    
    const { data: pushTokens } = await supabase
        .from('barberos_push_tokens')
        .select('push_token')
        .eq('barbero_id', barberId)
        .eq('is_active', true);
    
    if (pushTokens && pushTokens.length > 0) {
        await sendPushViaBackend(
            pushTokens[0].push_token,
            testPayload
        );
    }
}
