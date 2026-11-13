import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNavigation } from "../components/layout/site-navigation";
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
          <SiteNavigation />
        </header>
        {children}
      </body>
    </html>
  );
}
