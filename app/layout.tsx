import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Telemetry OS", description: "Centro de comando de telemetria industrial" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
