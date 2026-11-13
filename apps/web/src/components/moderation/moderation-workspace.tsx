"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type {
  GameModerationCase,
  GameModerationListQuery,
} from "@ludoteca/contracts";

import { ManagedImage } from "../media/managed-image";
import { ApiRequestError } from "../../lib/api/client";
import { imageFileError, uploadGameCover } from "../../lib/api/media";
import {
  approveGameModerationCase,
  listGameModerationCases,
  rejectGameModerationCase,
} from "../../lib/api/moderation";

type LoadState = "loading" | "ready" | "forbidden" | "error";
type Message = { kind: "success" | "error"; text: string };

function statusLabel(status: GameModerationCase["status"]) {
  return {
    PENDING_REVIEW: "Pendiente",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
  }[status];
}

export function ModerationWorkspace() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [cases, setCases] = useState<GameModerationCase[]>([]);
  const [status, setStatus] =
    useState<GameModerationListQuery["status"]>("PENDING_REVIEW");
  const [approvedByUserId, setApprovedByUserId] = useState("");
  const [reviewers, setReviewers] = useState<
    GameModerationCase["submittedBy"][]
  >([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [reload, setReload] = useState(0);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let active = true;
    void listGameModerationCases({
      status,
      page,
      pageSize: 12,
      approvedByUserId: approvedByUserId || undefined,
    })
      .then((response) => {
        if (!active) return;
        setCases(response.moderationCases);
        setReviewers(response.reviewers);
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.totalItems);
        setLoadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setLoadState(
          error instanceof ApiRequestError &&
            (error.status === 401 || error.status === 403)
            ? "forbidden"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [approvedByUserId, page, reload, status]);

  async function handleApprove(moderationCase: GameModerationCase) {
    if (
      !window.confirm(
        `¿Aprobar “${moderationCase.game.name}” como juego global?`,
      )
    )
      return;
    setPendingCaseId(moderationCase.id);
    setMessage(null);
    try {
      await approveGameModerationCase(moderationCase.id);
      setMessage({
        kind: "success",
        text: `${moderationCase.game.name} ya forma parte del catálogo global.`,
      });
      setReload((value) => value + 1);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 409
            ? "Otro moderador ya resolvió este caso."
            : "No pudimos aprobar el juego.",
      });
    } finally {
      setPendingCaseId(null);
    }
  }

  async function handleReject(
    event: FormEvent<HTMLFormElement>,
    moderationCase: GameModerationCase,
  ) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    ).trim();
    setPendingCaseId(moderationCase.id);
    setMessage(null);
    try {
      await rejectGameModerationCase(moderationCase.id, { reason });
      setMessage({
        kind: "success",
        text: `La propuesta de ${moderationCase.game.name} fue rechazada con una explicación.`,
      });
      setReload((value) => value + 1);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 409
            ? "Otro moderador ya resolvió este caso."
            : "No pudimos rechazar la propuesta.",
      });
    } finally {
      setPendingCaseId(null);
    }
  }

  async function handleCoverUpload(
    event: FormEvent<HTMLFormElement>,
    moderationCase: GameModerationCase,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("cover") as HTMLInputElement | null)
      ?.files?.[0];
    if (!file || file.size === 0) {
      setMessage({ kind: "error", text: "Selecciona una imagen." });
      return;
    }
    const validationError = imageFileError(file);
    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }
    setPendingCaseId(moderationCase.id);
    setMessage(null);
    try {
      const response = await uploadGameCover(moderationCase.game.id, file);
      setCases((current) =>
        current.map((item) =>
          item.id === moderationCase.id
            ? {
                ...item,
                game: { ...item.game, coverMediaId: response.coverMediaId },
              }
            : item,
        ),
      );
      form.reset();
      setMessage({ kind: "success", text: "La portada quedó actualizada." });
    } catch {
      setMessage({ kind: "error", text: "No pudimos guardar la portada." });
    } finally {
      setPendingCaseId(null);
    }
  }

  if (loadState === "forbidden") {
    return (
      <section className="collection-state centered-card">
        <h1>Este espacio es para moderación</h1>
        <p className="lead">
          Inicia sesión con una cuenta moderadora o administradora.
        </p>
        <Link className="primary-action link-action" href="/acceso">
          Ir al acceso
        </Link>
      </section>
    );
  }

  return (
    <section
      className="moderation-workspace"
      aria-labelledby="moderation-title"
    >
      <header className="collection-heading">
        <div>
          <div className="eyebrow">Catálogo comunitario</div>
          <h1 id="moderation-title">Moderación</h1>
          <p className="lead">
            Revisa propuestas privadas antes de incorporarlas al catálogo
            global.
          </p>
        </div>
        <div className="moderation-filters">
          <label className="moderation-status-filter">
            Estado
            <select
              value={status}
              onChange={(event) => {
                const nextStatus = event.target
                  .value as GameModerationListQuery["status"];
                setPage(1);
                setLoadState("loading");
                setStatus(nextStatus);
                if (nextStatus !== "APPROVED") setApprovedByUserId("");
              }}
            >
              <option value="PENDING_REVIEW">Pendientes</option>
              <option value="APPROVED">Aprobados</option>
              <option value="REJECTED">Rechazados</option>
            </select>
          </label>
          {status === "APPROVED" ? (
            <label className="moderation-status-filter">
              Aprobado por
              <select
                value={approvedByUserId}
                onChange={(event) => {
                  setPage(1);
                  setLoadState("loading");
                  setApprovedByUserId(event.target.value);
                }}
              >
                <option value="">Todos</option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.displayName ?? `@${reviewer.username}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </header>

      {message ? (
        <p
          className={`form-message ${message.kind === "success" ? "success-message" : "error-message"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <div className="collection-state" aria-busy="true">
          Cargando casos de moderación…
        </div>
      ) : null}
      {loadState === "error" ? (
        <div className="collection-state centered-card">
          <h2>No pudimos abrir la cola</h2>
          <button
            className="secondary-action"
            onClick={() => {
              setLoadState("loading");
              setReload((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {loadState === "ready" ? (
        <p className="results-count">
          {totalItems} {totalItems === 1 ? "caso" : "casos"}
        </p>
      ) : null}
      {loadState === "ready" && cases.length === 0 ? (
        <div className="collection-empty">
          <div className="empty-icon" aria-hidden="true">
            ✓
          </div>
          <h2>No hay casos en este estado</h2>
          <p className="lead">La cola está al día.</p>
        </div>
      ) : null}

      {loadState === "ready" && cases.length > 0 ? (
        <div className="moderation-list">
          {cases.map((moderationCase) => (
            <article className="moderation-card" key={moderationCase.id}>
              <header>
                <div>
                  <span className="status-pill">
                    {statusLabel(moderationCase.status)}
                  </span>
                  <h2>{moderationCase.game.name}</h2>
                </div>
                {moderationCase.status === "APPROVED" ? (
                  <Link href={`/catalogo/${moderationCase.game.id}`}>
                    Abrir ficha →
                  </Link>
                ) : null}
              </header>
              <div className="moderation-cover-row">
                <div className="moderation-cover">
                  {moderationCase.game.coverMediaId ? (
                    <ManagedImage
                      mediaId={moderationCase.game.coverMediaId}
                      variant="thumbnail"
                      alt={`Portada de ${moderationCase.game.name}`}
                      width={320}
                      height={400}
                    />
                  ) : (
                    <span aria-hidden="true">Sin portada</span>
                  )}
                </div>
                {moderationCase.status === "PENDING_REVIEW" ? (
                  <form
                    className="media-upload"
                    onSubmit={(event) =>
                      void handleCoverUpload(event, moderationCase)
                    }
                  >
                    <label>
                      Portada para el catálogo
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
                      disabled={pendingCaseId === moderationCase.id}
                    >
                      {moderationCase.game.coverMediaId
                        ? "Cambiar portada"
                        : "Añadir portada"}
                    </button>
                  </form>
                ) : null}
              </div>
              <p>
                {moderationCase.game.description ??
                  "Sin descripción proporcionada."}
              </p>
              <dl className="moderation-facts">
                <div>
                  <dt>Jugadores</dt>
                  <dd>
                    {moderationCase.game.minPlayers}–
                    {moderationCase.game.maxPlayers}
                  </dd>
                </div>
                <div>
                  <dt>Propuesto por</dt>
                  <dd>
                    {moderationCase.submittedBy.displayName ??
                      `@${moderationCase.submittedBy.username}`}
                  </dd>
                </div>
                {moderationCase.resolvedBy ? (
                  <div>
                    <dt>
                      {moderationCase.status === "APPROVED"
                        ? "Aprobado por"
                        : "Resuelto por"}
                    </dt>
                    <dd>
                      {moderationCase.resolvedBy.displayName ??
                        `@${moderationCase.resolvedBy.username}`}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Mecánicas</dt>
                  <dd>
                    {moderationCase.game.mechanics.join(", ") ||
                      "Sin mecánicas"}
                  </dd>
                </div>
                <div>
                  <dt>Categorías</dt>
                  <dd>
                    {moderationCase.game.categories.join(", ") ||
                      "Sin categorías"}
                  </dd>
                </div>
              </dl>
              {moderationCase.submissionNote ? (
                <blockquote>{moderationCase.submissionNote}</blockquote>
              ) : null}
              {moderationCase.resolutionNote ? (
                <p className="resolution-note">
                  <strong>Resolución:</strong> {moderationCase.resolutionNote}
                </p>
              ) : null}
              {moderationCase.status === "PENDING_REVIEW" ? (
                <div className="moderation-actions">
                  <button
                    className="primary-action"
                    type="button"
                    disabled={pendingCaseId === moderationCase.id}
                    onClick={() => void handleApprove(moderationCase)}
                  >
                    Aprobar como global
                  </button>
                  <form
                    className="stack-form"
                    onSubmit={(event) =>
                      void handleReject(event, moderationCase)
                    }
                  >
                    <label>
                      Motivo del rechazo
                      <textarea
                        name="reason"
                        minLength={3}
                        maxLength={2000}
                        rows={2}
                        required
                      />
                    </label>
                    <button
                      className="danger-action"
                      disabled={pendingCaseId === moderationCase.id}
                    >
                      Rechazar
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {loadState === "ready" && totalPages > 1 ? (
        <nav className="pagination" aria-label="Paginación de moderación">
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
