import PWAWrapper from "@/components/PWAWrapper";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Los Más Bárbaros",
  description: "Experiencia premium de grooming",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LMB Barbería",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "LMB Barbería",
    title: "Los Más Bárbaros",
    description: "Experiencia premium de grooming",
  },
  twitter: {
    card: "summary",
    title: "Los Más Bárbaros",
    description: "Experiencia premium de grooming",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/android-launchericon-192-192.png" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LMB Barbería" />
      </head>
      <body suppressHydrationWarning className={`${inter.variable} font-display antialiased bg-background-light dark:bg-background-dark text-primary dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black`}>
        {children}
        <PWAWrapper />
      </body>
    </html>
  );
}
