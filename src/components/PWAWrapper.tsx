'use client';

import PWAInstaller from './PWAInstaller';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

export default function PWAWrapper() {
  return (
    <>
      <ServiceWorkerRegistration />
      <PWAInstaller />
    </>
  );
}
