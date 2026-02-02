/**
 * Utilidad para limpiar tokens push inválidos
 * Se debe ejecutar periódicamente para mantener la base de datos limpia
 */

import { supabase } from './supabase';

interface CleanupResult {
    removed: number;
    errors: string[];
}

/**
 * Limpia tokens push inválidos basándose en errores recibidos
 */
export async function cleanupInvalidTokens(barberId?: string): Promise<CleanupResult> {
    const result: CleanupResult = {
        removed: 0,
        errors: []
    };

    try {
        let query = supabase
            .from('barberos_push_tokens')
            .select('*');

        if (barberId) {
            query = query.eq('barbero_id', barberId);
        }

        const { data: tokens, error: fetchError } = await query;

        if (fetchError) {
            result.errors.push(`Error obteniendo tokens: ${fetchError.message}`);
            return result;
        }

        if (!tokens || tokens.length === 0) {
            console.log('📱 No hay tokens para limpiar');
            return result;
        }

        console.log(`📱 Verificando ${tokens.length} tokens push...`);

        // Verificar cada token
        for (const token of tokens) {
            try {
                const subscription = JSON.parse(token.push_token);
                
                // Verificar si el endpoint es válido
                if (!subscription.endpoint || !subscription.endpoint.startsWith('https://')) {
                    console.log('🗑️ Token con endpoint inválido:', token.id);
                    await deleteToken(token.id);
                    result.removed++;
                    continue;
                }

                // Verificar si tiene las keys necesarias (están dentro del JSON del push_token)
                if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
                    console.log('🗑️ Token sin keys criptográficas:', token.id);
                    await deleteToken(token.id);
                    result.removed++;
                    continue;
                }

            } catch (_error) {
                console.log('🗑️ Token con JSON inválido:', token.id);
                await deleteToken(token.id);
                result.removed++;
            }
        }

        console.log(`✅ Limpieza completada: ${result.removed} tokens eliminados`);
        return result;

    } catch (error) {
        result.errors.push(`Error general: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
    }
}

/**
 * Elimina un token específico
 */
async function deleteToken(tokenId: string): Promise<void> {
    const { error } = await supabase
        .from('barberos_push_tokens')
        .delete()
        .eq('id', tokenId);

    if (error) {
        console.error('❌ Error eliminando token:', error);
        throw error;
    }
}

/**
 * Marca un token como inactivo en lugar de eliminarlo
 */
export async function markTokenInactive(tokenId: string): Promise<void> {
    const { error } = await supabase
        .from('barberos_push_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

    if (error) {
        console.error('❌ Error marcando token como inactivo:', error);
        throw error;
    }
}

/**
 * Reactiva un token previamente marcado como inactivo
 */
export async function reactivateToken(tokenId: string): Promise<void> {
    const { error } = await supabase
        .from('barberos_push_tokens')
        .update({ is_active: true })
        .eq('id', tokenId);

    if (error) {
        console.error('❌ Error reactivando token:', error);
        throw error;
    }
}

/**
 * Obtiene estadísticas de tokens push
 */
export async function getTokenStats(barberId?: string) {
    let query = supabase
        .from('barberos_push_tokens')
        .select('barbero_id, is_active, created_at');

    if (barberId) {
        query = query.eq('barbero_id', barberId);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    const stats = {
        total: data?.length || 0,
        active: data?.filter(t => t.is_active).length || 0,
        inactive: data?.filter(t => !t.is_active).length || 0,
        byBarber: {} as Record<string, { total: number; active: number }>
    };

    // Agrupar por barbero
    data?.forEach(token => {
        const barberId = token.barbero_id;
        if (!stats.byBarber[barberId]) {
            stats.byBarber[barberId] = { total: 0, active: 0 };
        }
        stats.byBarber[barberId].total++;
        if (token.is_active) {
            stats.byBarber[barberId].active++;
        }
    });

    return stats;
}
