"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Match, MatchOutcome, MatchStatus } from "@ludoteca/contracts";

import { getCurrentSession } from "../../lib/api/auth";
import { ApiRequestError } from "../../lib/api/client";
import { listMatches } from "../../lib/api/matches";

type CalendarView = "month" | "week" | "day";
type LoadState = "loading" | "ready" | "anonymous" | "error";

const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const statusLabels: Record<MatchStatus, string> = {
  PLANNED: "Planeada",
  COMPLETED: "Completada",
  INCOMPLETE: "Inconclusa",
  CANCELLED: "Cancelada",
};
const outcomeLabels: Record<MatchOutcome, string> = {
  WIN: "Victoria",
  LOSS: "Derrota",
  DRAW: "Empate",
  NO_RESULT: "Sin resultado",
};
const visibilityLabels = {
  PRIVATE: "Privada",
  PUBLIC: "Pública",
} as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function startOfWeek(date: Date) {
  const day = startOfDay(date);
  const mondayOffset = (day.getDay() + 6) % 7;
  return addDays(day, -mondayOffset);
}

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function matchesDate(match: Match) {
  return dateKey(new Date(match.startedAt));
}

function visibleRange(view: CalendarView, anchor: Date) {
  if (view === "day") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1), days: [start] };
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    return {
      start,
      end: addDays(start, 7),
      days: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
    };
  }
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(firstDay);
  return {
    start,
    end: addDays(start, 42),
    days: Array.from({ length: 42 }, (_, index) => addDays(start, index)),
  };
}

function periodLabel(view: CalendarView, anchor: Date) {
  if (view === "month") {
    return new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(anchor);
  }
  if (view === "day") {
    return new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(anchor);
  }
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const startLabel = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: start.getMonth() === end.getMonth() ? undefined : "short",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function eventTime(match: Match) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(match.startedAt));
}

function fullDateTime(match: Match) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(match.startedAt));
}

function editionLabel(match: Match) {
  return match.edition?.name ?? "Sin edición específica";
}

async function loadAllMatches(start: Date, end: Date) {
  const matches: Match[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await listMatches({
      page,
      pageSize: 100,
      startedFrom: start.toISOString(),
      startedBefore: end.toISOString(),
    });
    matches.push(...response.matches);
    totalPages = response.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);
  return matches.sort(
    (left, right) =>
      new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
  );
}

