"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type {
  Collection,
  Copy,
  GameDetail,
  GameTaxonomyOptionsResponse,
} from "@ludoteca/contracts";

import { TagAutocomplete } from "../forms/tag-autocomplete";
import { ManagedImage } from "../media/managed-image";
import { ApiRequestError } from "../../lib/api/client";
import { listCollections } from "../../lib/api/collections";
import { createCopy } from "../../lib/api/copies";
import {
  getGame,
  listGameTaxonomyOptions,
  updatePublicGame,
} from "../../lib/api/games";
import { imageFileError, uploadGameCover } from "../../lib/api/media";
import { submitGameForModeration } from "../../lib/api/moderation";

type ViewState = "loading" | "ready" | "not-found" | "error";
type CollectionState =
  | "idle"
  | "loading"
  | "ready"
  | "unauthenticated"
  | "error";
type Selection = { gameId: string; editionId: string | null };
type CopyCondition = Copy["condition"];
type Message = { kind: "success" | "error"; text: string };

const emptyTaxonomyOptions: GameTaxonomyOptionsResponse = {
  mechanics: [],
  categories: [],
};

const conditions: ReadonlyArray<[CopyCondition, string]> = [
  ["NEW", "Nueva"],
  ["LIKE_NEW", "Como nueva"],
  ["GOOD", "Buena"],
  ["FAIR", "Aceptable"],
  ["POOR", "Deficiente"],
  ["DAMAGED", "Dañada"],
];

function numberRange(
  minimum: number | null,
  maximum: number | null,
  suffix: string,
) {
  if (minimum === null && maximum === null) return "Sin especificar";
  if (minimum === maximum) return `${minimum} ${suffix}`;
  if (minimum === null) return `Hasta ${maximum} ${suffix}`;
  if (maximum === null) return `Desde ${minimum} ${suffix}`;
  return `${minimum}–${maximum} ${suffix}`;
}

function editionMetadata(edition: GameDetail["editions"][number]) {
  return [
    edition.languageCode,
    edition.publicationYear,
    edition.editionNumber ? `Edición ${edition.editionNumber}` : null,
    edition.isbn ? `ISBN ${edition.isbn}` : null,
    edition.sku ? `SKU ${edition.sku}` : null,
    edition.upc ? `UPC ${edition.upc}` : null,
  ]
    .filter((value) => value !== null)
    .join(" · ");
}

