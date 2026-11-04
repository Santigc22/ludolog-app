"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ApiRequestError } from "../../lib/api/client";
import { login, registerAccount } from "../../lib/api/auth";

type AccessMode = "login" | "register";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "AUTHENTICATION_FAILED") {
      return "El correo o la contraseña no son correctos.";
    }

    if (error.code === "IDENTITY_ALREADY_EXISTS") {
      return "Ese correo o nombre de usuario ya está registrado.";
    }

    if (error.code === "TOO_MANY_LOGIN_ATTEMPTS") {
      return "Hubo demasiados intentos. Espera unos minutos antes de volver a probar.";
    }
  }

  return "No pudimos completar la solicitud. Revisa los datos e inténtalo de nuevo.";
}

export function AccessPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      if (mode === "login") {
        await login({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
      } else {
        await registerAccount({
          email: String(form.get("email") ?? ""),
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
          displayName: String(form.get("displayName") ?? ""),
        });
      }

      router.push("/perfil");
      router.refresh();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="access-card" aria-labelledby="access-title">
      <div className="eyebrow">Identidad Ludolog</div>
      <h1 id="access-title">
        {mode === "login" ? "Vuelve a tu mesa" : "Crea tu espacio de juego"}
      </h1>
      <p className="lead">
        {mode === "login"
          ? "Continúa organizando tu colección y tus próximas partidas."
          : "Tu perfil es el punto de partida para colecciones, partidas y comunidad."}
      </p>

      <div className="mode-switch" role="group" aria-label="Tipo de acceso">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => {
            setMode("login");
            setMessage(null);
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => {
            setMode("register");
            setMessage(null);
          }}
        >
          Crear cuenta
        </button>
      </div>

      <form className="stack-form" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <>
            <label>
              Nombre visible
              <input
                name="displayName"
                autoComplete="name"
                maxLength={120}
                required
              />
            </label>
            <label>
              Nombre de usuario
              <input
                name="username"
                aria-label="Nombre de usuario"
                autoComplete="username"
                minLength={3}
                maxLength={80}
                pattern="[A-Za-z0-9_-]+"
                required
              />
              <span className="field-hint">
                Letras, números, guion o guion bajo.
              </span>
            </label>
          </>
        ) : null}

        <label>
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            aria-label="Contraseña"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "register" ? 15 : 1}
            maxLength={128}
            required
          />
          {mode === "register" ? (
            <span className="field-hint">
              Usa una frase de al menos 15 caracteres.
            </span>
          ) : null}
        </label>

        {message ? (
          <p className="form-message error-message" role="alert">
            {message}
          </p>
        ) : null}

        <button className="primary-action" type="submit" disabled={pending}>
          {pending
            ? "Un momento…"
            : mode === "login"
              ? "Entrar a mi ludoteca"
              : "Crear mi cuenta"}
        </button>
      </form>
    </section>
  );
}
