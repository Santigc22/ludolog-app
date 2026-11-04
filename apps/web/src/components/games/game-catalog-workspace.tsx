"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type { GameListQuery, GameSummary } from "@ludoteca/contracts";

import { ApiRequestError } from "../../lib/api/client";
import { createPrivateGame, listGames } from "../../lib/api/games";

type ViewState = "loading" | "ready" | "error";
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

function optionalNumber(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value === "" ? null : Number(value);
}

function playerLabel(game: GameSummary) {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} jugadores`
    : `${game.minPlayers}–${game.maxPlayers} jugadores`;
}

export function GameCatalogWorkspace() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [games, setGames] = useState<GameSummary[]>([]);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [draftMechanic, setDraftMechanic] = useState("");
  const [minPlayers, setMinPlayers] = useState<number | undefined>();
  const [maxPlayers, setMaxPlayers] = useState<number | undefined>();
  const [draftMinPlayers, setDraftMinPlayers] = useState("");
  const [draftMaxPlayers, setDraftMaxPlayers] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [sort, setSort] = useState<GameListQuery["sort"]>("name");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [reload, setReload] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;
    void listGames({
      q: query || undefined,
      mechanic: mechanic || undefined,
      minPlayers,
      maxPlayers,
      page,
      pageSize: 12,
      sort,
    })
      .then((response) => {
        if (!active) return;
        setGames(response.games);
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.totalItems);
        setViewState("ready");
      })
      .catch(() => active && setViewState("error"));
    return () => {
      active = false;
    };
  }, [mechanic, maxPlayers, minPlayers, page, query, reload, sort]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMin = draftMinPlayers ? Number(draftMinPlayers) : undefined;
    const nextMax = draftMaxPlayers ? Number(draftMaxPlayers) : undefined;
    if (nextMin !== undefined && nextMax !== undefined && nextMax < nextMin) {
      setFilterError(
        "El máximo de jugadores debe ser igual o mayor que el mínimo.",
      );
      return;
    }
    setFilterError(null);
    setViewState("loading");
    setPage(1);
    setQuery(draftQuery.trim());
    setMechanic(draftMechanic.trim());
    setMinPlayers(nextMin);
    setMaxPlayers(nextMax);
    setReload((value) => value + 1);
  }

  function clearFilters() {
    setDraftQuery("");
    setDraftMechanic("");
    setDraftMinPlayers("");
    setDraftMaxPlayers("");
    setQuery("");
    setMechanic("");
    setMinPlayers(undefined);
    setMaxPlayers(undefined);
    setFilterError(null);
    setPage(1);
    setViewState("loading");
    setReload((value) => value + 1);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setMessage(null);
    setCreatedGameId(null);
    setFieldErrors({});
    try {
      const response = await createPrivateGame({
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? "").trim() || null,
        publicationYear: optionalNumber(form, "publicationYear"),
        minPlayers: Number(form.get("minPlayers")),
        maxPlayers: Number(form.get("maxPlayers")),
        minDurationMinutes: optionalNumber(form, "minDurationMinutes"),
        maxDurationMinutes: optionalNumber(form, "maxDurationMinutes"),
        minAge: optionalNumber(form, "minAge"),
        maxAge: optionalNumber(form, "maxAge"),
        complexity: optionalNumber(form, "complexity"),
      });
      setCreatedGameId(response.game.id);
      setMessage("Tu juego privado quedó creado y solo tú puedes verlo.");
      setShowCreate(false);
      formElement.reset();
      setViewState("loading");
      setReload((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setMessage("Necesitas iniciar sesión para crear un juego privado.");
      } else if (error instanceof ApiRequestError && error.status === 403) {
        setMessage("Tu cuenta no tiene permiso para crear juegos privados.");
      } else {
        setFieldErrors(validationFields(error));
        setMessage("No pudimos crear el juego. Revisa los campos.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="collections-workspace" aria-labelledby="catalog-title">
      <header className="collection-heading">
        <div>
          <div className="eyebrow">Catálogo de referencia</div>
          <h1 id="catalog-title">Explora juegos</h1>
          <p className="lead">
            Encuentra el título o la edición exacta que tienes en tu estantería.
          </p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => setShowCreate((value) => !value)}
        >
          {showCreate ? "Cancelar" : "Crear juego privado"}
        </button>
      </header>

      {showCreate ? (
        <form className="collection-form stack-form" onSubmit={handleCreate}>
          <div className="eyebrow">Visible solo para ti</div>
          <h2>Nuevo juego privado</h2>
          <label>
            Nombre
            <input
              name="name"
              maxLength={220}
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
          </label>
          <div className="field-grid">
            <label>
              Jugadores mínimos
              <input
                name="minPlayers"
                type="number"
                min={1}
                required
                defaultValue={1}
              />
            </label>
            <label>
              Jugadores máximos
              <input
                name="maxPlayers"
                type="number"
                min={1}
                required
                defaultValue={1}
                aria-invalid={fieldErrors.maxPlayers ? true : undefined}
              />
              {fieldErrors.maxPlayers ? (
                <span className="field-error">{fieldErrors.maxPlayers}</span>
              ) : null}
            </label>
            <label>
              Año de publicación
              <input name="publicationYear" type="number" min={0} max={32767} />
            </label>
            <label>
              Complejidad (0–5)
              <input
                name="complexity"
                type="number"
                min={0}
                max={5}
                step="0.1"
              />
            </label>
            <label>
              Duración mínima
              <input name="minDurationMinutes" type="number" min={0} />
            </label>
            <label>
              Duración máxima
              <input name="maxDurationMinutes" type="number" min={0} />
            </label>
            <label>
              Edad mínima
              <input name="minAge" type="number" min={0} />
            </label>
            <label>
              Edad máxima
              <input name="maxAge" type="number" min={0} />
            </label>
          </div>
          <button className="primary-action" type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear juego privado"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p
          className={`form-message ${createdGameId ? "success-message" : "error-message"}`}
          role="status"
        >
          {message}
          {createdGameId ? (
            <>
              {" "}
              <Link href={`/catalogo/${createdGameId}`}>Abrir juego →</Link>
            </>
          ) : null}
        </p>
      ) : null}

      <form className="catalog-toolbar" role="search" onSubmit={handleSearch}>
        <label>
          Buscar juegos
          <input
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Ej. Catan"
          />
        </label>
        <label>
          Mecánica
          <input
            value={draftMechanic}
            onChange={(event) => setDraftMechanic(event.target.value)}
            placeholder="Ej. Cooperativo"
          />
        </label>
        <label>
          Jugadores desde
          <input
            type="number"
            min={1}
            value={draftMinPlayers}
            onChange={(event) => setDraftMinPlayers(event.target.value)}
            placeholder="Mínimo"
          />
        </label>
        <label>
          Jugadores hasta
          <input
            type="number"
            min={1}
            value={draftMaxPlayers}
            onChange={(event) => setDraftMaxPlayers(event.target.value)}
            placeholder="Máximo"
          />
        </label>
        <label>
          Orden
          <select
            value={sort}
            onChange={(event) => {
              setPage(1);
              setViewState("loading");
              setSort(event.target.value as GameListQuery["sort"]);
            }}
          >
            <option value="name">Nombre</option>
            <option value="newest">Más recientes</option>
            <option value="publicationYear">Año de publicación</option>
          </select>
        </label>
        <button className="secondary-action" type="submit">
          Aplicar filtros
        </button>
        <button
          className="text-filter-action"
          type="button"
          onClick={clearFilters}
        >
          Limpiar
        </button>
      </form>

      {filterError ? (
        <p className="form-message error-message" role="alert">
          {filterError}
        </p>
      ) : null}

      {viewState === "ready" ? (
        <p className="results-count" aria-live="polite">
          {totalItems}{" "}
          {totalItems === 1 ? "juego encontrado" : "juegos encontrados"}
        </p>
      ) : null}

      {viewState === "loading" ? (
        <div className="collection-state" aria-busy="true">
          Buscando juegos…
        </div>
      ) : null}
      {viewState === "error" ? (
        <div className="collection-state centered-card">
          <h2>No pudimos cargar el catálogo</h2>
          <p className="lead">
            Verifica que la API esté disponible e inténtalo de nuevo.
          </p>
          <button
            className="secondary-action"
            onClick={() => {
              setViewState("loading");
              setReload((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {viewState === "ready" && games.length === 0 ? (
        <div className="collection-empty">
          <div className="empty-icon" aria-hidden="true">
            ⌕
          </div>
          <h2>
            {query ||
            mechanic ||
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "No encontramos coincidencias"
              : "El catálogo está listo para crecer"}
          </h2>
          <p className="lead">
            {query ||
            mechanic ||
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "Prueba ampliando el rango o quitando alguno de los filtros."
              : "Inicia sesión para agregar un juego privado."}
          </p>
        </div>
      ) : null}
      {viewState === "ready" && games.length > 0 ? (
        <div className="game-grid">
          {games.map((game) => (
            <Link
              className="game-card"
              href={`/catalogo/${game.id}`}
              key={game.id}
            >
              <div className="collection-card-top">
                <span
                  className={`visibility-chip ${game.isOwnedByViewer ? "visibility-private" : "visibility-public"}`}
                >
                  {game.visibility === "PRIVATE"
                    ? "Privado · Tuyo"
                    : "Catálogo público"}
                </span>
                {game.publicationYear != null ? (
                  <span>{game.publicationYear}</span>
                ) : null}
              </div>
              <h2>{game.name}</h2>
              <p>{game.description ?? "Sin descripción disponible."}</p>
              {game.mechanics.length > 0 ? (
                <div className="mechanic-list" aria-label="Mecánicas">
                  {game.mechanics.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ) : null}
              <footer>
                <span>{playerLabel(game)}</span>
                <span>Ver ficha →</span>
              </footer>
            </Link>
          ))}
        </div>
      ) : null}

      {viewState === "ready" && totalPages > 1 ? (
        <nav className="pagination" aria-label="Paginación del catálogo">
          <button
            className="secondary-action"
            disabled={page === 1}
            onClick={() => {
              setViewState("loading");
              setPage((value) => value - 1);
            }}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="secondary-action"
            disabled={page >= totalPages}
            onClick={() => {
              setViewState("loading");
              setPage((value) => value + 1);
            }}
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </section>
  );
}
