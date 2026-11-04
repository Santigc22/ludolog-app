import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ludoteca Virtual",
  description: "Gestiona y comparte tu experiencia con los juegos de mesa.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link className="brand-mark" href="/">
            LUDOLOG
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/">Inicio</Link>
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/ludotecas">Mis ludotecas</Link>
            <Link href="/moderacion">Moderación</Link>
            <Link href="/perfil">Mi perfil</Link>
            <Link className="nav-access" href="/acceso">
              Acceder
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
