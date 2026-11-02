import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyAI — IA Libre Sin Censura",
  description:
    "Plataforma de IA libre con cerebro remoto (Llama-3-8B-Uncensored en Google Colab vía túnel) y memoria evolutiva: aprende de ti en cada conversación.",
  keywords: ["MyAI", "IA libre", "sin censura", "Llama-3", "memoria evolutiva", "chat"],
  authors: [{ name: "interfame" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "MyAI — IA Libre Sin Censura",
    description: "Tu IA libre con cerebro remoto y memoria evolutiva automática.",
    siteName: "MyAI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