export function GameDetailWorkspace({ gameId }: { gameId: string }) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [game, setGame] = useState<GameDetail | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [reload, setReload] = useState(0);
  const [collectionState, setCollectionState] =
    useState<CollectionState>("idle");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [copyPending, setCopyPending] = useState(false);
  const [copyMessage, setCopyMessage] = useState<Message | null>(null);
  const [createdCollectionId, setCreatedCollectionId] = useState<string | null>(
    null,
  );
  const [showSubmission, setShowSubmission] = useState(false);
  const [submissionPending, setSubmissionPending] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [coverPending, setCoverPending] = useState(false);
  const [coverMessage, setCoverMessage] = useState<Message | null>(null);
  const [showCatalogEditor, setShowCatalogEditor] = useState(false);
  const [catalogUpdatePending, setCatalogUpdatePending] = useState(false);
  const [catalogUpdateMessage, setCatalogUpdateMessage] =
    useState<Message | null>(null);
  const [taxonomyOptions, setTaxonomyOptions] =
    useState<GameTaxonomyOptionsResponse>(emptyTaxonomyOptions);

  useEffect(() => {
    let active = true;
    void getGame(gameId)
      .then((response) => {
        if (!active) return;
        setGame(response.game);
        setViewState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setViewState(
          error instanceof ApiRequestError && error.status === 404
            ? "not-found"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [gameId, reload]);

  useEffect(() => {
    let active = true;
    void listGameTaxonomyOptions()
      .then((response) => {
        if (active) setTaxonomyOptions(response);
      })
      .catch(() => {
        if (active) setTaxonomyOptions(emptyTaxonomyOptions);
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadWritableCollections() {
    setCollectionState("loading");
    setCopyMessage(null);
    try {
      const response = await listCollections({ page: 1, pageSize: 100 });
      setCollections(
        response.collections.filter(
          (collection) =>
            collection.status === "ACTIVE" &&
            (collection.effectiveRole === "OWNER" ||
              collection.effectiveRole === "MANAGER"),
        ),
      );
      setCollectionState("ready");
    } catch (error) {
      setCollectionState(
        error instanceof ApiRequestError && error.status === 401
          ? "unauthenticated"
          : "error",
      );
    }
  }

  function chooseSelection(nextSelection: Selection) {
    setSelection(nextSelection);
    setCopyMessage(null);
    setCreatedCollectionId(null);
    if (collectionState === "idle") void loadWritableCollections();
  }

  async function handleCreateCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selection === null) return;
    const form = new FormData(event.currentTarget);
    const collectionId = String(form.get("collectionId") ?? "");
    setCopyPending(true);
    setCopyMessage(null);
    setCreatedCollectionId(null);
    try {
      await createCopy(collectionId, {
        gameId: selection.gameId,
        gameEditionId: selection.editionId,
        condition: String(form.get("condition")) as CopyCondition,
        alias: String(form.get("alias") ?? "").trim() || null,
        notes: String(form.get("notes") ?? "").trim() || null,
      });
      setCreatedCollectionId(collectionId);
      setCopyMessage({
        kind: "success",
        text: "La copia quedó registrada en tu ludoteca.",
      });
    } catch (error) {
      setCopyMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 403
            ? "No tienes permiso para registrar copias en esa ludoteca."
            : "No pudimos registrar la copia. Inténtalo de nuevo.",
      });
    } finally {
      setCopyPending(false);
    }
  }

  async function handleModerationSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    setSubmissionPending(true);
    setSubmissionMessage(null);
    try {
      const response = await submitGameForModeration(gameId, {
        note: note.trim() || null,
      });
      setGame((current) =>
        current === null
          ? current
          : {
              ...current,
              moderationStatus: response.moderationCase.game.moderationStatus,
            },
      );
      setShowSubmission(false);
      setSubmissionMessage(
        "El juego fue enviado a moderación. Te avisaremos cuando exista una decisión.",
      );
    } catch (error) {
      setSubmissionMessage(
        error instanceof ApiRequestError && error.status === 409
          ? "Este juego ya fue enviado o no puede proponerse en su estado actual."
          : "No pudimos enviar el juego a moderación.",
      );
    } finally {
      setSubmissionPending(false);
    }
  }

  async function handleCoverUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("cover") as HTMLInputElement | null)
      ?.files?.[0];
    if (!file || file.size === 0) {
      setCoverMessage({ kind: "error", text: "Selecciona una imagen." });
      return;
    }
    const validationError = imageFileError(file);
    if (validationError) {
      setCoverMessage({ kind: "error", text: validationError });
      return;
    }
    setCoverPending(true);
    setCoverMessage(null);
    try {
      const response = await uploadGameCover(gameId, file);
      setGame((current) =>
        current ? { ...current, coverMediaId: response.coverMediaId } : current,
      );
      form.reset();
      setCoverMessage({ kind: "success", text: "La portada quedó guardada." });
    } catch (error) {
      setCoverMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 413
            ? "La imagen supera el límite de 8 MB."
            : "No pudimos guardar la portada.",
      });
    } finally {
      setCoverPending(false);
    }
  }

  async function handleCatalogUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nullableNumber = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value === "" ? null : Number(value);
    };
    setCatalogUpdatePending(true);
    setCatalogUpdateMessage(null);
    try {
      const response = await updatePublicGame(gameId, {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? "").trim() || null,
        publicationYear: nullableNumber("publicationYear"),
        minPlayers: Number(form.get("minPlayers")),
        maxPlayers: Number(form.get("maxPlayers")),
        minDurationMinutes: nullableNumber("minDurationMinutes"),
        maxDurationMinutes: nullableNumber("maxDurationMinutes"),
        minAge: nullableNumber("minAge"),
        maxAge: nullableNumber("maxAge"),
        complexity: nullableNumber("complexity"),
        mechanics: String(form.get("mechanics") ?? "")
          .split(/[\n,]/)
          .map((mechanic) => mechanic.trim())
          .filter(Boolean),
        categories: String(form.get("categories") ?? "")
          .split(/[\n,]/)
          .map((category) => category.trim())
          .filter(Boolean),
      });
      setGame(response.game);
      setShowCatalogEditor(false);
      setCatalogUpdateMessage({
        kind: "success",
        text: "La ficha pública quedó actualizada.",
      });
    } catch (error) {
      setCatalogUpdateMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 403
            ? "Tu cuenta no tiene permiso para administrar el catálogo."
            : error instanceof ApiRequestError && error.status === 400
              ? "Revisa los datos y asegúrate de que los máximos no sean menores que los mínimos."
              : "No pudimos actualizar la ficha pública.",
      });
    } finally {
      setCatalogUpdatePending(false);
    }
  }

  if (viewState === "loading")
    return (
      <section className="collection-state" aria-busy="true">
        Preparando la ficha del juego…
      </section>
    );
  if (viewState === "not-found")
    return (
      <section className="collection-state centered-card">
        <h1>No encontramos este juego</h1>
        <p className="lead">
          Puede que no exista o que no tengas permiso para verlo.
        </p>
        <Link className="primary-action link-action" href="/catalogo">
          Volver al catálogo
        </Link>
      </section>
    );
  if (viewState === "error" || !game)
    return (
      <section className="collection-state centered-card">
        <h1>No pudimos abrir el juego</h1>
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
      </section>
    );

  const selectedEdition = game.editions.find(
    (edition) => edition.id === selection?.editionId,
  );
  const canSubmitForModeration =
    game.isOwnedByViewer &&
    game.visibility === "PRIVATE" &&
    (game.moderationStatus === "DRAFT" || game.moderationStatus === "REJECTED");

  return (
    <section className="game-detail-workspace">
      <Link className="back-link" href="/catalogo">
        ← Volver al catálogo
      </Link>
      <div className="game-detail-grid">
        <aside className="collection-summary">
          <div className="game-detail-cover">
            {game.coverMediaId ? (
              <ManagedImage
                mediaId={game.coverMediaId}
                alt={`Portada de ${game.name}`}
                width={800}
                height={1000}
              />
            ) : (
              <span aria-hidden="true">Este juego aún no tiene portada</span>
            )}
          </div>
          <div className="eyebrow">
            {game.visibility === "PRIVATE"
              ? "Juego privado · Tuyo"
              : "Ficha del catálogo"}
          </div>
          <h1>{game.name}</h1>
          <p>{game.description ?? "Sin descripción disponible."}</p>
          <dl>
            <div>
              <dt>Jugadores</dt>
              <dd>
                {numberRange(game.minPlayers, game.maxPlayers, "jugadores")}
              </dd>
            </div>
            <div>
              <dt>Año de publicación</dt>
              <dd>{game.publicationYear ?? "Sin especificar"}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>
                {numberRange(
                  game.minDurationMinutes,
                  game.maxDurationMinutes,
                  "min",
                )}
              </dd>
            </div>
            <div>
              <dt>Edad</dt>
              <dd>{numberRange(game.minAge, game.maxAge, "años")}</dd>
            </div>
            <div>
              <dt>Complejidad</dt>
              <dd>
                {game.complexity === null
                  ? "Sin especificar"
                  : `${game.complexity} / 5`}
              </dd>
            </div>
            {game.visibility === "PRIVATE" ? (
              <div>
                <dt>Moderación</dt>
                <dd>
                  {game.moderationStatus === "PENDING_REVIEW"
                    ? "En revisión"
                    : game.moderationStatus === "REJECTED"
                      ? "Rechazado"
                      : "Borrador"}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="summary-mechanics">
            <span>Mecánicas</span>
            {game.mechanics.length > 0 ? (
              <ul>
                {game.mechanics.map((mechanic) => (
                  <li key={mechanic}>{mechanic}</li>
                ))}
              </ul>
            ) : (
              <p>Sin mecánicas registradas.</p>
            )}
          </div>
          <div className="summary-mechanics">
            <span>Categorías</span>
            {game.categories.length > 0 ? (
              <ul>
                {game.categories.map((category) => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
            ) : (
              <p>Sin categorías registradas.</p>
            )}
          </div>
          {game.canManageCatalog && game.visibility === "PUBLIC" ? (
            <button
              className="summary-action"
              type="button"
              onClick={() => {
                setCatalogUpdateMessage(null);
                setShowCatalogEditor((value) => !value);
              }}
            >
              {showCatalogEditor ? "Cancelar edición" : "Editar ficha pública"}
            </button>
          ) : null}
          {canSubmitForModeration ? (
            <button
              className="summary-action"
              type="button"
              onClick={() => setShowSubmission((value) => !value)}
            >
              {showSubmission ? "Cancelar propuesta" : "Proponer como global"}
            </button>
          ) : null}
          {game.moderationStatus === "PENDING_REVIEW" ? (
            <p className="summary-note">
              Este juego está esperando la decisión de un moderador.
            </p>
          ) : null}
          {(game.isOwnedByViewer && game.visibility === "PRIVATE") ||
          (game.canManageCatalog && game.visibility === "PUBLIC") ? (
            <form className="media-upload" onSubmit={handleCoverUpload}>
              <label>
                {game.coverMediaId ? "Cambiar portada" : "Añadir portada"}
                <input
                  name="cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                />
              </label>
              <small>JPG, PNG o WebP · máximo 8 MB.</small>
              <button
                className="secondary-action"
                type="submit"
                disabled={coverPending}
              >
                {coverPending ? "Guardando…" : "Guardar portada"}
              </button>
              {coverMessage ? (
                <p
                  className={`form-message ${coverMessage.kind === "success" ? "success-message" : "error-message"}`}
                  role="status"
                >
                  {coverMessage.text}
                </p>
              ) : null}
            </form>
          ) : null}
        </aside>

        <div className="game-detail-content">
          {catalogUpdateMessage ? (
            <p
              className={`form-message ${catalogUpdateMessage.kind === "success" ? "success-message" : "error-message"}`}
              role="status"
            >
              {catalogUpdateMessage.text}
            </p>
          ) : null}
          {showCatalogEditor && game.canManageCatalog ? (
            <section
              className="game-selection-panel"
              aria-labelledby="catalog-editor-title"
            >
              <header>
                <div className="eyebrow">Administración del catálogo</div>
                <h2 id="catalog-editor-title">Editar ficha pública</h2>
                <p className="lead">
                  Los cambios se publican inmediatamente y quedan registrados en
                  auditoría.
                </p>
              </header>
              <form className="stack-form" onSubmit={handleCatalogUpdate}>
                <label>
                  Nombre del juego
                  <input
                    name="name"
                    maxLength={220}
                    required
                    defaultValue={game.name}
                  />
                </label>
                <label>
                  Descripción
                  <textarea
                    name="description"
                    maxLength={2000}
                    rows={4}
                    defaultValue={game.description ?? ""}
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Año de publicación
                    <input
                      name="publicationYear"
                      type="number"
                      min={0}
                      max={32767}
                      defaultValue={game.publicationYear ?? ""}
                    />
                  </label>
                  <label>
                    Complejidad (0–5)
                    <input
                      name="complexity"
                      type="number"
                      min={0}
                      max={5}
                      step="0.01"
                      defaultValue={game.complexity ?? ""}
                    />
                  </label>
                  <label>
                    Jugadores mínimos
                    <input
                      name="minPlayers"
                      type="number"
                      min={1}
                      max={32767}
                      required
                      defaultValue={game.minPlayers}
                    />
                  </label>
                  <label>
                    Jugadores máximos
                    <input
                      name="maxPlayers"
                      type="number"
                      min={1}
                      max={32767}
                      required
                      defaultValue={game.maxPlayers}
                    />
                  </label>
                  <label>
                    Duración mínima (min)
                    <input
                      name="minDurationMinutes"
                      type="number"
                      min={0}
                      defaultValue={game.minDurationMinutes ?? ""}
                    />
                  </label>
                  <label>
                    Duración máxima (min)
                    <input
                      name="maxDurationMinutes"
                      type="number"
                      min={0}
                      defaultValue={game.maxDurationMinutes ?? ""}
                    />
                  </label>
                  <label>
                    Edad mínima
                    <input
                      name="minAge"
                      type="number"
                      min={0}
                      max={32767}
                      defaultValue={game.minAge ?? ""}
                    />
                  </label>
                  <label>
                    Edad máxima
                    <input
                      name="maxAge"
                      type="number"
                      min={0}
                      max={32767}
                      defaultValue={game.maxAge ?? ""}
                    />
                  </label>
                </div>
                <TagAutocomplete
                  name="mechanics"
                  label="Mecánicas"
                  suggestions={taxonomyOptions.mechanics}
                  initialValues={game.mechanics}
                  placeholder="Ej. Construcción de mazos"
                />
                <TagAutocomplete
                  name="categories"
                  label="Categorías"
                  suggestions={taxonomyOptions.categories}
                  initialValues={game.categories}
                  placeholder="Ej. Cooperativo o Cartas"
                />
                <button
                  className="primary-action"
                  disabled={catalogUpdatePending}
                >
                  {catalogUpdatePending ? "Guardando…" : "Guardar cambios"}
                </button>
              </form>
            </section>
          ) : null}
          <section className="game-selection-panel">
            <header>
              <div className="eyebrow">Tu colección</div>
              <h2>Añadir a una ludoteca</h2>
              <p className="lead">
                Consultar esta ficha no registra el juego. Si tienes una copia
                física, elige su edición y la ludoteca donde quieres guardarla.
              </p>
            </header>
            <div className="selection-step">
              <span className="selection-step-number">1</span>
              <div>
                <strong>Elige la edición de tu copia</strong>
                <p>También puedes registrarla sin una edición específica.</p>
              </div>
            </div>
            <button
              className="selection-card"
              type="button"
              aria-pressed={selection?.editionId === null}
              onClick={() =>
                chooseSelection({ gameId: game.id, editionId: null })
              }
            >
              <strong>Sin edición específica</strong>
              <span>
                Úsala si no conoces la edición o si esa información no es
                relevante para tu copia.
              </span>
            </button>
            <div className="edition-list">
              {game.editions.length === 0 ? (
                <div className="edition-empty">
                  <h3>No hay ediciones registradas</h3>
                  <p>Puedes elegir la opción sin edición específica.</p>
                </div>
              ) : (
                game.editions.map((edition) => (
                  <button
                    className="selection-card"
                    type="button"
                    key={edition.id}
                    aria-pressed={selection?.editionId === edition.id}
                    onClick={() =>
                      chooseSelection({
                        gameId: game.id,
                        editionId: edition.id,
                      })
                    }
                  >
                    <strong>
                      {edition.editionName ?? "Edición sin nombre"}
                    </strong>
                    <span>
                      {editionMetadata(edition) || "Sin detalles adicionales"}
                    </span>
                    {edition.moderationStatus === "PENDING_REVIEW" ? (
                      <small className="edition-pending-note">
                        Pendiente de moderación · solo tú puedes seleccionarla
                        por ahora
                      </small>
                    ) : null}
                    {edition.notes ? <small>{edition.notes}</small> : null}
                  </button>
                ))
              )}
            </div>

            {selection ? (
              <div className="copy-registration">
                <div className="selection-step">
                  <span className="selection-step-number">2</span>
                  <div>
                    <strong>Registra tu copia</strong>
                    <p>
                      {selectedEdition
                        ? (selectedEdition.editionName ??
                          "Edición seleccionada")
                        : "Sin edición específica"}
                    </p>
                  </div>
                </div>
                {collectionState === "loading" ? (
                  <p className="lead" aria-live="polite">
                    Cargando tus ludotecas…
                  </p>
                ) : null}
                {collectionState === "unauthenticated" ? (
                  <div className="registration-guidance">
                    <p>
                      Inicia sesión para registrar esta copia en una ludoteca.
                    </p>
                    <Link className="primary-action link-action" href="/acceso">
                      Iniciar sesión
                    </Link>
                  </div>
                ) : null}
                {collectionState === "error" ? (
                  <div className="registration-guidance">
                    <p>No pudimos cargar tus ludotecas.</p>
                    <button
                      className="secondary-action"
                      type="button"
                      onClick={() => void loadWritableCollections()}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : null}
                {collectionState === "ready" && collections.length === 0 ? (
                  <div className="registration-guidance">
                    <p>
                      Necesitas una ludoteca activa en la que seas propietario o
                      administrador.
                    </p>
                    <Link
                      className="primary-action link-action"
                      href="/ludotecas"
                    >
                      Crear o revisar ludotecas
                    </Link>
                  </div>
                ) : null}
                {collectionState === "ready" && collections.length > 0 ? (
                  <form className="stack-form" onSubmit={handleCreateCopy}>
                    <label>
                      Ludoteca
                      <select name="collectionId" required defaultValue="">
                        <option value="" disabled>
                          Selecciona una ludoteca
                        </option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="field-grid">
                      <label>
                        Estado de la copia
                        <select name="condition" defaultValue="GOOD">
                          {conditions.map(([code, label]) => (
                            <option key={code} value={code}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Alias (opcional)
                        <input name="alias" maxLength={140} />
                      </label>
                    </div>
                    <label>
                      Notas (opcional)
                      <textarea name="notes" maxLength={2000} rows={3} />
                    </label>
                    <button className="primary-action" disabled={copyPending}>
                      {copyPending ? "Registrando…" : "Registrar copia"}
                    </button>
                  </form>
                ) : null}
                {copyMessage ? (
                  <p
                    className={`form-message ${copyMessage.kind === "success" ? "success-message" : "error-message"}`}
                    role="status"
                  >
                    {copyMessage.text}
                    {createdCollectionId ? (
                      <>
                        {" "}
                        <Link href={`/ludotecas/${createdCollectionId}`}>
                          Abrir ludoteca →
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {showSubmission ? (
        <form
          className="moderation-submission stack-form"
          onSubmit={handleModerationSubmission}
        >
          <div className="eyebrow">Publicación global</div>
          <h2>Proponer {game.name}</h2>
          <p className="lead">
            Un moderador revisará los datos. Si lo aprueba, este mismo juego y
            sus copias pasarán a usar la ficha global.
          </p>
          <label>
            Nota para moderación (opcional)
            <textarea name="note" maxLength={2000} rows={4} />
          </label>
          <button className="primary-action" disabled={submissionPending}>
            {submissionPending ? "Enviando…" : "Enviar a moderación"}
          </button>
        </form>
      ) : null}
      {submissionMessage ? (
        <p
          className={`form-message ${game.moderationStatus === "PENDING_REVIEW" ? "success-message" : "error-message"}`}
          role="status"
        >
          {submissionMessage}
        </p>
      ) : null}
    </section>
  );
}
