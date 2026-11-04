"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

import type { CollectionDetail } from "@ludoteca/contracts";

import { ApiRequestError } from "../../lib/api/client";
import {
  archiveCollection,
  getCollection,
  updateCollection,
} from "../../lib/api/collections";
import { CopyInventoryWorkspace } from "../copies/copy-inventory-workspace";

type ViewState = "loading" | "ready" | "not-found" | "error";
type FieldErrors = Readonly<Record<string, string>>;

function validationFields(error: unknown): FieldErrors {
  if (!(error instanceof ApiRequestError) || error.code !== "VALIDATION_ERROR")
    return {};
  const fields = error.details?.fields;
  if (typeof fields !== "object" || fields === null) return {};

  return Object.fromEntries(
    Object.entries(fields).flatMap(([field, messages]) =>
      Array.isArray(messages) && typeof messages[0] === "string"
        ? [[field, messages[0]]]
        : [],
    ),
  );
}

export function CollectionDetailWorkspace({
  collectionId,
}: {
  collectionId: string;
}) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await getCollection(collectionId);
        if (active) {
          setCollection(response.collection);
          setViewState("ready");
        }
      } catch (error) {
        if (active) {
          setViewState(
            error instanceof ApiRequestError && error.status === 404
              ? "not-found"
              : "error",
          );
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [collectionId]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);

    try {
      const response = await updateCollection(collectionId, {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? "").trim() || null,
        visibility: form.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE",
      });
      setCollection(response.collection);
      setMessage("Los cambios quedaron guardados.");
    } catch (error) {
      setFieldErrors(validationFields(error));
      setMessage(
        error instanceof ApiRequestError && error.code === "COLLECTION_ARCHIVED"
          ? "Esta ludoteca ya está archivada y no admite cambios."
          : "No pudimos guardar los cambios. Revisa los campos.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleArchive() {
    if (
      !window.confirm("¿Archivar esta ludoteca? Conservarás todo su historial.")
    )
      return;
    setPending(true);
    setMessage(null);

    try {
      const response = await archiveCollection(collectionId);
      setCollection(response.collection);
      setMessage("La ludoteca quedó archivada sin eliminar su historial.");
    } catch {
      setMessage("No pudimos archivar la ludoteca. Inténtalo nuevamente.");
    } finally {
      setPending(false);
    }
  }

  if (viewState === "loading") {
    return (
      <section className="collection-state" aria-busy="true">
        Abriendo la ludoteca…
      </section>
    );
  }

  if (viewState === "not-found") {
    return (
      <section className="collection-state centered-card">
        <div className="empty-icon" aria-hidden="true">
          ◇
        </div>
        <h1>No encontramos esta ludoteca</h1>
        <p className="lead">
          Puede que sea privada, esté archivada o ya no exista.
        </p>
        <Link className="primary-action link-action" href="/ludotecas">
          Volver a mis ludotecas
        </Link>
      </section>
    );
  }

  if (viewState === "error" || collection === null) {
    return (
      <section className="collection-state centered-card">
        <h1>No pudimos abrir la ludoteca</h1>
        <p className="lead">Verifica tu sesión y la conexión con la API.</p>
        <Link className="secondary-action link-action" href="/ludotecas">
          Volver al listado
        </Link>
      </section>
    );
  }

  const canArchive =
    collection.effectiveRole === "OWNER" && collection.status === "ACTIVE";

  return (
    <section className="collection-detail" aria-labelledby="collection-title">
      <Link className="back-link" href="/ludotecas">
        ← Mis ludotecas
      </Link>
      <div className="collection-detail-grid">
        <aside className="collection-summary">
          <div className="eyebrow">Ludoteca personal</div>
          <h1 id="collection-title">{collection.name}</h1>
          <p>{collection.description ?? "Sin descripción todavía."}</p>
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>{collection.status === "ACTIVE" ? "Activa" : "Archivada"}</dd>
            </div>
            <div>
              <dt>Visibilidad</dt>
              <dd>
                {collection.visibility === "PUBLIC" ? "Pública" : "Privada"}
              </dd>
            </div>
            <div>
              <dt>Juegos registrados</dt>
              <dd>
                {collection.gameCount}{" "}
                {collection.gameCount === 1 ? "juego" : "juegos"}
              </dd>
            </div>
            <div>
              <dt>Tu rol</dt>
              <dd>{collection.effectiveRole ?? "Visitante"}</dd>
            </div>
          </dl>
        </aside>

        <div className="collection-editor">
          {collection.canEdit ? (
            <form className="stack-form" onSubmit={handleUpdate}>
              <div className="eyebrow">Configuración</div>
              <h2>Edita tu ludoteca</h2>
              <label>
                Nombre
                <input
                  name="name"
                  defaultValue={collection.name}
                  maxLength={140}
                  required
                  aria-invalid={fieldErrors.name ? true : undefined}
                />
                {fieldErrors.name ? (
                  <span className="field-error">{fieldErrors.name}</span>
                ) : null}
              </label>
              <label>
                Descripción
                <textarea
                  name="description"
                  defaultValue={collection.description ?? ""}
                  maxLength={2000}
                  rows={5}
                />
                {fieldErrors.description ? (
                  <span className="field-error">{fieldErrors.description}</span>
                ) : null}
              </label>
              <label>
                Visibilidad
                <select name="visibility" defaultValue={collection.visibility}>
                  <option value="PRIVATE">Privada</option>
                  <option value="PUBLIC">Pública</option>
                </select>
              </label>
              <button
                className="primary-action"
                type="submit"
                disabled={pending}
              >
                {pending ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
          ) : (
            <div className="read-only-note">
              <div className="eyebrow">Solo lectura</div>
              <h2>
                {collection.status === "ARCHIVED"
                  ? "Esta ludoteca está archivada"
                  : "Puedes consultar este espacio"}
              </h2>
              <p className="lead">
                La API no concedió capacidad de edición para tu rol y el estado
                actual.
              </p>
            </div>
          )}

          {message ? (
            <p
              className={`form-message ${message.includes("guardados") || message.includes("archivada sin") ? "success-message" : "error-message"}`}
              role="status"
            >
              {message}
            </p>
          ) : null}

          {canArchive ? (
            <div className="archive-zone">
              <div>
                <h3>Archivar ludoteca</h3>
                <p>Oculta este espacio sin eliminar membresías ni historial.</p>
              </div>
              <button
                className="danger-action"
                type="button"
                onClick={() => void handleArchive()}
                disabled={pending}
              >
                Archivar
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {collection.effectiveRole !== null ? (
        <CopyInventoryWorkspace
          collection={collection}
          onGameCountChange={(difference) =>
            setCollection((current) =>
              current === null
                ? current
                : {
                    ...current,
                    gameCount: Math.max(0, current.gameCount + difference),
                  },
            )
          }
        />
      ) : null}
    </section>
  );
}
