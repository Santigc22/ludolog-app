"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type {
  EditionModerationCase,
  EditionModerationListQuery,
} from "@ludoteca/contracts";

import { ApiRequestError } from "../../lib/api/client";
import {
  approveEditionModerationCase,
  listEditionModerationCases,
  rejectEditionModerationCase,
} from "../../lib/api/moderation";

type LoadState = "loading" | "ready" | "forbidden" | "error";
type Message = { kind: "success" | "error"; text: string };

function statusLabel(status: EditionModerationCase["status"]) {
  return {
    PENDING_REVIEW: "Pendiente",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
  }[status];
}

function editionMetadata(edition: EditionModerationCase["edition"]) {
  return [
    edition.editionNumber ? `Versión ${edition.editionNumber}` : null,
    edition.languageCode ? `Idioma ${edition.languageCode}` : null,
    edition.publicationYear?.toString() ?? null,
    edition.isbn ? `ISBN ${edition.isbn}` : null,
    edition.sku ? `SKU ${edition.sku}` : null,
    edition.upc ? `UPC ${edition.upc}` : null,
  ].filter((value): value is string => value !== null);
}

export function EditionModerationWorkspace() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [cases, setCases] = useState<EditionModerationCase[]>([]);
  const [status, setStatus] =
    useState<EditionModerationListQuery["status"]>("PENDING_REVIEW");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [reload, setReload] = useState(0);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let active = true;
    void listEditionModerationCases({ status, page, pageSize: 12 })
      .then((response) => {
        if (!active) return;
        setCases(response.moderationCases);
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
  }, [page, reload, status]);

  async function approve(moderationCase: EditionModerationCase) {
    const editionName = moderationCase.edition.editionName ?? "Sin nombre";
    if (
      !window.confirm(
        `¿Aprobar la edición “${editionName}” de ${moderationCase.game.name}?`,
      )
    )
      return;
    setPendingCaseId(moderationCase.id);
    setMessage(null);
    try {
      await approveEditionModerationCase(moderationCase.id);
      setMessage({
        kind: "success",
        text: `${editionName} ya está disponible para todo el catálogo.`,
      });
      setReload((value) => value + 1);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 409
            ? "Otro moderador ya resolvió esta propuesta."
            : "No pudimos aprobar la edición.",
      });
    } finally {
      setPendingCaseId(null);
    }
  }

  async function reject(
    event: FormEvent<HTMLFormElement>,
    moderationCase: EditionModerationCase,
  ) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    ).trim();
    setPendingCaseId(moderationCase.id);
    setMessage(null);
    try {
      await rejectEditionModerationCase(moderationCase.id, { reason });
      setMessage({
        kind: "success",
        text: "La propuesta de edición fue rechazada con una explicación.",
      });
      setReload((value) => value + 1);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 409
            ? "Otro moderador ya resolvió esta propuesta."
            : "No pudimos rechazar la edición.",
      });
    } finally {
      setPendingCaseId(null);
    }
  }

  if (loadState === "forbidden") return null;

  return (
    <section
      className="moderation-workspace edition-moderation-workspace"
      aria-labelledby="edition-moderation-title"
    >
      <header className="collection-heading">
        <div>
          <div className="eyebrow">Variantes del catálogo</div>
          <h2 id="edition-moderation-title">Moderación de ediciones</h2>
          <p className="lead">
            Revisa las ediciones propuestas al registrar copias físicas.
          </p>
        </div>
        <label className="moderation-status-filter">
          Estado
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setLoadState("loading");
              setStatus(
                event.target.value as EditionModerationListQuery["status"],
              );
            }}
          >
            <option value="PENDING_REVIEW">Pendientes</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
          </select>
        </label>
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
          Cargando propuestas de edición…
        </div>
      ) : null}
      {loadState === "error" ? (
        <div className="collection-state centered-card">
          <h3>No pudimos abrir las ediciones</h3>
          <button
            className="secondary-action"
            onClick={() => setReload((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {loadState === "ready" ? (
        <p className="results-count">
          {totalItems} {totalItems === 1 ? "edición" : "ediciones"}
        </p>
      ) : null}
      {loadState === "ready" && cases.length === 0 ? (
        <div className="collection-empty compact-empty">
          <h3>No hay ediciones en este estado</h3>
          <p>La cola de ediciones está al día.</p>
        </div>
      ) : null}

      {loadState === "ready" && cases.length > 0 ? (
        <div className="moderation-list">
          {cases.map((moderationCase) => {
            const metadata = editionMetadata(moderationCase.edition);
            return (
              <article className="moderation-card" key={moderationCase.id}>
                <header>
                  <div>
                    <span className="status-pill">
                      {statusLabel(moderationCase.status)}
                    </span>
                    <h3>
                      {moderationCase.edition.editionName ??
                        "Edición sin nombre"}
                    </h3>
                    <p className="edition-game-name">
                      Edición de <strong>{moderationCase.game.name}</strong>
                    </p>
                  </div>
                  <Link href={`/catalogo/${moderationCase.game.id}`}>
                    Abrir juego →
                  </Link>
                </header>
                {metadata.length > 0 ? (
                  <div className="mechanic-list edition-metadata-list">
                    {metadata.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
                <dl className="moderation-facts">
                  <div>
                    <dt>Propuesta por</dt>
                    <dd>
                      {moderationCase.submittedBy.displayName ??
                        `@${moderationCase.submittedBy.username}`}
                    </dd>
                  </div>
                  {moderationCase.resolvedBy ? (
                    <div>
                      <dt>Resuelta por</dt>
                      <dd>
                        {moderationCase.resolvedBy.displayName ??
                          `@${moderationCase.resolvedBy.username}`}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {moderationCase.edition.notes ? (
                  <blockquote>{moderationCase.edition.notes}</blockquote>
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
                      onClick={() => void approve(moderationCase)}
                    >
                      Aprobar edición
                    </button>
                    <form
                      className="stack-form"
                      onSubmit={(event) => void reject(event, moderationCase)}
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
            );
          })}
        </div>
      ) : null}

      {loadState === "ready" && totalPages > 1 ? (
        <nav className="pagination" aria-label="Paginación de ediciones">
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
