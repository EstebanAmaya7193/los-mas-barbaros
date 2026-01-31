/**
 * API Route para simular trigger cuando se crea un booking
 * Esto se llamaría desde el frontend después de crear una cita
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleNewBooking } from '@/lib/supabasePushTrigger';

export async function POST(request: NextRequest) {
    try {
        console.log('🔔 API: Simulando trigger de booking creado');
        
        const body = await request.json();
        const { bookingId } = body;
        
        if (!bookingId) {
            return NextResponse.json(
                { error: 'Falta bookingId' },
                { status: 400 }
            );
        }
        
        // Ejecutar el trigger de notificación push
        await handleNewBooking(bookingId);
        
        return NextResponse.json({
            success: true,
            message: 'Trigger de booking procesado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ API: Error en trigger de booking:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
