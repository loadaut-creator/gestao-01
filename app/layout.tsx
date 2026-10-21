import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visão 308 | Gestão comercial",
  description: "Painel de gestão comercial para farmácia.",
  icons: {
    icon: "/icon-diana.jpg",
    shortcut: "/icon-diana.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
