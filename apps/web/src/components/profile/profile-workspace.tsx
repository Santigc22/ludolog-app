"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

import type { OwnProfile } from "@ludoteca/contracts";

import { getCurrentSession, logout } from "../../lib/api/auth";
import { ApiRequestError } from "../../lib/api/client";
import { getOwnProfile, updateOwnProfile } from "../../lib/api/profile";

type ViewState = "loading" | "ready" | "unauthenticated" | "error";

function isSessionError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

export function ProfileWorkspace() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [session, profileResponse] = await Promise.all([
          getCurrentSession(),
          getOwnProfile(),
        ]);

        if (active) {
          setEmail(session.user.email);
          setProfile(profileResponse.profile);
          setViewState("ready");
        }
      } catch (error) {
        if (active) {
          setViewState(isSessionError(error) ? "unauthenticated" : "error");
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await updateOwnProfile({
        displayName: String(form.get("displayName") ?? "").trim() || null,
        bio: String(form.get("bio") ?? "").trim() || null,
        avatarUrl: String(form.get("avatarUrl") ?? "").trim() || null,
        locationText: String(form.get("locationText") ?? "").trim() || null,
        visibility: form.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE",
      });
      setProfile(response.profile);
      setMessage("Tu perfil quedó actualizado.");
    } catch (error) {
      if (isSessionError(error)) {
        setViewState("unauthenticated");
        setMessage("Tu sesión venció. Inicia sesión nuevamente.");
      } else {
        setMessage(
          "No pudimos guardar los cambios. Revisa los datos e inténtalo otra vez.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    setMessage(null);

    try {
      await logout();
      setProfile(null);
      setViewState("unauthenticated");
      setMessage("Cerraste sesión de forma segura.");
    } catch (error) {
      if (isSessionError(error)) {
        setViewState("unauthenticated");
      } else {
        setMessage("No pudimos cerrar la sesión. Inténtalo nuevamente.");
      }
    } finally {
      setPending(false);
    }
  }

  if (viewState === "loading") {
    return (
      <section className="profile-card" aria-busy="true">
        <div className="eyebrow">Perfil</div>
        <h1>Preparando tu mesa…</h1>
        <p className="lead">Estamos validando tu sesión.</p>
      </section>
    );
  }

  if (viewState === "unauthenticated") {
    return (
      <section className="profile-card centered-card">
        <div className="empty-icon" aria-hidden="true">
          ◇
        </div>
        <h1>Tu mesa está guardada</h1>
        <p className="lead">
          {message ?? "Inicia sesión para consultar y editar tu perfil."}
        </p>
        <Link className="primary-action link-action" href="/acceso">
          Ir al acceso
        </Link>
      </section>
    );
  }

  if (viewState === "error" || profile === null) {
    return (
      <section className="profile-card centered-card">
        <h1>No pudimos cargar tu perfil</h1>
        <p className="lead">
          Verifica que la API esté disponible y vuelve a intentarlo.
        </p>
        <button className="secondary-action" onClick={() => location.reload()}>
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <section className="profile-shell" aria-labelledby="profile-title">
      <aside className="identity-card">
        <div className="avatar-placeholder" aria-hidden="true">
          {(profile.displayName ?? profile.username).slice(0, 1).toUpperCase()}
        </div>
        <div className="eyebrow">Tu identidad</div>
        <h1 id="profile-title">{profile.displayName ?? profile.username}</h1>
        <p className="username">@{profile.username}</p>
        <dl className="identity-meta">
          <div>
            <dt>Correo</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Visibilidad</dt>
            <dd>{profile.visibility === "PUBLIC" ? "Pública" : "Privada"}</dd>
          </div>
        </dl>
        <button
          className="text-action"
          type="button"
          onClick={handleLogout}
          disabled={pending}
        >
          Cerrar sesión
        </button>
      </aside>

      <div className="profile-card editor-card">
        <div className="eyebrow">Configuración</div>
        <h2>Cuéntanos cómo juegas</h2>
        <p className="lead">
          Estos datos no cambian tu cuenta, correo ni permisos.
        </p>

        <form className="stack-form" onSubmit={handleSave}>
          <label>
            Nombre visible
            <input
              name="displayName"
              defaultValue={profile.displayName ?? ""}
              maxLength={120}
            />
          </label>
          <label>
            Biografía
            <textarea
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={2000}
              rows={5}
              placeholder="Juegos favoritos, estilo de juego o lo que quieras compartir."
            />
          </label>
          <div className="field-grid">
            <label>
              Ubicación
              <input
                name="locationText"
                defaultValue={profile.locationText ?? ""}
                maxLength={160}
                placeholder="Bogotá, Colombia"
              />
            </label>
            <label>
              Visibilidad
              <select name="visibility" defaultValue={profile.visibility}>
                <option value="PRIVATE">Privada</option>
                <option value="PUBLIC">Pública</option>
              </select>
            </label>
          </div>
          <label>
            URL del avatar
            <input
              name="avatarUrl"
              type="url"
              defaultValue={profile.avatarUrl ?? ""}
              maxLength={2048}
              placeholder="https://…"
            />
          </label>

          {message ? (
            <p
              className={`form-message ${message.includes("actualizado") ? "success-message" : "error-message"}`}
              role="status"
            >
              {message}
            </p>
          ) : null}

          <button className="primary-action" type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar perfil"}
          </button>
        </form>
      </div>
    </section>
  );
}
