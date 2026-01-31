// Service Worker para Notificaciones Push
const CACHE_NAME = 'barber-app-v1';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Solo cachear archivos esenciales que sabemos que existen
        return cache.addAll([
          '/'
        ]).catch(error => {
          console.log('⚠️ Error en caché inicial (continuando):', error);
          // No fallar la instalación si hay error de caché
        });
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Manejo de mensajes del cliente
self.addEventListener('message', (event) => {
  console.log('📨 Mensaje recibido del cliente:', event.data);
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload;
    
    const options = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      data: payload.data,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } else if (event.data.type === 'PUSH_EVENT') {
    // Simular un evento push real
    const payload = event.data.payload;
    console.log('📡 Simulando evento push:', payload);
    
    const options = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      data: payload.data,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } else if (event.data.type === 'SEND_PUSH_NOTIFICATION') {
    // Enviar notificación push real (DEBUG: mostrar localmente)
    const { subscription, payload } = event.data;
    console.log('📡 DEBUG: Recibido SEND_PUSH_NOTIFICATION');
    console.log('📦 DEBUG: Subscription:', subscription);
    console.log('📦 DEBUG: Payload:', payload);
    
    // DEBUG: Mostrar notificación local para saber que se recibió el mensaje
    const options = {
      body: payload.body + ' (DEBUG: Recibido en SW)',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      data: payload.data,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || []
    };

    event.waitUntil(
      self.registration.showNotification('🔔 ' + payload.title, options)
    );
  }
});

// Manejo de eventos push
self.addEventListener('push', (event) => {
  console.log('📱 Evento push recibido en Service Worker');
  console.log('📦 Evento data:', event.data);
  console.log('📦 Evento data text:', event.data ? event.data.text() : 'No data');

  let payload;
  try {
    payload = event.data ? event.data.json() : null;
    console.log('📦 Payload parseado:', payload);
  } catch (error) {
    console.error('❌ Error parseando payload:', error);
    payload = null;
  }
  
  if (!payload) {
    console.log('❌ No hay payload válido en el evento push');
    // Mostrar notificación genérica para debug
    event.waitUntil(
      self.registration.showNotification('🔔 Notificación de Prueba', {
        body: 'Evento push recibido pero sin payload',
        icon: '/icons/icon-192x192.png',
        tag: 'debug-push'
      })
    );
    return;
  }

  console.log('✅ Mostrando notificación:', payload.title);

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-72x72.png',
    data: payload.data,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Notificación', options)
  );
});

// Manejo de clic en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notificación clickeada');
  
  event.notification.close();
  
  // Abrir la URL especificada si existe
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Estrategia de caché para fetch (solo GET requests)
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET, no POST
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en caché, devolverlo
        if (response) {
          return response;
        }

        // Si no está en caché, hacer fetch
        return fetch(event.request).then((response) => {
          // Si es exitoso, guardar en caché
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});