export function GameCalendarWorkspace() {
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [matches, setMatches] = useState<Match[]>([]);
  const [statusFilters, setStatusFilters] = useState<MatchStatus[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const range = useMemo(() => visibleRange(view, anchor), [anchor, view]);
  const filteredMatches = useMemo(
    () =>
      statusFilters.length === 0
        ? matches
        : matches.filter((match) => statusFilters.includes(match.status)),
    [matches, statusFilters],
  );
  const matchesByDate = useMemo(() => {
    const grouped = new Map<string, Match[]>();
    for (const match of filteredMatches) {
      const key = matchesDate(match);
      grouped.set(key, [...(grouped.get(key) ?? []), match]);
    }
    return grouped;
  }, [filteredMatches]);

  useEffect(() => {
    let active = true;
    void getCurrentSession()
      .then(() => {
        if (active) setLoadState("ready");
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
    void loadAllMatches(range.start, range.end)
      .then((response) => {
        if (active) setMatches(response);
      })
      .catch(() => {
        if (active) {
          setMatches([]);
          setMessage("No pudimos cargar las partidas de este periodo.");
        }
      })
      .finally(() => {
        if (active) setCalendarLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadState, range.end, range.start]);

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

  function changePeriod(direction: -1 | 1) {
    setCalendarLoading(true);
    setMessage(null);
    if (view === "month") {
      setAnchor(
        new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1),
      );
      return;
    }
    setAnchor(addDays(anchor, direction * (view === "week" ? 7 : 1)));
  }

  function openDay(date: Date) {
    setCalendarLoading(true);
    setMessage(null);
    setAnchor(startOfDay(date));
    setView("day");
  }

  function changeView(nextView: CalendarView) {
    if (nextView === view) return;
    setCalendarLoading(true);
    setMessage(null);
    setView(nextView);
  }

  function goToToday() {
    setCalendarLoading(true);
    setMessage(null);
    setAnchor(startOfDay(new Date()));
  }

  function toggleStatusFilter(status: MatchStatus) {
    setStatusFilters((current) => {
      if (current.includes(status)) {
        return current.filter((value) => value !== status);
      }
      const next = [...current, status];
      return next.length === Object.keys(statusLabels).length ? [] : next;
    });
  }

  if (loadState === "loading") {
    return <p aria-busy="true">Cargando tu calendario…</p>;
  }
  if (loadState === "anonymous") {
    return (
      <section className="collection-state centered-card">
        <div className="eyebrow">Agenda personal</div>
        <h1>Inicia sesión para abrir tu calendario</h1>
        <p className="lead">
          Consulta lo que jugaste y organiza tus próximas partidas desde un
          mismo lugar.
        </p>
        <Link className="primary-action link-action" href="/acceso">
          Iniciar sesión
        </Link>
      </section>
    );
  }
  if (loadState === "error") {
    return <p className="error-message">No pudimos abrir tu calendario.</p>;
  }

  const todayKey = dateKey(new Date());

  return (
    <section className="game-calendar" aria-labelledby="calendar-title">
      <header className="collection-heading game-calendar-heading">
        <div>
          <div className="eyebrow">Tu agenda de mesa</div>
          <h1 id="calendar-title">Calendario de juegos</h1>
          <p className="lead">
            Recorre tu historial y organiza futuras partidas por día, semana o
            mes.
          </p>
        </div>
        <Link
          className="primary-action link-action"
          href={`/partidas?plannedDate=${dateKey(anchor)}`}
        >
          Planear partida
        </Link>
      </header>

      <div className="calendar-toolbar">
        <div className="calendar-navigation" aria-label="Navegar calendario">
          <button
            className="secondary-action calendar-arrow"
            type="button"
            aria-label="Periodo anterior"
            onClick={() => changePeriod(-1)}
          >
            ←
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={goToToday}
          >
            Hoy
          </button>
          <button
            className="secondary-action calendar-arrow"
            type="button"
            aria-label="Periodo siguiente"
            onClick={() => changePeriod(1)}
          >
            →
          </button>
        </div>
        <h2>{periodLabel(view, anchor)}</h2>
        <div className="calendar-view-switch" aria-label="Vista del calendario">
          {(
            [
              ["month", "Mes"],
              ["week", "Semana"],
              ["day", "Día"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => changeView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-legend" aria-label="Filtrar partidas por estado">
        {(Object.keys(statusLabels) as MatchStatus[]).map((status) => (
          <button
            type="button"
            aria-pressed={statusFilters.includes(status)}
            key={status}
            onClick={() => toggleStatusFilter(status)}
          >
            <i
              aria-hidden="true"
              className={`calendar-legend-dot calendar-status-${status.toLowerCase()}`}
            />
            {statusLabels[status]}
          </button>
        ))}
        {statusFilters.length > 0 ? (
          <button
            className="calendar-filter-clear"
            type="button"
            onClick={() => setStatusFilters([])}
          >
            Mostrar todas
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="error-message" role="status">
          {message}
        </p>
      ) : null}

      <div className="calendar-stage" aria-busy={calendarLoading}>
        {view === "month" ? (
          <div className="calendar-month-scroll">
            <div className="calendar-month">
              {weekDayLabels.map((day) => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              ))}
              {range.days.map((date) => {
                const key = dateKey(date);
                const dayMatches = matchesByDate.get(key) ?? [];
                const outsideMonth = date.getMonth() !== anchor.getMonth();
                return (
                  <article
                    className={`calendar-month-day${outsideMonth ? " is-outside" : ""}${key === todayKey ? " is-today" : ""}`}
                    key={key}
                  >
                    <div className="calendar-day-heading">
                      <button type="button" onClick={() => openDay(date)}>
                        <span className="sr-only">Abrir </span>
                        {date.getDate()}
                      </button>
                      <Link
                        href={`/partidas?plannedDate=${key}`}
                        aria-label={`Planear partida el ${key}`}
                      >
                        +
                      </Link>
                    </div>
                    <div className="calendar-month-events">
                      {dayMatches.slice(0, 3).map((match) => (
                        <button
                          className={`calendar-event calendar-status-${match.status.toLowerCase()}`}
                          type="button"
                          key={match.id}
                          onClick={() => setDetailMatch(match)}
                        >
                          <time>{eventTime(match)}</time>
                          <span>{match.game.name}</span>
                        </button>
                      ))}
                      {dayMatches.length > 3 ? (
                        <button
                          className="calendar-more"
                          type="button"
                          onClick={() => openDay(date)}
                        >
                          +{dayMatches.length - 3} más
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="calendar-week-scroll">
            <div className="calendar-week">
              {range.days.map((date) => {
                const key = dateKey(date);
                const dayMatches = matchesByDate.get(key) ?? [];
                return (
                  <article
                    className={`calendar-week-day${key === todayKey ? " is-today" : ""}`}
                    key={key}
                  >
                    <header>
                      <button type="button" onClick={() => openDay(date)}>
                        <span>{weekDayLabels[(date.getDay() + 6) % 7]}</span>
                        <strong>{date.getDate()}</strong>
                      </button>
                      <Link
                        href={`/partidas?plannedDate=${key}`}
                        aria-label={`Planear partida el ${key}`}
                      >
                        +
                      </Link>
                    </header>
                    <div className="calendar-week-events">
                      {dayMatches.length === 0 ? (
                        <p>Sin partidas</p>
                      ) : (
                        dayMatches.map((match) => (
                          <button
                            className={`calendar-week-event calendar-status-${match.status.toLowerCase()}`}
                            type="button"
                            key={match.id}
                            onClick={() => setDetailMatch(match)}
                          >
                            <time>{eventTime(match)}</time>
                            <strong>{match.game.name}</strong>
                            <span>
                              {statusLabels[match.status]} ·{" "}
                              {match.participants.length}{" "}
                              {match.participants.length === 1
                                ? "jugador"
                                : "jugadores"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "day" ? (
          <div className="calendar-day-view">
            <div className="calendar-day-actions">
              <p>
                {filteredMatches.length === 0
                  ? "No hay partidas para este día."
                  : `${filteredMatches.length} ${filteredMatches.length === 1 ? "partida" : "partidas"} en la agenda.`}
              </p>
              <Link
                className="secondary-action link-action"
                href={`/partidas?plannedDate=${dateKey(anchor)}`}
              >
                + Planear en este día
              </Link>
            </div>
            {filteredMatches.map((match) => (
              <article
                className={`calendar-day-event calendar-status-${match.status.toLowerCase()}`}
                key={match.id}
              >
                <div className="calendar-day-time">
                  <time dateTime={match.startedAt}>{eventTime(match)}</time>
                  <span>{statusLabels[match.status]}</span>
                </div>
                <div className="calendar-day-event-body">
                  <h3>{match.game.name}</h3>
                  <p>{editionLabel(match)}</p>
                  <dl>
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
                  {match.notes ? (
                    <p className="calendar-day-notes">{match.notes}</p>
                  ) : null}
                </div>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => setDetailMatch(match)}
                >
                  Ver detalle
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {calendarLoading ? (
          <div className="calendar-loading" role="status">
            Actualizando calendario…
          </div>
        ) : null}
      </div>

      {detailMatch ? (
        <dialog
          ref={detailDialog}
          className="match-detail-dialog"
          aria-labelledby={`calendar-detail-title-${detailMatch.id}`}
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
                <h2 id={`calendar-detail-title-${detailMatch.id}`}>
                  {detailMatch.game.name}
                </h2>
                <p>{editionLabel(detailMatch)}</p>
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
                    {fullDateTime(detailMatch)}
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

            <section className="match-detail-participants">
              <h3>Participantes ({detailMatch.participants.length})</h3>
              <ul className="match-participant-summary">
                {detailMatch.participants.map((participant) => (
                  <li key={participant.id}>
                    <span>{participant.displayName}</span>
                    <strong
                      className={`match-outcome match-outcome-${participant.outcome.toLowerCase().replace("_", "-")}`}
                    >
                      {outcomeLabels[participant.outcome]}
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

            <div className="match-detail-actions calendar-detail-actions">
              <Link
                className="secondary-action link-action"
                href={`/partidas?historyGameId=${encodeURIComponent(detailMatch.game.id)}`}
              >
                Abrir en partidas
              </Link>
              <button
                className="primary-action"
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
