"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type {
  CollectionDetail,
  Collection,
  Copy,
  CopyDetail,
  CopyListItem,
  GameDetail,
  GameSummary,
} from "@ludoteca/contracts";

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
import { getGame, listGames } from "../../lib/api/games";

type CopyCondition = Copy["condition"];
type LoadState = "loading" | "ready" | "error";
type Message = { kind: "success" | "error"; text: string };

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

export function CopyInventoryWorkspace({
  collection,
  onGameCountChange,
}: {
  collection: CollectionDetail;
  onGameCountChange?: (difference: number) => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [copies, setCopies] = useState<CopyListItem[]>([]);
  const [selected, setSelected] = useState<CopyDetail | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
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
  const [minPlayers, setMinPlayers] = useState<number | undefined>();
  const [maxPlayers, setMaxPlayers] = useState<number | undefined>();
  const [draftQuery, setDraftQuery] = useState("");
  const [draftMechanic, setDraftMechanic] = useState("");
  const [draftMinPlayers, setDraftMinPlayers] = useState("");
  const [draftMaxPlayers, setDraftMaxPlayers] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);

  const canManage = collection.canEdit && collection.status === "ACTIVE";

  useEffect(() => {
    let active = true;
    void listCopies(collection.id, {
      lifecycle,
      q: query || undefined,
      mechanic: mechanic || undefined,
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

  async function refreshSelected(copyId: string) {
    try {
      const response = await getCopy(copyId);
      setSelected(response.copy);
    } catch {
      setSelected(null);
    }
    setReload((value) => value + 1);
  }

  async function handleSelect(copyId: string) {
    setPending(true);
    setMessage(null);
    try {
      setSelected((await getCopy(copyId)).copy);
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
      const response = await createCopy(collection.id, {
        gameId: String(form.get("gameId") ?? ""),
        gameEditionId: String(form.get("gameEditionId") ?? "") || null,
        condition: String(form.get("condition")) as CopyCondition,
        alias: String(form.get("alias") ?? "").trim() || null,
        notes: String(form.get("notes") ?? "").trim() || null,
      });
      formElement.reset();
      setSelectedGame(null);
      setShowCreate(false);
      setMessage({ kind: "success", text: "La copia quedó registrada." });
      onGameCountChange?.(1);
      setReload((value) => value + 1);
      await handleSelect(response.copy.id);
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
      const response = await updateCopy(selected.id, {
        alias: String(form.get("alias") ?? "").trim() || null,
        notes: String(form.get("notes") ?? "").trim() || null,
        condition: String(form.get("condition")) as CopyCondition,
      });
      setSelected(response.copy);
      setMessage({ kind: "success", text: "La copia quedó actualizada." });
      setReload((value) => value + 1);
    } catch (error) {
      await handleMutationFailure(error, selected.id);
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
              disabled={selectedGame === null}
            >
              <option value="">Sin edición específica</option>
              {selectedGame?.editions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {editionLabel(edition)}
                </option>
              ))}
            </select>
          </label>
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
              Alias
              <input name="alias" maxLength={140} />
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

      {message ? (
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
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "No hay coincidencias"
              : "Aún no hay copias"}
          </h3>
          <p>
            {query ||
            mechanic ||
            minPlayers !== undefined ||
            maxPlayers !== undefined
              ? "Prueba ampliando el rango o quitando alguno de los filtros."
              : "Registra el primer ejemplar físico de esta ludoteca."}
          </p>
        </div>
      ) : null}

      {copies.length > 0 ? (
        <div className="copy-grid">
          {copies.map((copy) => (
            <button
              key={copy.id}
              className="copy-card"
              type="button"
              onClick={() => void handleSelect(copy.id)}
              aria-pressed={selected?.id === copy.id}
            >
              <strong>{copy.alias ?? copy.game.name}</strong>
              <span>{copy.game.name}</span>
              <small>
                {copy.game.minPlayers === copy.game.maxPlayers
                  ? `${copy.game.minPlayers} jugadores`
                  : `${copy.game.minPlayers}–${copy.game.maxPlayers} jugadores`}
              </small>
              {copy.game.mechanics.length > 0 ? (
                <span className="copy-mechanics">
                  {copy.game.mechanics.join(" · ")}
                </span>
              ) : null}
              <small>
                {conditionLabel(copy.condition)} ·{" "}
                {copy.lifecycle === "ACTIVE" ? "Activa" : "Retirada"}
              </small>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <article className="copy-detail" aria-label="Detalle de la copia">
          <header>
            <div>
              <div className="eyebrow">Detalle de copia</div>
              <h3>{selected.alias ?? selected.game.name}</h3>
            </div>
            <span className="status-pill">
              {selected.lifecycle === "ACTIVE" ? "Activa" : "Retirada"}
            </span>
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
                  ? editionLabel(selected.edition)
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
          {selected.lifecycle === "EXITED" ? (
            <p className="read-only-note">
              Esta copia fue retirada por <strong>{selected.exitReason}</strong>
              . Su historial y sus {selected.acquisitions.length}{" "}
              adquisición(es) siguen disponibles.
            </p>
          ) : null}

          {canManage &&
          selected.lifecycle === "ACTIVE" &&
          selected.currentCollectionId === collection.id ? (
            <div className="copy-actions">
              <form className="stack-form" onSubmit={handleUpdate}>
                <h4>Editar copia</h4>
                <label>
                  Alias
                  <input
                    name="alias"
                    maxLength={140}
                    defaultValue={selected.alias ?? ""}
                  />
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
        </article>
      ) : null}
    </section>
  );
}
