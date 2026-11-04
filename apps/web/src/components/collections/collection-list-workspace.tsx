"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

import type { Collection } from "@ludoteca/contracts";

import { ApiRequestError } from "../../lib/api/client";
import { createCollection, listCollections } from "../../lib/api/collections";

type ViewState = "loading" | "ready" | "unauthenticated" | "error";
type FieldErrors = Readonly<Record<string, string>>;

function validationFields(error: unknown): FieldErrors {
  if (
    !(error instanceof ApiRequestError) ||
    error.code !== "VALIDATION_ERROR"
  ) {
    return {};
  }

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

function visibilityLabel(value: Collection["visibility"]) {
  return value === "PUBLIC" ? "Pública" : "Privada";
}

export function CollectionListWorkspace() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await listCollections({ page, includeArchived });
        if (active) {
          setCollections(response.collections);
          setTotalPages(response.pagination.totalPages);
          setViewState("ready");
        }
      } catch (error) {
        if (active) {
          setViewState(
            error instanceof ApiRequestError && error.status === 401
              ? "unauthenticated"
              : "error",
          );
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [includeArchived, page]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const response = await createCollection({
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? "").trim() || null,
        visibility: form.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE",
      });
      setCollections((current) => [response.collection, ...current]);
      setShowCreate(false);
      setMessage("Tu ludoteca quedó creada.");
      formElement.reset();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setViewState("unauthenticated");
      } else {
        setFieldErrors(validationFields(error));
        setMessage("No pudimos crear la ludoteca. Revisa los campos.");
      }
    } finally {
      setPending(false);
    }
  }

  if (viewState === "loading") {
    return (
      <section className="collection-state" aria-busy="true">
        Preparando tus estanterías…
      </section>
    );
  }

  if (viewState === "unauthenticated") {
    return (
      <section className="collection-state centered-card">
        <div className="empty-icon" aria-hidden="true">
          ◇
        </div>
        <h1>Tu colección te espera</h1>
        <p className="lead">
          Inicia sesión para organizar tus ludotecas personales.
        </p>
        <Link className="primary-action link-action" href="/acceso">
          Ir al acceso
        </Link>
      </section>
    );
  }

  if (viewState === "error") {
    return (
      <section className="collection-state centered-card">
        <h1>No pudimos cargar tus ludotecas</h1>
        <p className="lead">
          Verifica que la API esté disponible e inténtalo de nuevo.
        </p>
        <button className="secondary-action" onClick={() => location.reload()}>
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <section
      className="collections-workspace"
      aria-labelledby="collections-title"
    >
      <header className="collection-heading">
        <div>
          <div className="eyebrow">Inventario personal</div>
          <h1 id="collections-title">Mis ludotecas</h1>
          <p className="lead">
            Organiza cada estantería como un espacio independiente.
          </p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => setShowCreate((value) => !value)}
        >
          {showCreate ? "Cancelar" : "Nueva ludoteca"}
        </button>
      </header>

      {showCreate ? (
        <form className="collection-form stack-form" onSubmit={handleCreate}>
          <div className="eyebrow">Nuevo espacio</div>
          <h2>Crea una ludoteca</h2>
          <label>
            Nombre
            <input
              name="name"
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
            <textarea name="description" maxLength={2000} rows={3} />
            {fieldErrors.description ? (
              <span className="field-error">{fieldErrors.description}</span>
            ) : null}
          </label>
          <label>
            Visibilidad
            <select name="visibility" defaultValue="PRIVATE">
              <option value="PRIVATE">Privada</option>
              <option value="PUBLIC">Pública</option>
            </select>
          </label>
          <button className="primary-action" type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear ludoteca"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p
          className={`form-message ${message.includes("creada") ? "success-message" : "error-message"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="collection-toolbar">
        <label className="check-field">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => {
              setPage(1);
              setIncludeArchived(event.target.checked);
            }}
          />
          Mostrar archivadas
        </label>
      </div>

      {collections.length === 0 ? (
        <div className="collection-empty">
          <div className="empty-icon" aria-hidden="true">
            □
          </div>
          <h2>
            {includeArchived
              ? "No hay ludotecas para mostrar"
              : "Tu primera estantería empieza aquí"}
          </h2>
          <p className="lead">
            Crea un espacio para comenzar a organizar tus juegos.
          </p>
          {!showCreate ? (
            <button
              className="primary-action"
              onClick={() => setShowCreate(true)}
            >
              Crear mi primera ludoteca
            </button>
          ) : null}
        </div>
      ) : (
        <div className="collection-grid">
          {collections.map((collection) => (
            <Link
              className="collection-card"
              href={`/ludotecas/${collection.id}`}
              key={collection.id}
            >
              <div className="collection-card-top">
                <span
                  className={`visibility-chip visibility-${collection.visibility.toLowerCase()}`}
                >
                  {visibilityLabel(collection.visibility)}
                </span>
                {collection.status === "ARCHIVED" ? (
                  <span className="archive-chip">Archivada</span>
                ) : null}
              </div>
              <h2>{collection.name}</h2>
              <p>{collection.description ?? "Sin descripción todavía."}</p>
              <footer>
                <span className="collection-game-count">
                  {collection.gameCount}{" "}
                  {collection.gameCount === 1 ? "juego" : "juegos"}
                </span>
                <span>Ver detalle →</span>
              </footer>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="pagination" aria-label="Paginación de ludotecas">
          <button
            className="secondary-action"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="secondary-action"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </section>
  );
}
