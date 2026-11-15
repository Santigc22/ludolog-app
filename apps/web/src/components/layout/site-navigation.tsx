"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { GlobalRole } from "@ludoteca/contracts";

import { getCurrentSession, SESSION_CHANGED_EVENT } from "../../lib/api/auth";

type SessionState = "checking" | "authenticated" | "anonymous";

export function SiteNavigation() {
  const pathname = usePathname();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [roles, setRoles] = useState<GlobalRole[]>([]);

  useEffect(() => {
    let active = true;

    function refreshSession() {
      void getCurrentSession()
        .then((response) => {
          if (active) {
            setRoles(response.user.roles);
            setSessionState("authenticated");
          }
        })
        .catch(() => {
          if (active) {
            setRoles([]);
            setSessionState("anonymous");
          }
        });
    }

    refreshSession();
    window.addEventListener(SESSION_CHANGED_EVENT, refreshSession);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED_EVENT, refreshSession);
    };
  }, [pathname]);

  const canModerate =
    sessionState === "authenticated" &&
    roles.some((role) => role === "MODERATOR" || role === "ADMIN");

  return (
    <nav aria-label="Navegación principal">
      <Link href="/">Inicio</Link>
      <Link href="/catalogo">Catálogo</Link>
      <Link href="/ludotecas">Mis ludotecas</Link>
      {sessionState === "authenticated" ? (
        <>
          <Link href="/partidas">Partidas</Link>
          <Link href="/calendario">Calendario de juegos</Link>
        </>
      ) : null}
      {canModerate ? <Link href="/moderacion">Moderación</Link> : null}
      <Link href="/perfil">Mi perfil</Link>
      {sessionState === "anonymous" ? (
        <Link className="nav-access" href="/acceso">
          Acceder
        </Link>
      ) : null}
    </nav>
  );
}
