"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type {
  CollectionDetail,
  Collection,
  Copy,
  CopyDetail,
  CopyListItem,
  GameDetail,
  GameSummary,
  GameTaxonomyOptionsResponse,
} from "@ludoteca/contracts";

import { AutocompleteInput } from "../forms/tag-autocomplete";
import { ManagedImage } from "../media/managed-image";
import { ApiRequestError } from "../../lib/api/client";
import { listCollections } from "../../lib/api/collections";
import {
  createCopy,
  exitCopy,
  getCopy,
  listCopies,
  moveCopy,
  updateCopy,
} from "../../lib/api/copies";
import {
  getGame,
  listGames,
  listGameTaxonomyOptions,
} from "../../lib/api/games";

type CopyCondition = Copy["condition"];
type LoadState = "loading" | "ready" | "error";
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

const exitReasons = [
  ["SOLD", "Venta externa"],
  ["TRADED", "Intercambio externo"],
  ["GIFTED", "Regalo"],
  ["DONATED", "Donación"],
  ["LOST", "Pérdida"],
  ["DISCARDED", "Descarte"],
  ["DAMAGED", "Retirada por daño"],
  ["OTHER", "Otra causa"],
] as const;

function conditionLabel(condition: CopyCondition) {
  return conditions.find(([code]) => code === condition)?.[1] ?? condition;
}

function copyAlias(copy: CopyListItem) {
  const alias = copy.alias?.trim();
  return alias || null;
}

