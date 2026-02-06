import { useEffect, useCallback } from 'react';

export function useAutoRefresh(
    callback: () => void,
    dependencies: any[] = [],
    enabled: boolean = true
) {
    const handleRefresh = useCallback(() => {
        if (enabled && document.visibilityState === 'visible') {
            console.log('📱 App resumed/focused - refreshing data...');
            callback();
        }
    }, [callback, enabled]);

    useEffect(() => {
        window.addEventListener('focus', handleRefresh);
        document.addEventListener('visibilitychange', handleRefresh);

        return () => {
            window.removeEventListener('focus', handleRefresh);
            document.removeEventListener('visibilitychange', handleRefresh);
        };
    }, [handleRefresh]);
}
