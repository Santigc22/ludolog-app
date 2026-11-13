"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";

import { ApiRequestError } from "../../lib/api/client";
import { createPublicGamesBatch } from "../../lib/api/games";
import { imageFileError, uploadGameCover } from "../../lib/api/media";
import {
  GAME_IMPORT_TEMPLATE,
  parseGameImportCsv,
  type ParsedGameImportRow,
} from "../../lib/csv/game-bulk-import";

type ImportMessage = Readonly<{
  kind: "success" | "error";
  text: string;
}>;

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function normalizedFileName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function downloadTemplate() {
  const blob = new Blob(["\uFEFF", GAME_IMPORT_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla-juegos-publicos.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminGameBulkImport({
  onCompleted,
}: {
  onCompleted: (createdCount: number) => void;
}) {
  const [csvName, setCsvName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedGameImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState<ImportMessage | null>(null);

  const coversByName = useMemo(() => {
    const files = new Map<string, File>();
    for (const file of coverFiles) {
      const key = normalizedFileName(file.name);
      if (!files.has(key)) files.set(key, file);
    }
    return files;
  }, [coverFiles]);

  const coverSummary = useMemo(() => {
    let referenced = 0;
    let matched = 0;
    let invalid = 0;
    for (const row of rows) {
      if (!row.coverFileName) continue;
      referenced += 1;
      const file = coversByName.get(normalizedFileName(row.coverFileName));
      if (file) {
        matched += 1;
        if (file.size === 0 || imageFileError(file)) invalid += 1;
      }
    }
    return { referenced, matched, invalid, missing: referenced - matched };
  }, [coversByName, rows]);

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCompleted(false);
    setMessage(null);
    if (!file) {
      setCsvName(null);
      setRows([]);
      setParseErrors([]);
      return;
    }
    setCsvName(file.name);
    if (file.size > MAX_CSV_BYTES) {
      setRows([]);
      setParseErrors(["El archivo CSV debe pesar 2 MB o menos."]);
      return;
    }
    try {
      const parsed = parseGameImportCsv(await file.text());
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    } catch {
      setRows([]);
      setParseErrors(["No pudimos leer el archivo seleccionado."]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rows.length === 0 || parseErrors.length > 0 || coverSummary.invalid > 0)
      return;
    if (
      !window.confirm(
        `Se publicarán y aprobarán ${rows.length} juegos. ¿Deseas continuar?`,
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const response = await createPublicGamesBatch({
        games: rows.map(({ game }) => game),
      });
      let uploaded = 0;
      let failed = 0;
      const uploadTasks = rows.flatMap((row, index) => {
        if (!row.coverFileName) return [];
        const file = coversByName.get(normalizedFileName(row.coverFileName));
        if (!file) return [];
        return [{ gameId: response.games[index]!.id, file }];
      });
      for (let index = 0; index < uploadTasks.length; index += 4) {
        const results = await Promise.allSettled(
          uploadTasks
            .slice(index, index + 4)
            .map(({ gameId, file }) => uploadGameCover(gameId, file)),
        );
        uploaded += results.filter(
          ({ status }) => status === "fulfilled",
        ).length;
        failed += results.filter(({ status }) => status === "rejected").length;
      }

      const pendingCovers = coverSummary.missing + failed;
      setCompleted(true);
      setMessage({
        kind: "success",
        text: `${response.createdCount} juegos publicados. ${uploaded} ${uploaded === 1 ? "portada guardada" : "portadas guardadas"}${pendingCovers > 0 ? ` y ${pendingCovers} pendientes para añadir desde cada ficha` : ""}.`,
      });
      onCompleted(response.createdCount);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ApiRequestError && error.status === 400
            ? "El servidor rechazó el lote. Revisa los datos del archivo. No se publicó ningún juego."
            : "No pudimos publicar el lote. No se publicó ningún juego.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="collection-form bulk-import-panel">
      <div className="eyebrow">Administración del catálogo</div>
      <h2>Cargar juegos por lote</h2>
      <p className="lead">
        Revisa el archivo antes de publicar. Todos los juegos quedarán aprobados
        por tu cuenta y asociados al mismo lote de auditoría.
      </p>
      <button
        className="text-filter-action"
        type="button"
        onClick={downloadTemplate}
      >
        Descargar plantilla CSV
      </button>

      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          Archivo CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => void handleCsv(event)}
            required
          />
          <small>
            UTF-8, máximo 500 filas y 2 MB. Usa | para separar mecánicas y
            categorías.
          </small>
        </label>
        <label>
          Portadas referenciadas (opcional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              setCoverFiles(Array.from(event.target.files ?? []));
              setCompleted(false);
            }}
          />
          <small>
            Selecciona las imágenes indicadas en la columna portada. Se vinculan
            por nombre de archivo, no por la ruta local.
          </small>
        </label>

        {parseErrors.length > 0 ? (
          <div className="form-message error-message" role="alert">
            <strong>Corrige el archivo antes de publicarlo:</strong>
            <ul>
              {parseErrors.slice(0, 20).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {parseErrors.length > 20 ? (
              <p>Hay {parseErrors.length - 20} errores adicionales.</p>
            ) : null}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <div className="bulk-import-summary" aria-live="polite">
              <strong>{rows.length} juegos válidos</strong>
              <span>Archivo: {csvName}</span>
              <span>
                Portadas: {coverSummary.matched} encontradas ·{" "}
                {coverSummary.missing} pendientes
              </span>
            </div>
            {coverSummary.invalid > 0 ? (
              <p className="form-message error-message" role="alert">
                {coverSummary.invalid} portadas no son JPG, PNG o WebP válidas
                de máximo 8 MB.
              </p>
            ) : null}
            <div className="bulk-preview" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Juego</th>
                    <th>Jugadores</th>
                    <th>Clasificación</th>
                    <th>Portada</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.game.name}</td>
                      <td>
                        {row.game.minPlayers}–{row.game.maxPlayers}
                      </td>
                      <td>
                        {row.game.classification === "OFFICIAL"
                          ? "Oficial"
                          : "Comunitario"}
                      </td>
                      <td>{row.coverFileName ?? "Pendiente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 ? (
              <small>Vista previa de las primeras 20 filas.</small>
            ) : null}
          </>
        ) : null}

        {message ? (
          <p
            className={`form-message ${message.kind === "success" ? "success-message" : "error-message"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}
        <button
          className="primary-action"
          type="submit"
          disabled={
            pending ||
            completed ||
            rows.length === 0 ||
            parseErrors.length > 0 ||
            coverSummary.invalid > 0
          }
        >
          {pending
            ? "Publicando lote…"
            : completed
              ? "Lote publicado"
              : `Publicar y aprobar ${rows.length || 0} juegos`}
        </button>
      </form>
    </section>
  );
}
