import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar Arbitrage",
  description: "Painel privado para análise de oportunidades de arbitragem.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
