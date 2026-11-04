# Consultar juego y ediciones

## `GET /api/v1/games/:gameId`

Devuelve los metadatos de un juego visible y todas sus ediciones. Aplica la
misma política que el listado:

- anónimos: juegos públicos, aprobados y activos;
- sesión válida: lo anterior y juegos privados propios en borrador;
- privados ajenos, archivados e inexistentes: `404 GAME_NOT_FOUND`.

La respuesta uniforme `404` evita confirmar la existencia de un recurso
privado. La autenticación es opcional y se exige un `Origin` permitido.

## Parámetro de ruta

`gameId` debe ser un UUID válido según `GameIdParamsSchema`. Un formato inválido
produce `400 VALIDATION_ERROR` y no consulta el recurso.

## Respuesta `200`

El contrato fuente es `GameDetailResponseSchema`:

```json
{
  "game": {
    "id": "e3030001-0000-4000-8000-000000000001",
    "name": "Catan",
    "description": null,
    "publicationYear": 1995,
    "minPlayers": 3,
    "maxPlayers": 4,
    "minDurationMinutes": 60,
    "maxDurationMinutes": 120,
    "minAge": 10,
    "maxAge": null,
    "complexity": 2.3,
    "classification": "OFFICIAL",
    "visibility": "PUBLIC",
    "moderationStatus": "APPROVED",
    "isOwnedByViewer": false,
    "createdAt": "2026-09-22T00:00:00.000Z",
    "updatedAt": "2026-09-22T00:00:00.000Z",
    "editions": [
      {
        "id": "e3030002-0000-4000-8000-000000000001",
        "editionName": "Edición de referencia en español",
        "editionNumber": null,
        "languageCode": "es",
        "publicationYear": null,
        "isbn": null,
        "sku": null,
        "upc": null,
        "notes": null,
        "createdAt": "2026-09-22T00:00:00.000Z"
      }
    ]
  }
}
```

Un juego sin ediciones devuelve `"editions": []`. Las ediciones se ordenan por
fecha de creación e ID, pertenecen necesariamente al juego solicitado y se
obtienen mediante agregación en la misma consulta; no existe patrón N+1.

La respuesta usa `Cache-Control: no-store` y no incluye configuraciones de
resultados, personas, editoriales ni datos de copias aún no implementados.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | `gameId` no es un UUID |
| `401` | `SESSION_INVALID` | Se proporcionó una sesión inválida o revocada |
| `401` | `SESSION_EXPIRED` | La sesión proporcionada venció |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |
| `404` | `GAME_NOT_FOUND` | Inexistente, archivado o no visible para el actor |

## Pruebas automatizadas

`game-detail.test.ts` cubre detalle público con múltiples ediciones, privado
propio sin edición, privado ajeno, archivado, inexistente y UUID inválido.
