"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirigir automáticamente a la página principal del admin
        router.replace('/admin/barber');
    }, [router]);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Redirigiendo al panel de administración...</p>
            </div>
        </div>
    );
}
