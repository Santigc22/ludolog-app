"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CopyDetail,
  CurrentSessionResponse,
  GameDetail,
  GameSummary,
  Match,
  MatchOutcome,
  MatchStatus,
} from "@ludoteca/contracts";

import { ManagedImage } from "../media/managed-image";
import { ApiRequestError } from "../../lib/api/client";
import { getCurrentSession } from "../../lib/api/auth";
import { getCopy } from "../../lib/api/copies";
import { getGame, listGames } from "../../lib/api/games";
import { createMatch, listMatches, updateMatch } from "../../lib/api/matches";

type LoadState = "loading" | "ready" | "anonymous" | "error";
type ParticipantDraft = {
  key: number;
  userId: string | null;
  guestName: string;
  displayName: string;
  outcome: MatchOutcome;
  score: string;
};
type Message = { kind: "success" | "error"; text: string };

const outcomeOptions: ReadonlyArray<[MatchOutcome, string]> = [
  ["NO_RESULT", "Sin resultado"],
  ["WIN", "Victoria"],
  ["LOSS", "Derrota"],
  ["DRAW", "Empate"],
];

const statusLabels: Record<MatchStatus, string> = {
  PLANNED: "Planeada",
  COMPLETED: "Completada",
  INCOMPLETE: "Inconclusa",
  CANCELLED: "Cancelada",
};

const visibilityLabels = {
  PRIVATE: "Privada",
  PUBLIC: "Pública",
} as const;

const cardParticipantLimit = 3;