function playerLabel(game: CopyListItem["game"]) {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} jugadores`
    : `${game.minPlayers}–${game.maxPlayers} jugadores`;
}

function editionLabel(edition: {
  id: string;
  editionName: string | null;
  editionNumber: string | null;
  languageCode: string | null;
}) {
  return (
    edition.editionName ??
    edition.editionNumber ??
    edition.languageCode ??
    `Edición ${edition.id.slice(0, 8)}`
  );
}

function editionStatusLabel(edition: CopyListItem["edition"]) {
  if (edition?.moderationStatus === "PENDING_REVIEW") {
    return "Pendiente de moderación";
  }
  if (edition?.moderationStatus === "REJECTED") return "Rechazada";
  return null;
}

export function CopyInventoryWorkspace({
  collection,
  onGameCountChange,
}: {
  collection: CollectionDetail;
  onGameCountChange?: (difference: number) => void;
}) {
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [copies, setCopies] = useState<CopyListItem[]>([]);
  const [selected, setSelected] = useState<CopyDetail | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [proposeEdition, setProposeEdition] = useState(false);
  const [editGame, setEditGame] = useState<GameDetail | null>(null);
  const [editEditionId, setEditEditionId] = useState("");
  const [editProposeEdition, setEditProposeEdition] = useState(false);
  const [destinations, setDestinations] = useState<Collection[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [reload, setReload] = useState(0);
  const [lifecycle, setLifecycle] = useState<"ACTIVE" | "EXITED" | "ALL">(
    "ACTIVE",
  );
  const [query, setQuery] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [category, setCategory] = useState("");
  const [minPlayers, setMinPlayers] = useState<number | undefined>();
  const [maxPlayers, setMaxPlayers] = useState<number | undefined>();
  const [draftQuery, setDraftQuery] = useState("");
  const [draftMechanic, setDraftMechanic] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftMinPlayers, setDraftMinPlayers] = useState("");
  const [draftMaxPlayers, setDraftMaxPlayers] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [taxonomyOptions, setTaxonomyOptions] =
    useState<GameTaxonomyOptionsResponse>(emptyTaxonomyOptions);

  const canManage = collection.canEdit && collection.status === "ACTIVE";

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

  useEffect(() => {
    let active = true;
    void listCopies(collection.id, {
      lifecycle,
      q: query || undefined,
      mechanic: mechanic || undefined,
      category: category || undefined,
      minPlayers,
      maxPlayers,
    })
      .then((response) => {
        if (!active) return;
        setCopies(response.copies);
        setTotalItems(response.pagination.totalItems);
        setLoadState("ready");
      })
      .catch(() => active && setLoadState("error"));
    return () => {
      active = false;
    };
  }, [
    collection.id,
    category,
    lifecycle,
    maxPlayers,
    mechanic,
    minPlayers,
    query,
    reload,
  ]);

  useEffect(() => {
    if (!showCreate || games.length > 0) return;
    void listGames({ page: 1, pageSize: 100, sort: "name" })
      .then((response) => setGames(response.games))
      .catch(() =>
        setMessage({
          kind: "error",
          text: "No pudimos cargar los juegos visibles.",
        }),
      );
  }, [games.length, showCreate]);

  useEffect(() => {
    const dialog = detailDialog.current;
    if (!selected || !dialog || dialog.open) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }, [selected]);

  function closeCopyDetail() {
    const dialog = detailDialog.current;
    if (dialog?.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute("open");
      }
    }
    setSelected(null);
  }

  async function showCopyDetail(copy: CopyDetail) {
    setSelected(copy);
    setEditGame(null);
    setEditEditionId(copy.gameEditionId ?? "");
    setEditProposeEdition(false);
    try {
      setEditGame((await getGame(copy.game.id)).game);
    } catch {
      setMessage({
        kind: "error",
        text: "No pudimos cargar las ediciones disponibles.",
      });
    }
  }

  async function refreshSelected(copyId: string) {
    try {
      const response = await getCopy(copyId);
      await showCopyDetail(response.copy);
    } catch {
      setSelected(null);
    }
    setReload((value) => value + 1);
  }

  async function handleSelect(copyId: string, clearMessage = true) {
    setPending(true);
    if (clearMessage) setMessage(null);
    try {
      await showCopyDetail((await getCopy(copyId)).copy);
    } catch {
      setMessage({
        kind: "error",
        text: "No pudimos abrir el detalle de la copia.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleGameChange(gameId: string) {
    setSelectedGame(null);
    setProposeEdition(false);
    if (!gameId) return;
    try {
      setSelectedGame((await getGame(gameId)).game);
    } catch {
      setMessage({
        kind: "error",
        text: "No pudimos cargar las ediciones del juego.",
      });
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setMessage(null);
    try {
      const optionalText = (name: string) =>
        String(form.get(name) ?? "").trim() || null;
      const publicationYear = optionalText("editionPublicationYear");
      const response = await createCopy(collection.id, {
        gameId: String(form.get("gameId") ?? ""),
        gameEditionId: proposeEdition
          ? null
          : String(form.get("gameEditionId") ?? "") || null,
        proposedEdition: proposeEdition
          ? {
              editionName: String(form.get("editionName") ?? ""),
              editionNumber: optionalText("editionNumber"),
              languageCode: optionalText("editionLanguageCode"),
              publicationYear: publicationYear ? Number(publicationYear) : null,
              isbn: optionalText("editionIsbn"),
              sku: optionalText("editionSku"),
              upc: optionalText("editionUpc"),
              notes: optionalText("editionNotes"),
            }
          : undefined,
        condition: String(form.get("condition")) as CopyCondition,
        alias: String(form.get("alias") ?? "").trim() || null,
        notes: String(form.get("notes") ?? "").trim() || null,
      });
      formElement.reset();
      setSelectedGame(null);
      setProposeEdition(false);
      setShowCreate(false);
      setMessage({
        kind: "success",
        text: response.editionProposal
          ? "La copia quedó registrada y la nueva edición fue enviada a moderación."
          : "La copia quedó registrada.",
      });
      onGameCountChange?.(1);
      setReload((value) => value + 1);
      await handleSelect(response.copy.id, false);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError &&
          error.code === "GAME_EDITION_NOT_FOUND"
            ? "La edición no pertenece al juego seleccionado."
            : "No pudimos registrar la copia. Revisa los datos.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage(null);
    try {
      const optionalText = (name: string) =>
        String(form.get(name) ?? "").trim() || null;
      const publicationYear = optionalText("editEditionPublicationYear");
      const response = await updateCopy(selected.id, {
        alias: String(form.get("alias") ?? "").trim() || null,
        notes: String(form.get("notes") ?? "").trim() || null,
        condition: String(form.get("condition")) as CopyCondition,
        gameEditionId: editProposeEdition ? undefined : editEditionId || null,
        proposedEdition: editProposeEdition
          ? {
              editionName: String(form.get("editEditionName") ?? ""),
              editionNumber: optionalText("editEditionNumber"),
              languageCode: optionalText("editEditionLanguageCode"),
              publicationYear: publicationYear ? Number(publicationYear) : null,
              isbn: optionalText("editEditionIsbn"),
              sku: optionalText("editEditionSku"),
              upc: optionalText("editEditionUpc"),
              notes: optionalText("editEditionNotes"),
            }
          : undefined,
      });
      await showCopyDetail(response.copy);
      setMessage({
        kind: "success",
        text: response.editionProposal
          ? "La copia quedó actualizada y la nueva edición fue enviada a moderación."
          : "La copia quedó actualizada.",
      });
      setReload((value) => value + 1);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === "GAME_EDITION_NOT_FOUND"
      ) {
        setMessage({
          kind: "error",
          text: "La edición no pertenece al juego de esta copia.",
        });
      } else {
        await handleMutationFailure(error, selected.id);
      }
    } finally {
      setPending(false);
    }
  }

  async function loadDestinations() {
    try {
      const response = await listCollections({ page: 1, pageSize: 100 });
      setDestinations(
        response.collections.filter(
          (candidate) =>
            candidate.id !== selected?.currentCollectionId &&
            candidate.status === "ACTIVE" &&
            (candidate.effectiveRole === "OWNER" ||
              candidate.effectiveRole === "MANAGER"),
        ),
      );
    } catch {
      setMessage({
        kind: "error",
        text: "No pudimos cargar los destinos autorizados.",
      });
    }
  }

  async function handleMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null) return;
    const destinationCollectionId = String(
      new FormData(event.currentTarget).get("destinationCollectionId") ?? "",
    );
    const destination = destinations.find(
      ({ id }) => id === destinationCollectionId,
    );
    if (
      !destination ||
      !window.confirm(`¿Mover esta copia a “${destination.name}”?`)
    )
      return;

    setPending(true);
    setMessage(null);
    try {
      const moved = (await moveCopy(selected.id, { destinationCollectionId }))
        .copy;
      setSelected(moved);
      onGameCountChange?.(-1);
      setMessage({
        kind: "success",
        text: "La copia cambió de ludoteca sin perder su historial.",
      });
      setReload((value) => value + 1);
    } catch (error) {
      await handleMutationFailure(error, selected.id);
    } finally {
      setPending(false);
    }
  }

  async function handleExit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason"),
    ) as (typeof exitReasons)[number][0];
    if (
      !window.confirm(
        "¿Retirar esta copia? Saldrá de la ludoteca, pero conservará su historial y adquisiciones.",
      )
    )
      return;

    setPending(true);
    setMessage(null);
    try {
      setSelected((await exitCopy(selected.id, { reason })).copy);
      onGameCountChange?.(-1);
      setMessage({
        kind: "success",
        text: "La copia fue retirada y su historial se conservó.",
      });
      setReload((value) => value + 1);
    } catch (error) {
      await handleMutationFailure(error, selected.id);
    } finally {
      setPending(false);
    }
  }

  async function handleMutationFailure(error: unknown, copyId: string) {
    if (error instanceof ApiRequestError && error.status === 409) {
      await refreshSelected(copyId);
      setMessage({
        kind: "error",
        text: "La copia cambió en otra operación. Mostramos su estado más reciente.",
      });
      return;
    }
    setMessage({ kind: "error", text: "No pudimos completar la operación." });
  }

  function handleFilters(event: FormEvent<HTMLFormElement>) {
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
    setLoadState("loading");
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
    setLoadState("loading");
    setReload((value) => value + 1);
  }

  return (
    <section className="copy-workspace" aria-labelledby="copy-title">
      <header className="copy-heading">
        <div>
          <div className="eyebrow">Inventario físico</div>
          <h2 id="copy-title">Copias de juegos</h2>
          <p>
            Consulta cada ejemplar y conserva la trazabilidad de sus
            movimientos.
          </p>
        </div>
        {canManage ? (
          <button
            className="primary-action"
            type="button"
            onClick={() => setShowCreate((value) => !value)}
          >
            {showCreate ? "Cancelar" : "Registrar copia"}
          </button>
        ) : null}
      </header>

      {showCreate ? (
        <form className="copy-form stack-form" onSubmit={handleCreate}>
          <h3>Nueva copia</h3>
          <label>
            Juego visible
            <select
              name="gameId"
              required
              defaultValue=""
              onChange={(event) => void handleGameChange(event.target.value)}
            >
              <option value="" disabled>
                Selecciona un juego
              </option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Edición del juego seleccionado
            <select
              name="gameEditionId"
              defaultValue=""
              disabled={selectedGame === null || proposeEdition}
            >
              <option value="">Sin edición específica</option>
              {selectedGame?.editions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {editionLabel(edition)}
                  {edition.moderationStatus === "PENDING_REVIEW"
                    ? " (pendiente de moderación)"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          {selectedGame?.visibility === "PUBLIC" &&
          selectedGame.moderationStatus === "APPROVED" ? (
            <div className="edition-proposal-toggle">
              <button
                className="secondary-action"
                type="button"
                aria-pressed={proposeEdition}
                onClick={() => setProposeEdition((value) => !value)}
              >
                {proposeEdition
                  ? "Usar una edición existente"
                  : "Proponer una nueva edición"}
              </button>
              <small>
                La copia se registra de inmediato. La nueva edición será visible
                para todos cuando un moderador la apruebe.
              </small>
            </div>
          ) : null}
          {proposeEdition ? (
            <fieldset className="edition-proposal-fields">
              <legend>Nueva edición para moderación</legend>
              <div className="field-grid">
                <label>
                  Nombre de la edición
                  <input
                    name="editionName"
                    maxLength={180}
                    placeholder="Ej. Deluxe"
                    required
                  />
                </label>
                <label>
                  Número o versión
                  <input name="editionNumber" maxLength={80} />
                </label>
                <label>
                  Idioma
                  <input
                    name="editionLanguageCode"
                    maxLength={12}
                    placeholder="Ej. es"
                  />
                </label>
                <label>
                  Año de publicación
                  <input
                    name="editionPublicationYear"
                    type="number"
                    min={0}
                    max={32767}
                  />
                </label>
                <label>
                  ISBN
                  <input name="editionIsbn" maxLength={32} />
                </label>
                <label>
                  SKU
                  <input name="editionSku" maxLength={80} />
                </label>
                <label>
                  UPC
                  <input name="editionUpc" maxLength={32} />
                </label>
              </div>
              <label>
                Notas sobre la edición
                <textarea name="editionNotes" maxLength={2000} rows={3} />
              </label>
            </fieldset>
          ) : null}
          <div className="field-grid">
            <label>
              Condición
              <select name="condition" defaultValue="GOOD">
                {conditions.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Alias de esta copia (opcional)
              <input
                name="alias"
                maxLength={140}
                placeholder="Ej. La del club o copia firmada"
              />
              <small>
                Sirve para distinguir este ejemplar; no cambia el juego
                seleccionado.
              </small>
            </label>
          </div>
          <label>
            Notas
            <textarea name="notes" maxLength={2000} rows={3} />
          </label>
          <button
            className="primary-action"
            disabled={pending || selectedGame === null}
          >
            Registrar copia
          </button>
        </form>
      ) : null}

      {message && !selected ? (
        <p
          className={`form-message ${message.kind === "success" ? "success-message" : "error-message"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <form
        className="inventory-filters"
        role="search"
        onSubmit={handleFilters}
      >
        <label>
          Nombre
          <input
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Ej. Azul"
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
          Estado
          <select
            value={lifecycle}
            onChange={(event) => {
              setLoadState("loading");
              setLifecycle(event.target.value as "ACTIVE" | "EXITED" | "ALL");
            }}
          >
            <option value="ACTIVE">En la ludoteca</option>
            <option value="EXITED">Retirados</option>
            <option value="ALL">Todo el historial</option>
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

      {loadState === "ready" ? (
        <p className="results-count" aria-live="polite">
          {totalItems}{" "}
          {totalItems === 1 ? "juego encontrado" : "juegos encontrados"}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p aria-busy="true">Cargando copias…</p>
      ) : null}
      {loadState === "error" ? (
        <p className="error-message">No pudimos cargar el inventario.</p>
      ) : null}
      {loadState === "ready" && copies.length === 0 ? (
        <div className="copy-empty">
          <h3>
            {query ||
            mechanic ||
            category ||
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "No hay coincidencias"
              : "Aún no hay copias"}
          </h3>
          <p>
            {query ||
            mechanic ||
            category ||
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "Prueba ampliando el rango o quitando alguno de los filtros."
              : "Registra el primer ejemplar físico de esta ludoteca."}
          </p>
        </div>
      ) : null}

      {copies.length > 0 ? (
        <div className="copy-grid">
          {copies.map((copy) => {
            const alias = copyAlias(copy);
            return (
              <button
                key={copy.id}
                className="copy-card"
                type="button"
                onClick={() => void handleSelect(copy.id)}
                aria-pressed={selected?.id === copy.id}
              >
                <span className="copy-card-cover">
                  {copy.game.coverMediaId ? (
                    <ManagedImage
                      key={`${copy.game.id}:${copy.game.coverMediaId}`}
                      mediaId={copy.game.coverMediaId}
                      variant="thumbnail"
                      alt={`Portada de ${copy.game.name}`}
                      width={320}
                      height={400}
                    />
                  ) : (
                    <span aria-hidden="true">Sin portada</span>
                  )}
                </span>

                <span className="copy-card-body">
                  <span className="copy-card-top">
                    <span
                      className={`copy-lifecycle ${copy.lifecycle === "ACTIVE" ? "copy-lifecycle-active" : "copy-lifecycle-exited"}`}
                    >
                      {copy.lifecycle === "ACTIVE" ? "En ludoteca" : "Retirada"}
                    </span>
                    <span className="copy-condition">
                      {conditionLabel(copy.condition)}
                    </span>
                  </span>

                  <span className="copy-card-title">{copy.game.name}</span>
                  {alias ? (
                    <span className="copy-alias">
                      Alias: <strong>{alias}</strong>
                    </span>
                  ) : null}

                  <span className="copy-card-facts">
                    <span>{playerLabel(copy.game)}</span>
                    {copy.edition ? (
                      <span>
                        {editionLabel(copy.edition)}
                        {editionStatusLabel(copy.edition)
                          ? ` · ${editionStatusLabel(copy.edition)}`
                          : ""}
                      </span>
                    ) : (
                      <span>Sin edición específica</span>
                    )}
                  </span>

                  {copy.game.mechanics.length > 0 ? (
                    <span className="taxonomy-group">
                      <small>Mecánicas</small>
                      <span className="mechanic-list">
                        {copy.game.mechanics.map((mechanic) => (
                          <span key={mechanic}>{mechanic}</span>
                        ))}
                      </span>
                    </span>
                  ) : null}
                  {copy.game.categories.length > 0 ? (
                    <span className="taxonomy-group">
                      <small>Categorías</small>
                      <span className="mechanic-list">
                        {copy.game.categories.map((category) => (
                          <span key={category}>{category}</span>
                        ))}
                      </span>
                    </span>
                  ) : null}

                  <span className="copy-card-footer">
                    <span>Ver detalle</span>
                    <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <dialog
          ref={detailDialog}
          key={selected.id}
          className="copy-detail copy-detail-dialog"
          aria-label="Detalle de la copia"
          onCancel={(event) => {
            event.preventDefault();
            closeCopyDetail();
          }}
          onClose={() => setSelected(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCopyDetail();
          }}
        >
          <header>
            <div className="copy-detail-heading">
              {selected.game.coverMediaId ? (
                <ManagedImage
                  mediaId={selected.game.coverMediaId}
                  variant="thumbnail"
                  alt={`Portada de ${selected.game.name}`}
                  width={320}
                  height={400}
                />
              ) : null}
              <div>
                <div className="eyebrow">Detalle de copia</div>
                <h3>{selected.game.name}</h3>
                {copyAlias(selected) ? (
                  <p className="copy-detail-alias">
                    Alias: <strong>{copyAlias(selected)}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="copy-detail-header-actions">
              <span className="status-pill">
                {selected.lifecycle === "ACTIVE" ? "Activa" : "Retirada"}
              </span>
              <button
                className="copy-detail-close"
                type="button"
                aria-label={`Cerrar detalle de ${selected.game.name}`}
                onClick={closeCopyDetail}
                autoFocus
              >
                ×
              </button>
            </div>
          </header>
          <dl className="copy-facts">
            <div>
              <dt>Juego</dt>
              <dd>{selected.game.name}</dd>
            </div>
            <div>
              <dt>Edición</dt>
              <dd>
                {selected.edition
                  ? `${editionLabel(selected.edition)}${
                      editionStatusLabel(selected.edition)
                        ? ` · ${editionStatusLabel(selected.edition)}`
                        : ""
                    }`
                  : "Sin edición específica"}
              </dd>
            </div>
            <div>
              <dt>Condición</dt>
              <dd>{conditionLabel(selected.condition)}</dd>
            </div>
            <div>
              <dt>Historial</dt>
              <dd>{selected.collectionHistory.length} tramo(s)</dd>
            </div>
          </dl>
          {message ? (
            <p
              className={`form-message ${message.kind === "success" ? "success-message" : "error-message"}`}
              role="status"
            >
              {message.text}
            </p>
          ) : null}
          {selected.lifecycle === "EXITED" ? (
            <p className="read-only-note">
              Esta copia fue retirada por <strong>{selected.exitReason}</strong>
              . Su historial y sus {selected.acquisitions.length}{" "}
              adquisición(es) siguen disponibles.
            </p>
          ) : null}

          <div className="copy-match-actions">
            <Link
              className="primary-action link-action"
              href={`/partidas?gameId=${encodeURIComponent(selected.game.id)}&copyId=${encodeURIComponent(selected.id)}${selected.gameEditionId ? `&editionId=${encodeURIComponent(selected.gameEditionId)}` : ""}`}
            >
              Registrar partida con esta copia
            </Link>
            <Link
              className="secondary-action link-action"
              href={`/partidas?historyGameId=${encodeURIComponent(selected.game.id)}`}
            >
              Ver historial de este juego
            </Link>
          </div>

          {canManage &&
          selected.lifecycle === "ACTIVE" &&
          selected.currentCollectionId === collection.id ? (
            <div className="copy-actions">
              <form className="stack-form" onSubmit={handleUpdate}>
                <h4>Editar copia</h4>
                <label>
                  Edición de esta copia
                  <select
                    name="editGameEditionId"
                    value={editEditionId}
                    disabled={editGame === null || editProposeEdition}
                    onChange={(event) => setEditEditionId(event.target.value)}
                  >
                    <option value="">Sin edición específica</option>
                    {selected.edition &&
                    !editGame?.editions.some(
                      (candidate) => candidate.id === selected.edition?.id,
                    ) ? (
                      <option value={selected.edition.id}>
                        {editionLabel(selected.edition)}
                        {editionStatusLabel(selected.edition)
                          ? ` (${editionStatusLabel(selected.edition)})`
                          : ""}
                      </option>
                    ) : null}
                    {editGame?.editions.map((edition) => (
                      <option key={edition.id} value={edition.id}>
                        {editionLabel(edition)}
                        {edition.moderationStatus === "PENDING_REVIEW"
                          ? " (pendiente de moderación)"
                          : ""}
                      </option>
                    ))}
                  </select>
                  <small>
                    Puedes cambiarla o elegir “Sin edición específica” sin
                    perder el historial de la copia.
                  </small>
                </label>
                {editGame?.visibility === "PUBLIC" &&
                editGame.moderationStatus === "APPROVED" ? (
                  <div className="edition-proposal-toggle">
                    <button
                      className="secondary-action"
                      type="button"
                      aria-pressed={editProposeEdition}
                      onClick={() => setEditProposeEdition((value) => !value)}
                    >
                      {editProposeEdition
                        ? "Usar una edición existente"
                        : "Proponer una nueva edición para esta copia"}
                    </button>
                    <small>
                      La edición quedará vinculada de inmediato a la copia y
                      será pública cuando moderación la apruebe.
                    </small>
                  </div>
                ) : null}
                {editProposeEdition ? (
                  <fieldset className="edition-proposal-fields">
                    <legend>Nueva edición para moderación</legend>
                    <div className="field-grid">
                      <label>
                        Nombre de la nueva edición
                        <input
                          name="editEditionName"
                          maxLength={180}
                          placeholder="Ej. Deluxe"
                          required
                        />
                      </label>
                      <label>
                        Número o versión de la nueva edición
                        <input name="editEditionNumber" maxLength={80} />
                      </label>
                      <label>
                        Idioma de la nueva edición
                        <input
                          name="editEditionLanguageCode"
                          maxLength={12}
                          placeholder="Ej. es"
                        />
                      </label>
                      <label>
                        Año de publicación de la nueva edición
                        <input
                          name="editEditionPublicationYear"
                          type="number"
                          min={0}
                          max={32767}
                        />
                      </label>
                      <label>
                        ISBN de la nueva edición
                        <input name="editEditionIsbn" maxLength={32} />
                      </label>
                      <label>
                        SKU de la nueva edición
                        <input name="editEditionSku" maxLength={80} />
                      </label>
                      <label>
                        UPC de la nueva edición
                        <input name="editEditionUpc" maxLength={32} />
                      </label>
                    </div>
                    <label>
                      Notas sobre la nueva edición
                      <textarea
                        name="editEditionNotes"
                        maxLength={2000}
                        rows={3}
                      />
                    </label>
                  </fieldset>
                ) : null}
                <label>
                  Alias de esta copia (opcional)
                  <input
                    name="alias"
                    maxLength={140}
                    defaultValue={selected.alias ?? ""}
                  />
                  <small>
                    Sirve para identificar el ejemplar; el juego asociado no
                    cambia.
                  </small>
                </label>
                <label>
                  Condición
                  <select name="condition" defaultValue={selected.condition}>
                    {conditions.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <small>
                    Marcarla como dañada no la retira automáticamente.
                  </small>
                </label>
                <label>
                  Notas
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    defaultValue={selected.notes ?? ""}
                  />
                </label>
                <button className="secondary-action" disabled={pending}>
                  Guardar copia
                </button>
              </form>

              <form className="stack-form" onSubmit={handleMove}>
                <h4>Mover</h4>
                <p>
                  Elige un destino explícito. La copia conservará todo su
                  historial.
                </p>
                <label>
                  Destino
                  <select
                    name="destinationCollectionId"
                    required
                    defaultValue=""
                    onFocus={() => void loadDestinations()}
                  >
                    <option value="" disabled>
                      Selecciona una ludoteca
                    </option>
                    {destinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary-action" disabled={pending}>
                  Mover copia
                </button>
              </form>

              <form className="stack-form exit-copy-form" onSubmit={handleExit}>
                <h4>Retirar</h4>
                <p>
                  La copia saldrá de la ludoteca, pero no será eliminada:
                  conservará historial y adquisiciones.
                </p>
                <label>
                  Causa
                  <select name="reason" defaultValue="SOLD">
                    {exitReasons.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="danger-action" disabled={pending}>
                  Retirar copia
                </button>
              </form>
            </div>
          ) : null}
        </dialog>
      ) : null}
    </section>
  );
}
