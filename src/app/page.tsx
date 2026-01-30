"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const heroImages = [
    "/assets/trabajos/muestra1.jpg",
    "/assets/trabajos/muestra2.jpg", 
    "/assets/trabajos/muestra3.jpg",
    "/assets/trabajos/muestra4.jpg"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroImages.length]);
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        <div className="glass-panel mx-4 mt-4 rounded-full px-4 py-3 flex items-center justify-between">
          <div className="size-8 rounded-lg overflow-hidden">
            <img 
              src="/assets/logo.jpg" 
              alt="Los Más Bárbaros Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-lg font-black tracking-tighter uppercase text-center flex-1">Los Más Bárbaros</span>
          <Link
            className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            href="/login"
            title="Acceso Administrador"
          >
            <span className="material-symbols-outlined text-[24px]">person</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col relative">
        {/* Hero Section with Background Image */}
        <div className="relative h-[60vh] md:h-[75vh] w-full">
          {/* Hero Image: Dynamic Carousel */}
          <div
            className="absolute inset-0 bg-cover bg-center grayscale transition-all duration-1000 ease-in-out"
            style={{
              backgroundImage: `url("${heroImages[currentImageIndex]}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center'
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          
          {/* Image Indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? 'bg-white w-8' 
                    : 'bg-white/50 hover:bg-white/70'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
          {/* Dark Gradient Overlay for readability at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background-light dark:to-background-dark"></div>

          {/* Floating Glass Elements */}
          {/* Badge: Established Date */}
          <div className="absolute top-24 right-6">
            <div className="glass-panel px-4 py-2 rounded-lg transform rotate-[-3deg]">
              <p className="text-xs font-bold tracking-widest uppercase">
                Est. 2024
              </p>
            </div>
          </div>

          {/* Location Card */}
          <div className="absolute bottom-20 left-6 right-6 z-10">
            <a 
              href="https://www.bing.com/maps/default.aspx?v=2&pc=FACEBK&mid=8100&where1=Cra%2014%20%23%2062-41%20av%20ambal%C3%A1%2C%20Ibagu%C3%A9%2C%20Colombia%2C%20681012&FORM=FBKPL1&mkt=es-MX" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <div className="glass-panel p-4 rounded-2xl flex items-start gap-4 hover:bg-white/10 dark:hover:bg-white/5 transition-all cursor-pointer group">
                <div className="size-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/30 transition-colors">
                  <span className="material-symbols-outlined text-[24px] leading-none">location_on</span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold leading-tight">Ibagué, Colombia</p>
                  <p className="text-xs opacity-80 font-medium">Cra 14 # 62-41 av ambalá</p>
                  <div className="flex items-center gap-1 mt-1 opacity-90">
                    <span className="material-symbols-outlined text-[18px] leading-none">call</span>
                    <p className="text-[11px] font-bold">+57 316 7738300</p>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Content & CTA Section */}
        <div className="relative z-20 -mt-8 px-8 md:px-6 pb-12 flex flex-col gap-12">
            {/* Headline Area */}
            <div className="text-center space-y-4 pt-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.95] text-primary dark:text-white">
                TU MEJOR VERSIÓN
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-black dark:from-gray-300 dark:to-white">
                  COMIENZA AQUÍ.
                </span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 font-medium text-sm max-w-[280px] mx-auto">
                Barbería premium con el estilo más radical de Ibagué.
              </p>
            </div>

            {/* Social Media Links */}
            <div className="flex justify-center items-center gap-6">
              <a className="text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center" href="https://www.facebook.com/p/Los-M%C3%A1s-b%C3%A1rbaros-ibague-100064031113757/" target="_blank" rel="noopener noreferrer">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            <a className="text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center" href="https://www.instagram.com/los_mas_barbaros_/" target="_blank" rel="noopener noreferrer">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.947.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a className="text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center" href="https://wa.me/573167738300" target="_blank" rel="noopener noreferrer">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.417-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.305 1.652zm6.599-3.835c1.516.898 3.193 1.371 4.905 1.372h.005c5.385 0 9.768-4.383 9.771-9.77.001-2.611-1.015-5.065-2.862-6.915l-.013-.013c-1.847-1.847-4.31-2.864-6.914-2.865-5.387 0-9.77 4.383-9.772 9.77-.001 2.03.629 4.004 1.815 5.666l-.307 1.121-.73 2.661 2.731-.716 1.371-.355zm11.133-7.547c-.314-.157-1.86-.918-2.148-1.023-.289-.104-.499-.157-.709.157-.21.314-.813 1.023-.996 1.232-.183.209-.367.235-.68.078-.314-.156-1.325-.489-2.523-1.558-.932-.831-1.562-1.857-1.744-2.171-.183-.314-.02-.484.137-.641.141-.14.314-.366.471-.549.157-.183.21-.314.314-.523.104-.209.052-.392-.026-.549-.079-.157-.709-1.71-.971-2.338-.255-.612-.513-.529-.709-.538-.182-.008-.393-.01-.603-.01s-.551.078-.839.392c-.289.314-1.101 1.073-1.101 2.615s1.127 3.033 1.284 3.242c.157.209 2.219 3.388 5.374 4.747.751.323 1.336.516 1.792.661.753.239 1.439.206 1.981.125.604-.09 1.86-.758 2.122-1.491.262-.731.262-1.36.183-1.491-.079-.131-.289-.209-.603-.366z"/>
                </svg>
              </a>
            </div>

          {/* Main Actions */}
          <div className="flex flex-col gap-4">
            <Link
              href="/booking/services"
              className="w-full bg-primary hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white font-bold text-lg h-14 rounded-xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
            >
              <span>Agendar Cita</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </Link>
            {/* <p className="text-center">
              <Link
                className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-white underline underline-offset-4 transition-colors"
                href="/login"
              >
                ¿Ya tienes cuenta? Iniciar sesión
              </Link>
            </p> */}
          </div>
        </div>
      </main>
    </div>
  );
}
