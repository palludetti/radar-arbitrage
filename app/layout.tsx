import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Radar Arbitrage — Decisão antes da compra",
    template: "%s | Radar Arbitrage",
  },
  description: "Análise assistida de margem, liquidez e risco para oportunidades de arbitragem.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
