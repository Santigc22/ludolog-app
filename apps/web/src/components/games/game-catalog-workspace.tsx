"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type {
  GameListQuery,
  GameSummary,
  GameTaxonomyOptionsResponse,
} from "@ludoteca/contracts";

import { AutocompleteInput, TagAutocomplete } from "../forms/tag-autocomplete";
import { ManagedImage } from "../media/managed-image";
import { AdminGameBulkImport } from "./admin-game-bulk-import";
import { ApiRequestError } from "../../lib/api/client";
import { getCurrentSession, SESSION_CHANGED_EVENT } from "../../lib/api/auth";
import {
  createPrivateGame,
  createPublicGame,
  listGames,
  listGameTaxonomyOptions,
} from "../../lib/api/games";
import { imageFileError, uploadGameCover } from "../../lib/api/media";

type ViewState = "loading" | "ready" | "error";
type SessionState = "checking" | "authenticated" | "anonymous";
type CreationMode = "private" | "public" | "bulk";
type FieldErrors = Readonly<Record<string, string>>;

const emptyTaxonomyOptions: GameTaxonomyOptionsResponse = {
  mechanics: [],
  categories: [],
};

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

function tagList(form: FormData, name: string) {
  return String(form.get(name) ?? "")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function playerLabel(game: GameSummary) {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} jugadores`
    : `${game.minPlayers}–${game.maxPlayers} jugadores`;
}

export function GameCatalogWorkspace() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [games, setGames] = useState<GameSummary[]>([]);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [draftMechanic, setDraftMechanic] = useState("");
  const [category, setCategory] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
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
  const [creationMode, setCreationMode] = useState<CreationMode>("private");
  const [canPublishDirectly, setCanPublishDirectly] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [taxonomyOptions, setTaxonomyOptions] =
    useState<GameTaxonomyOptionsResponse>(emptyTaxonomyOptions);

  useEffect(() => {
    let active = true;

    function refreshSession() {
      void getCurrentSession()
        .then((response) => {
          if (active) {
            setCanPublishDirectly(response.user.roles.includes("ADMIN"));
            setSessionState("authenticated");
          }
        })
        .catch(() => {
          if (active) {
            setSessionState("anonymous");
            setCanPublishDirectly(false);
            setShowCreate(false);
          }
        });
    }

    refreshSession();
    window.addEventListener(SESSION_CHANGED_EVENT, refreshSession);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED_EVENT, refreshSession);
    };
  }, []);

  useEffect(() => {
    let active = true;

    function refreshTaxonomies() {
      void listGameTaxonomyOptions()
        .then((response) => {
          if (active) setTaxonomyOptions(response);
        })
        .catch(() => {
          if (active) setTaxonomyOptions(emptyTaxonomyOptions);
        });
    }

    refreshTaxonomies();
    window.addEventListener(SESSION_CHANGED_EVENT, refreshTaxonomies);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED_EVENT, refreshTaxonomies);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listGames({
      q: query || undefined,
      mechanic: mechanic || undefined,
      category: category || undefined,
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
  }, [category, mechanic, maxPlayers, minPlayers, page, query, reload, sort]);

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
    setCategory(draftCategory.trim());
    setMinPlayers(nextMin);
    setMaxPlayers(nextMax);
    setReload((value) => value + 1);
  }

  function clearFilters() {
    setDraftQuery("");
    setDraftMechanic("");
    setDraftCategory("");
    setDraftMinPlayers("");
    setDraftMaxPlayers("");
    setQuery("");
    setMechanic("");
    setCategory("");
    setMinPlayers(undefined);
    setMaxPlayers(undefined);
    setFilterError(null);
    setPage(1);
    setViewState("loading");
    setReload((value) => value + 1);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sessionState !== "authenticated") {
      setShowCreate(false);
      setMessage("Necesitas iniciar sesión para crear un juego privado.");
      return;
    }
    if (creationMode === "public" && !canPublishDirectly) {
      setShowCreate(false);
      setMessage("Tu cuenta no puede publicar juegos directamente.");
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const coverFile = (
      formElement.elements.namedItem("cover") as HTMLInputElement | null
    )?.files?.[0];
    if (coverFile) {
      const coverError =
        coverFile.size === 0
          ? "La imagen seleccionada está vacía."
          : imageFileError(coverFile);
      if (coverError) {
        setFieldErrors({ cover: coverError });
        setMessage("Revisa la portada antes de crear el juego.");
        setCreatedGameId(null);
        return;
      }
    }
    setPending(true);
    setMessage(null);
    setCreatedGameId(null);
    setFieldErrors({});
    try {
      const input = {
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
        mechanics: tagList(form, "mechanics"),
        categories: tagList(form, "categories"),
      };
      const response =
        creationMode === "public"
          ? await createPublicGame({
              ...input,
              classification: String(
                form.get("classification") ?? "OFFICIAL",
              ) as "OFFICIAL" | "COMMUNITY",
            })
          : await createPrivateGame(input);
      setCreatedGameId(response.game.id);
      if (coverFile) {
        try {
          await uploadGameCover(response.game.id, coverFile);
          setMessage(
            creationMode === "public"
              ? "El juego y su portada quedaron publicados directamente en el catálogo."
              : "Tu juego privado y su portada quedaron guardados. Solo tú puedes verlo.",
          );
        } catch (error) {
          setMessage(
            error instanceof ApiRequestError && error.status === 413
              ? `${creationMode === "public" ? "El juego quedó publicado" : "Tu juego privado quedó creado"}, pero la portada superó el límite de 8 MB. Puedes añadirla desde el detalle.`
              : `${creationMode === "public" ? "El juego quedó publicado" : "Tu juego privado quedó creado"}, pero no pudimos guardar la portada. Puedes reintentarlo desde el detalle.`,
          );
        }
      } else {
        setMessage(
          creationMode === "public"
            ? "El juego quedó publicado directamente y figura como aprobado por ti."
            : "Tu juego privado quedó creado y solo tú puedes verlo.",
        );
      }
      setShowCreate(false);
      formElement.reset();
      setViewState("loading");
      setReload((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setMessage("Necesitas iniciar sesión para crear un juego privado.");
      } else if (error instanceof ApiRequestError && error.status === 403) {
        setMessage(
          creationMode === "public"
            ? "Tu cuenta no puede publicar juegos directamente."
            : "Tu cuenta no tiene permiso para crear juegos privados.",
        );
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
        {sessionState === "authenticated" ? (
          <div className="catalog-create-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                setCreationMode("private");
                setShowCreate(
                  (visible) => !(visible && creationMode === "private"),
                );
              }}
            >
              {showCreate && creationMode === "private"
                ? "Cancelar"
                : "Crear juego privado"}
            </button>
            {canPublishDirectly ? (
              <>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => {
                    setCreationMode("bulk");
                    setShowCreate(
                      (visible) => !(visible && creationMode === "bulk"),
                    );
                  }}
                >
                  {showCreate && creationMode === "bulk"
                    ? "Cancelar"
                    : "Carga por lote"}
                </button>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => {
                    setCreationMode("public");
                    setShowCreate(
                      (visible) => !(visible && creationMode === "public"),
                    );
                  }}
                >
                  {showCreate && creationMode === "public"
                    ? "Cancelar"
                    : "Publicar juego directamente"}
                </button>
              </>
            ) : null}
          </div>
        ) : sessionState === "anonymous" ? (
          <Link className="secondary-action link-action" href="/acceso">
            Inicia sesión para crear
          </Link>
        ) : null}
      </header>

      {showCreate &&
      sessionState === "authenticated" &&
      creationMode === "bulk" ? (
        <AdminGameBulkImport
          onCompleted={() => {
            setViewState("loading");
            setReload((value) => value + 1);
          }}
        />
      ) : showCreate && sessionState === "authenticated" ? (
        <form className="collection-form stack-form" onSubmit={handleCreate}>
          <div className="eyebrow">
            {creationMode === "public"
              ? "Publicación administrativa"
              : "Visible solo para ti"}
          </div>
          <h2>
            {creationMode === "public"
              ? "Nuevo juego público"
              : "Nuevo juego privado"}
          </h2>
          {creationMode === "public" ? (
            <>
              <p className="form-message admin-publication-note">
                Se publicará inmediatamente. En Moderación figurará como
                aprobado por tu cuenta y con resolución administrativa.
              </p>
              <label>
                Clasificación
                <select name="classification" defaultValue="OFFICIAL">
                  <option value="OFFICIAL">Oficial</option>
                  <option value="COMMUNITY">Comunitario</option>
                </select>
              </label>
            </>
          ) : null}
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
          <label>
            Portada (opcional)
            <input
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={fieldErrors.cover ? true : undefined}
            />
            <small>Imagen JPG, PNG o WebP de máximo 8 MB.</small>
            {fieldErrors.cover ? (
              <span className="field-error">{fieldErrors.cover}</span>
            ) : null}
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
          <TagAutocomplete
            name="mechanics"
            label="Mecánicas"
            suggestions={taxonomyOptions.mechanics}
            placeholder="Ej. Construcción de mazos"
          />
          <TagAutocomplete
            name="categories"
            label="Categorías"
            suggestions={taxonomyOptions.categories}
            placeholder="Ej. Cooperativo o Cartas"
          />
          <button className="primary-action" type="submit" disabled={pending}>
            {pending
              ? creationMode === "public"
                ? "Publicando…"
                : "Creando…"
              : creationMode === "public"
                ? "Publicar y aprobar"
                : "Crear juego privado"}
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
        <AutocompleteInput
          label="Mecánica"
          value={draftMechanic}
          onChange={setDraftMechanic}
          suggestions={taxonomyOptions.mechanics}
          placeholder="Ej. Dice rolling"
        />
        <AutocompleteInput
          label="Categoría"
          value={draftCategory}
          onChange={setDraftCategory}
          suggestions={taxonomyOptions.categories}
          placeholder="Ej. Cooperativo"
        />
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
        <p className="player-filter-help">
          Con un solo valor buscamos juegos que admitan exactamente esa
          cantidad. Con ambos, el rango registrado debe coincidir completo.
        </p>
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
            category ||
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "No encontramos coincidencias"
              : "El catálogo está listo para crecer"}
          </h2>
          <p className="lead">
            {query ||
            mechanic ||
            category ||
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
              <div className="game-card-cover">
                {game.coverMediaId ? (
                  <ManagedImage
                    mediaId={game.coverMediaId}
                    variant="thumbnail"
                    alt={`Portada de ${game.name}`}
                    width={320}
                    height={400}
                  />
                ) : (
                  <span aria-hidden="true">Sin portada</span>
                )}
              </div>
              <div className="collection-card-top">
                <span
                  className={`visibility-chip ${game.visibility === "PRIVATE" ? "visibility-private" : "visibility-public"}`}
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
                <div className="taxonomy-group">
                  <small>Mecánicas</small>
                  <div className="mechanic-list">
                    {game.mechanics.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {game.categories.length > 0 ? (
                <div className="taxonomy-group">
                  <small>Categorías</small>
                  <div className="mechanic-list">
                    {game.categories.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
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