function localDateTime(isoDate = new Date().toISOString()) {
  const date = new Date(isoDate);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function plannedLocalDateTime(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!, 18, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${value}T18:00`;
}

function localDayRange(value: string): {
  startedFrom?: string;
  startedBefore?: string;
} {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return {};
  const start = new Date(year, month - 1, day);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return {};
  }
  const end = new Date(year, month - 1, day + 1);
  return {
    startedFrom: start.toISOString(),
    startedBefore: end.toISOString(),
  };
}

function participantFromSession(
  session: CurrentSessionResponse,
  key: number,
): ParticipantDraft {
  return {
    key,
    userId: session.user.id,
    guestName: "",
    displayName: session.user.profile.displayName ?? session.user.username,
    outcome: "NO_RESULT",
    score: "",
  };
}

function guestParticipant(key: number): ParticipantDraft {
  return {
    key,
    userId: null,
    guestName: "",
    displayName: "Invitado",
    outcome: "NO_RESULT",
    score: "",
  };
}

function editionLabel(edition: GameDetail["editions"][number]) {
  return (
    edition.editionName ??
    edition.editionNumber ??
    edition.languageCode ??
    `Edición ${edition.id.slice(0, 8)}`
  );
}

function matchEditionLabel(match: Match) {
  return match.edition?.name ?? "Sin edición específica";
}

function outcomeLabel(outcome: MatchOutcome) {
  return outcomeOptions.find(([code]) => code === outcome)?.[1];
}

function outcomeClassName(outcome: MatchOutcome) {
  return `match-outcome match-outcome-${outcome.toLowerCase().replace("_", "-")}`;
}

export function MatchWorkspace({
  initialGameId,
  initialEditionId,
  initialCopyId,
  initialHistoryGameId,
  initialPlannedDate,
}: {
  initialGameId?: string | undefined;
  initialEditionId?: string | undefined;
  initialCopyId?: string | undefined;
  initialHistoryGameId?: string | undefined;
  initialPlannedDate?: string | undefined;
}) {
  const initialPlanningDateTime = plannedLocalDateTime(initialPlannedDate);
  const keySequence = useRef(1);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [session, setSession] = useState<CurrentSessionResponse | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(initialGameId ?? "");
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState(
    initialEditionId ?? "",
  );
  const [sourceCopy, setSourceCopy] = useState<CopyDetail | null>(null);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [status, setStatus] = useState<MatchStatus>(
    initialPlanningDateTime ? "PLANNED" : "COMPLETED",
  );
  const [showForm, setShowForm] = useState(
    initialGameId !== undefined ||
      initialCopyId !== undefined ||
      initialPlanningDateTime !== null,
  );
  const [editing, setEditing] = useState<Match | null>(null);
  const [completingPlanned, setCompletingPlanned] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [reload, setReload] = useState(0);
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [gameFilter, setGameFilter] = useState(initialHistoryGameId ?? "");
  const [fetchedHistoryGameName, setFetchedHistoryGameName] = useState<
    string | null
  >(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);

  const playerRange = selectedGame
    ? selectedGame.minPlayers === selectedGame.maxPlayers
      ? `${selectedGame.minPlayers} participantes`
      : `${selectedGame.minPlayers}–${selectedGame.maxPlayers} participantes`
    : null;

  const activeGameSummary = useMemo(
    () => games.find(({ id }) => id === selectedGameId) ?? null,
    [games, selectedGameId],
  );
  const listedHistoryGameName = useMemo(
    () => games.find(({ id }) => id === gameFilter)?.name ?? null,
    [gameFilter, games],
  );
  const historyGameName = gameFilter
    ? (listedHistoryGameName ?? fetchedHistoryGameName)
    : null;

  useEffect(() => {
    let active = true;
    void getCurrentSession()
      .then((response) => {
        if (!active) return;
        setSession(response);
        setParticipants([
          participantFromSession(response, keySequence.current++),
        ]);
        setLoadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setLoadState(
          error instanceof ApiRequestError && error.status === 401
            ? "anonymous"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loadState !== "ready") return;
    let active = true;
    void Promise.all([
      listMatches({
        page,
        pageSize: 12,
        gameId: gameFilter || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        ...localDayRange(dateFilter),
      }),
      listGames({ page: 1, pageSize: 100, sort: "name" }),
    ])
      .then(([matchResponse, gameResponse]) => {
        if (!active) return;
        setMatches(matchResponse.matches);
        setTotalPages(matchResponse.pagination.totalPages);
        setGames(gameResponse.games);
      })
      .catch(() => {
        if (active) {
          setMessage({
            kind: "error",
            text: "No pudimos cargar tus partidas.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [dateFilter, gameFilter, loadState, page, reload, statusFilter]);

  useEffect(() => {
    if (!gameFilter || listedHistoryGameName || loadState !== "ready") return;
    let active = true;
    void getGame(gameFilter)
      .then(({ game }) => {
        if (active) setFetchedHistoryGameName(game.name);
      })
      .catch(() => {
        if (active) setFetchedHistoryGameName("Juego seleccionado");
      });
    return () => {
      active = false;
    };
  }, [gameFilter, listedHistoryGameName, loadState]);

  useEffect(() => {
    if (!selectedGameId || loadState !== "ready") return;
    let active = true;
    void getGame(selectedGameId)
      .then(({ game }) => {
        if (active) setSelectedGame(game);
      })
      .catch(() => {
        if (active) {
          setSelectedGame(null);
          setMessage({ kind: "error", text: "No pudimos abrir ese juego." });
        }
      });
    return () => {
      active = false;
    };
  }, [loadState, selectedGameId]);

  useEffect(() => {
    if (!initialCopyId || loadState !== "ready") return;
    let active = true;
    void getCopy(initialCopyId)
      .then(({ copy }) => {
        if (!active) return;
        setSourceCopy(copy);
        setSelectedGameId(copy.game.id);
        setSelectedEditionId(copy.gameEditionId ?? "");
      })
      .catch(() => {
        if (active) {
          setMessage({
            kind: "error",
            text: "No pudimos vincular la copia seleccionada.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [initialCopyId, loadState]);

  useEffect(() => {
    const dialog = detailDialog.current;
    if (!detailMatch || !dialog || dialog.open) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }, [detailMatch]);

  function closeDetail() {
    const dialog = detailDialog.current;
    if (dialog?.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute("open");
      }
    }
    setDetailMatch(null);
  }

  function clearHistoryGameFilter() {
    setGameFilter("");
    setFetchedHistoryGameName(null);
    setPage(1);
    const url = new URL(window.location.href);
    url.searchParams.delete("historyGameId");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  function resetForm({
    preserveInitialContext = true,
  }: { preserveInitialContext?: boolean } = {}) {
    const nextGameId = preserveInitialContext
      ? (initialGameId ?? sourceCopy?.game.id ?? "")
      : "";
    setEditing(null);
    setCompletingPlanned(false);
    setStatus("COMPLETED");
    setSelectedGameId(nextGameId);
    if (!nextGameId) setSelectedGame(null);
    setSelectedEditionId(
      preserveInitialContext
        ? (initialEditionId ?? sourceCopy?.gameEditionId ?? "")
        : "",
    );
    if (!preserveInitialContext) setSourceCopy(null);
    if (session) {
      setParticipants([participantFromSession(session, keySequence.current++)]);
    }
  }

  function addGuest() {
    setParticipants((current) => [
      ...current,
      guestParticipant(keySequence.current++),
    ]);
  }

  function completeParticipantsToMaximum() {
    if (!selectedGame) return;
    const missing = Math.max(0, selectedGame.maxPlayers - participants.length);
    if (missing === 0) return;
    const guests = Array.from({ length: missing }, () =>
      guestParticipant(keySequence.current++),
    );
    setParticipants((current) => {
      const remaining = Math.max(0, selectedGame.maxPlayers - current.length);
      return [...current, ...guests.slice(0, remaining)];
    });
  }

  function updateParticipant(key: number, patch: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.key === key ? { ...participant, ...patch } : participant,
      ),
    );
  }

  function beginEdit(
    match: Match,
    { registerResult = false }: { registerResult?: boolean } = {},
  ) {
    closeDetail();
    setEditing(match);
    setCompletingPlanned(registerResult);
    setShowForm(true);
    setMessage(null);
    setSelectedGameId(match.game.id);
    setSelectedEditionId(match.edition?.id ?? "");
    setSourceCopy(null);
    setStatus(registerResult ? "COMPLETED" : match.status);
    setParticipants(
      match.participants.map((participant) => ({
        key: keySequence.current++,
        userId: participant.userId,
        guestName: participant.guestName ?? "",
        displayName: participant.displayName,
        outcome: participant.outcome,
        score: participant.score?.toString() ?? "",
      })),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGame || participants.length === 0) return;
    const form = new FormData(event.currentTarget);
    const normalizedParticipants = participants.map((participant) => ({
      userId: participant.userId,
      guestName:
        participant.userId === null ? participant.guestName.trim() : null,
      outcome: status === "COMPLETED" ? participant.outcome : "NO_RESULT",
      score:
        status === "PLANNED"
          ? null
          : participant.score.trim()
            ? Number(participant.score)
            : null,
    }));
    const common = {
      status,
      visibility: String(form.get("visibility")) as "PRIVATE" | "PUBLIC",
      startedAt: new Date(String(form.get("startedAt"))).toISOString(),
      durationMinutes: String(form.get("durationMinutes")).trim()
        ? Number(form.get("durationMinutes"))
        : null,
      location: String(form.get("location")).trim() || null,
      notes: String(form.get("notes")).trim() || null,
      participants: normalizedParticipants,
    };

    setPending(true);
    setMessage(null);
    try {
      if (editing) {
        await updateMatch(editing.id, common);
        setMessage({
          kind: "success",
          text: completingPlanned
            ? "El resultado quedó registrado."
            : "La partida quedó actualizada.",
        });
      } else {
        await createMatch({
          gameId: selectedGame.id,
          gameEditionId: selectedEditionId || null,
          copyId: sourceCopy?.id ?? null,
          ...common,
        });
        setMessage({
          kind: "success",
          text:
            status === "PLANNED"
              ? "La partida quedó planeada."
              : "La partida quedó registrada.",
        });
      }
      setShowForm(false);
      resetForm({ preserveInitialContext: false });
      setReload((value) => value + 1);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === "MATCH_PARTICIPANT_RANGE_INVALID"
      ) {
        setMessage({
          kind: "error",
          text: `Este juego requiere ${playerRange ?? "otra cantidad de participantes"}.`,
        });
      } else {
        setMessage({
          kind: "error",
          text: "No pudimos guardar la partida. Revisa los datos.",
        });
      }
    } finally {
      setPending(false);
    }
  }

  async function cancelMatch(match: Match) {
    if (!window.confirm("¿Quieres marcar esta partida como cancelada?")) return;
    setPending(true);
    try {
      await updateMatch(match.id, {
        status: "CANCELLED",
        participants: match.participants.map((participant) => ({
          userId: participant.userId,
          guestName: participant.guestName,
          outcome: "NO_RESULT",
          score: participant.score,
        })),
      });
      setMessage({ kind: "success", text: "La partida quedó cancelada." });
      setReload((value) => value + 1);
    } catch {
      setMessage({ kind: "error", text: "No pudimos cancelar la partida." });
    } finally {
      setPending(false);
    }
  }

  if (loadState === "loading") {
    return <p aria-busy="true">Cargando tus partidas…</p>;
  }
  if (loadState === "anonymous") {
    return (
      <section className="collection-state centered-card">
        <div className="eyebrow">Historial personal</div>
        <h1>Inicia sesión para registrar partidas</h1>
        <p className="lead">
          Podrás guardar lo que jugaste, incluso si el juego no pertenece a una
          de tus ludotecas.
        </p>
        <Link className="primary-action link-action" href="/acceso">
          Iniciar sesión
        </Link>
      </section>
    );
  }
  if (loadState === "error" || session === null) {
    return <p className="error-message">No pudimos abrir tus partidas.</p>;
  }

  return (
    <section className="match-workspace" aria-labelledby="matches-title">
      <header className="collection-heading">
        <div>
          <div className="eyebrow">Tu mesa, tu historial</div>
          <h1 id="matches-title">Partidas</h1>
          <p className="lead">
            Registra sesiones jugadas con tus copias o con juegos que conociste
            fuera de casa.
          </p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((visible) => !visible);
            setMessage(null);
          }}
        >
          {showForm ? "Cerrar formulario" : "Registrar partida"}
        </button>
      </header>

      {showForm ? (
        <form className="match-form stack-form" onSubmit={handleSubmit}>
          <div>
            <div className="eyebrow">
              {completingPlanned
                ? "Completar partida planeada"
                : editing
                  ? "Editar historial"
                  : status === "PLANNED"
                    ? "Nueva planificación"
                    : "Nueva sesión"}
            </div>
            <h2>
              {completingPlanned
                ? `Registrar resultado de ${editing?.game.name ?? "la partida"}`
                : editing
                  ? `Editar ${editing.game.name}`
                  : status === "PLANNED"
                    ? "Planear partida"
                    : "Registrar partida"}
            </h2>
          </div>

          <label>
            Juego
            <select
              value={selectedGameId}
              disabled={editing !== null || sourceCopy !== null}
              required
              onChange={(event) => {
                setSelectedGameId(event.target.value);
                setSelectedGame(null);
                setSelectedEditionId("");
              }}
            >
              <option value="" disabled>
                Selecciona un juego
              </option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
              {activeGameSummary === null && selectedGame ? (
                <option value={selectedGame.id}>{selectedGame.name}</option>
              ) : null}
            </select>
            {sourceCopy ? (
              <small>
                Vinculada a la copia{" "}
                {sourceCopy.alias ? `“${sourceCopy.alias}”` : "seleccionada"}
                {sourceCopy.currentCollectionId ? " de tu ludoteca" : ""}.
              </small>
            ) : (
              <small>
                No necesitas tener una copia para registrar la partida.
              </small>
            )}
          </label>

          {selectedGame ? (
            <label>
              Edición utilizada (opcional)
              <select
                value={selectedEditionId}
                disabled={editing !== null || sourceCopy !== null}
                onChange={(event) => setSelectedEditionId(event.target.value)}
              >
                <option value="">Sin edición específica</option>
                {selectedGame.editions.map((edition) => (
                  <option key={edition.id} value={edition.id}>
                    {editionLabel(edition)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="field-grid">
            <label>
              Fecha y hora
              <input
                name="startedAt"
                type="datetime-local"
                required
                defaultValue={
                  editing
                    ? localDateTime(editing.startedAt)
                    : (initialPlanningDateTime ?? localDateTime())
                }
                key={editing?.id ?? initialPlanningDateTime ?? "new-date"}
              />
            </label>
            <label>
              Duración (minutos)
              <input
                name="durationMinutes"
                type="number"
                min={0}
                defaultValue={editing?.durationMinutes ?? ""}
                key={editing?.id ?? "new-duration"}
              />
            </label>
            <label>
              Estado
              <select
                name="status"
                value={status}
                disabled={completingPlanned}
                onChange={(event) => {
                  const next = event.target.value as MatchStatus;
                  setStatus(next);
                  if (next !== "COMPLETED") {
                    setParticipants((current) =>
                      current.map((participant) => ({
                        ...participant,
                        outcome: "NO_RESULT",
                        score: next === "PLANNED" ? "" : participant.score,
                      })),
                    );
                  }
                }}
              >
                <option value="PLANNED">Planeada</option>
                <option value="COMPLETED">Completada</option>
                <option value="INCOMPLETE">Inconclusa</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
              {completingPlanned ? (
                <small>Al guardar, la partida quedará como completada.</small>
              ) : null}
            </label>
            <label>
              Visibilidad
              <select
                name="visibility"
                defaultValue={editing?.visibility ?? "PRIVATE"}
                key={editing?.id ?? "new-visibility"}
              >
                <option value="PRIVATE">Privada</option>
                <option value="PUBLIC">Pública</option>
              </select>
            </label>
          </div>
          <label>
            Lugar (opcional)
            <input
              name="location"
              maxLength={220}
              defaultValue={editing?.location ?? ""}
              key={editing?.id ?? "new-location"}
              placeholder="Ej. Casa, tienda o evento"
            />
          </label>
          <label>
            Notas (opcional)
            <textarea
              name="notes"
              maxLength={2000}
              rows={3}
              defaultValue={editing?.notes ?? ""}
              key={editing?.id ?? "new-notes"}
            />
          </label>

          <fieldset className="participant-fieldset">
            <legend>Participantes</legend>
            <p>
              {playerRange
                ? `${selectedGame?.name} admite ${playerRange}.`
                : "Selecciona un juego para validar la cantidad."}
            </p>
            <div className="participant-list">
              {participants.map((participant, index) => (
                <div className="participant-row" key={participant.key}>
                  <span className="participant-seat">{index + 1}</span>
                  {participant.userId ? (
                    <label>
                      Participante
                      <input value={participant.displayName} disabled />
                    </label>
                  ) : (
                    <label>
                      Nombre del invitado
                      <input
                        value={participant.guestName}
                        maxLength={160}
                        required
                        onChange={(event) =>
                          updateParticipant(participant.key, {
                            guestName: event.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                  <label>
                    Resultado
                    <select
                      value={participant.outcome}
                      disabled={status !== "COMPLETED"}
                      onChange={(event) =>
                        updateParticipant(participant.key, {
                          outcome: event.target.value as MatchOutcome,
                        })
                      }
                    >
                      {outcomeOptions.map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Puntuación
                    <input
                      type="number"
                      step="0.0001"
                      disabled={status === "PLANNED"}
                      value={participant.score}
                      onChange={(event) =>
                        updateParticipant(participant.key, {
                          score: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="text-filter-action"
                    type="button"
                    disabled={participants.length === 1}
                    onClick={() =>
                      setParticipants((current) =>
                        current.filter(({ key }) => key !== participant.key),
                      )
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <div className="participant-add-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={addGuest}
              >
                Añadir invitado
              </button>
              {selectedGame &&
              selectedGame.maxPlayers - participants.length > 1 ? (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={completeParticipantsToMaximum}
                >
                  Completar hasta {selectedGame.maxPlayers} participantes
                </button>
              ) : null}
            </div>
          </fieldset>

          <div className="match-form-actions">
            <button
              className="primary-action"
              disabled={pending || !selectedGame}
            >
              {pending
                ? "Guardando…"
                : completingPlanned
                  ? "Guardar resultado"
                  : editing
                    ? "Guardar cambios"
                    : status === "PLANNED"
                      ? "Guardar planificación"
                      : "Registrar partida"}
            </button>
            {editing ? (
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancelar edición
              </button>
            ) : null}
          </div>
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

      <div className="match-history-heading">
        <div>
          <div className="eyebrow">Registro personal</div>
          <h2>
            {gameFilter
              ? `Historial de ${historyGameName ?? "este juego"}`
              : "Historial de partidas"}
          </h2>
        </div>
        <div className="match-history-filters">
          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as MatchStatus | "ALL");
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              <option value="PLANNED">Planeadas</option>
              <option value="COMPLETED">Completadas</option>
              <option value="INCOMPLETE">Inconclusas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {dateFilter ? (
            <button
              className="text-filter-action"
              type="button"
              onClick={() => {
                setDateFilter("");
                setPage(1);
              }}
            >
              Limpiar fecha
            </button>
          ) : null}
        </div>
      </div>

      {gameFilter ? (
        <div className="match-game-filter-context" aria-live="polite">
          <p>
            Mostrando únicamente las partidas de{" "}
            <strong>{historyGameName ?? "este juego"}</strong>.
          </p>
          <button
            className="text-filter-action"
            type="button"
            onClick={clearHistoryGameFilter}
          >
            Ver todas las partidas
          </button>
        </div>
      ) : null}

      {matches.length === 0 ? (
        <div className="collection-empty compact-empty">
          <h2>Aún no hay partidas en este filtro</h2>
          <p>Registra la primera sesión para comenzar tu historial.</p>
        </div>
      ) : (
        <div className="match-grid">
          {matches.map((match) => (
            <article className="match-card" key={match.id}>
              <div className="match-card-cover">
                {match.game.coverMediaId ? (
                  <ManagedImage
                    mediaId={match.game.coverMediaId}
                    variant="thumbnail"
                    alt={`Portada de ${match.game.name}`}
                    width={240}
                    height={300}
                  />
                ) : (
                  <span>Sin portada</span>
                )}
              </div>
              <div className="match-card-body">
                <div className="match-card-top">
                  <span
                    className={`match-status match-status-${match.status.toLowerCase()}`}
                  >
                    {statusLabels[match.status]}
                  </span>
                  <time dateTime={match.startedAt}>
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(match.startedAt))}
                  </time>
                </div>
                <h3>
                  <Link
                    className="match-game-link"
                    href={`/catalogo/${encodeURIComponent(match.game.id)}`}
                  >
                    {match.game.name}
                  </Link>
                </h3>
                <p>{matchEditionLabel(match)}</p>
                {match.copy ? (
                  <p>
                    Copia: {match.copy.alias ?? "sin alias"}
                    {match.collection ? ` · ${match.collection.name}` : ""}
                  </p>
                ) : (
                  <p>Partida sin copia vinculada</p>
                )}
                <dl className="match-card-facts">
                  <div>
                    <dt>Jugadores</dt>
                    <dd>{match.participants.length}</dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>
                      {match.durationMinutes === null
                        ? "Sin registrar"
                        : `${match.durationMinutes} min`}
                    </dd>
                  </div>
                  <div>
                    <dt>Lugar</dt>
                    <dd>{match.location ?? "Sin registrar"}</dd>
                  </div>
                </dl>
                <ul className="match-participant-summary">
                  {match.participants
                    .slice(0, cardParticipantLimit)
                    .map((participant) => (
                      <li key={participant.id}>
                        <span>{participant.displayName}</span>
                        <strong
                          className={outcomeClassName(participant.outcome)}
                        >
                          {outcomeLabel(participant.outcome)}
                          {participant.score === null
                            ? ""
                            : ` · ${participant.score}`}
                        </strong>
                      </li>
                    ))}
                  {match.participants.length > cardParticipantLimit ? (
                    <li className="match-participant-overflow">
                      <span>
                        +{match.participants.length - cardParticipantLimit}{" "}
                        {match.participants.length - cardParticipantLimit === 1
                          ? "jugador más"
                          : "jugadores más"}
                      </span>
                    </li>
                  ) : null}
                </ul>
                {match.notes ? (
                  <p className="match-notes">{match.notes}</p>
                ) : null}
                <div className="match-card-actions">
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => setDetailMatch(match)}
                  >
                    Ver detalle
                  </button>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => beginEdit(match)}
                  >
                    {match.status === "PLANNED"
                      ? "Editar planificación"
                      : "Editar"}
                  </button>
                  {match.status === "PLANNED" ? (
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => beginEdit(match, { registerResult: true })}
                    >
                      Registrar resultado
                    </button>
                  ) : null}
                  {match.status !== "CANCELLED" ? (
                    <button
                      className="danger-action"
                      type="button"
                      disabled={pending}
                      onClick={() => void cancelMatch(match)}
                    >
                      Cancelar partida
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="pagination-actions">
          <button
            className="secondary-action"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="secondary-action"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </button>
        </div>
      ) : null}

      {detailMatch ? (
        <dialog
          ref={detailDialog}
          className="match-detail-dialog"
          aria-labelledby={`match-detail-title-${detailMatch.id}`}
          onCancel={(event) => {
            event.preventDefault();
            closeDetail();
          }}
          onClose={() => setDetailMatch(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <div className="match-detail-content">
            <header className="match-detail-header">
              <div>
                <div className="eyebrow">Detalle de la partida</div>
                <h2 id={`match-detail-title-${detailMatch.id}`}>
                  {detailMatch.game.name}
                </h2>
                <p>{matchEditionLabel(detailMatch)}</p>
                <Link
                  className="match-game-detail-link"
                  href={`/catalogo/${encodeURIComponent(detailMatch.game.id)}`}
                >
                  Ver detalle del juego →
                </Link>
              </div>
              <button
                className="match-detail-close"
                type="button"
                aria-label={`Cerrar detalle de ${detailMatch.game.name}`}
                onClick={closeDetail}
                autoFocus
              >
                ×
              </button>
            </header>

            <dl className="match-detail-facts">
              <div>
                <dt>Estado</dt>
                <dd>{statusLabels[detailMatch.status]}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>
                  <time dateTime={detailMatch.startedAt}>
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(detailMatch.startedAt))}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Duración</dt>
                <dd>
                  {detailMatch.durationMinutes === null
                    ? "Sin registrar"
                    : `${detailMatch.durationMinutes} min`}
                </dd>
              </div>
              <div>
                <dt>Lugar</dt>
                <dd>{detailMatch.location ?? "Sin registrar"}</dd>
              </div>
              <div>
                <dt>Visibilidad</dt>
                <dd>{visibilityLabels[detailMatch.visibility]}</dd>
              </div>
              <div>
                <dt>Copia</dt>
                <dd>
                  {detailMatch.copy
                    ? `${detailMatch.copy.alias ?? "Sin alias"}${
                        detailMatch.collection
                          ? ` · ${detailMatch.collection.name}`
                          : ""
                      }`
                    : "Sin copia vinculada"}
                </dd>
              </div>
            </dl>

            <section
              className="match-detail-participants"
              aria-labelledby={`match-detail-participants-${detailMatch.id}`}
            >
              <h3 id={`match-detail-participants-${detailMatch.id}`}>
                Participantes ({detailMatch.participants.length})
              </h3>
              <ul className="match-participant-summary">
                {detailMatch.participants.map((participant) => (
                  <li key={participant.id}>
                    <span>{participant.displayName}</span>
                    <strong className={outcomeClassName(participant.outcome)}>
                      {outcomeLabel(participant.outcome)}
                      {participant.score === null
                        ? ""
                        : ` · ${participant.score}`}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>

            <section className="match-detail-notes">
              <h3>Notas</h3>
              <p>{detailMatch.notes ?? "Sin notas registradas."}</p>
            </section>

            <div className="match-detail-actions">
              {detailMatch.status === "PLANNED" ? (
                <>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => beginEdit(detailMatch)}
                  >
                    Editar planificación
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() =>
                      beginEdit(detailMatch, { registerResult: true })
                    }
                  >
                    Registrar resultado
                  </button>
                </>
              ) : null}
              <button
                className={
                  detailMatch.status === "PLANNED"
                    ? "secondary-action"
                    : "primary-action"
                }
                type="button"
                onClick={closeDetail}
              >
                Cerrar
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
