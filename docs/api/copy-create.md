# Registrar una copia física

## `POST /api/v1/collections/:collectionId/copies`

Crea una copia `ACTIVE` en una ludoteca, abre su primer intervalo histórico,
registra una adquisición opcional y escribe auditoría dentro de una sola
transacción PostgreSQL.

Requiere:

- sesión válida;
- permiso global `copy.create`;
- rol `OWNER` o `MANAGER` en la ludoteca activa;
- `Origin` igual a `WEB_ORIGIN`;
- header `X-CSRF-Token` válido.

## Parámetro

`collectionId` debe ser un UUID. Una ludoteca inexistente o no accesible se
responde como no encontrada. `VIEWER` y `MEMBER` no pueden registrar copias.

## Body

La fuente de verdad es `CreateCopyRequestSchema`:

```json
{
  "gameId": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
  "gameEditionId": "86f890e4-3782-4979-82a9-503be7ac418f",
  "condition": "LIKE_NEW",
  "alias": "Copia de la mesa principal",
  "notes": "Incluye promos",
  "acquisition": {
    "type": "PURCHASE",
    "acquiredOn": "2026-09-22",
    "priceAmount": 120000,
    "currencyCode": "COP",
    "sourceName": "Tienda local",
    "notes": "Compra presencial"
  }
}
```

`gameId` es obligatorio. `gameEditionId` y `acquisition` son opcionales. La
condición por defecto es `GOOD`. Si se informa un precio, también debe enviarse
una moneda de tres letras; la API la normaliza a mayúsculas.

El contrato es estricto. Rechaza `lifecycle`, `currentCollectionId`, datos de
salida, creador, historial y auditoría. La API fija siempre:

- `lifecycle = ACTIVE`;
- `currentCollectionId` igual al parámetro de ruta;
- creador y actor igual al usuario autenticado;
- motivo y fecha de salida en `null`.

El juego se valida otra vez en el servidor: debe ser público aprobado o privado
del actor. Si hay edición, esta debe pertenecer al juego indicado.

## Respuesta `201`

Utiliza `CreateCopyResponseSchema` y no expone detalles internos de la
transacción:

```json
{
  "copy": {
    "id": "b20ffb0a-0a25-44e7-b07e-a6ec8781900c",
    "gameId": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "gameEditionId": "86f890e4-3782-4979-82a9-503be7ac418f",
    "currentCollectionId": "a1d4bbd7-5bf0-4665-bbf8-5885a65108a8",
    "lifecycle": "ACTIVE",
    "condition": "LIKE_NEW",
    "alias": "Copia de la mesa principal",
    "notes": "Incluye promos",
    "exitReason": null,
    "exitedAt": null,
    "createdByUserId": "3297a863-b2f0-4746-bfec-e76517342f86",
    "createdAt": "2026-09-22T14:00:00.000Z",
    "updatedAt": "2026-09-22T14:00:00.000Z"
  },
  "acquisition": {
    "id": "fa8fb427-a4be-4cc4-bfce-86c24121901e",
    "copyId": "b20ffb0a-0a25-44e7-b07e-a6ec8781900c",
    "collectionId": "a1d4bbd7-5bf0-4665-bbf8-5885a65108a8",
    "acquiredByUserId": "3297a863-b2f0-4746-bfec-e76517342f86",
    "type": "PURCHASE",
    "acquiredOn": "2026-09-22",
    "priceAmount": 120000,
    "currencyCode": "COP",
    "sourceName": "Tienda local",
    "notes": "Compra presencial",
    "createdAt": "2026-09-22T14:00:00.000Z"
  }
}
```

Sin adquisición, `acquisition` es `null`. Se envía `Cache-Control: no-store`.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Parámetro/body inválido o campos controlados por el servidor |
| `400` | `GAME_EDITION_NOT_FOUND` | La edición no existe o no pertenece al juego |
| `401` | `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` | Sesión ausente o inválida |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen web no permitido |
| `403` | `PERMISSION_DENIED` | Falta `copy.create` |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF incorrecto |
| `403` | `COLLECTION_ROLE_DENIED` | El rol interno no permite agregar copias |
| `404` | `COLLECTION_NOT_FOUND` | Ludoteca inexistente o no accesible |
| `404` | `GAME_NOT_FOUND` | Juego inexistente, archivado o no visible |
| `409` | `COLLECTION_ARCHIVED` | La ludoteca ya está archivada |

## Atomicidad y pruebas

`copy-create.test.ts` comprueba copia, intervalo abierto, adquisición y
auditoría; condición por defecto; edición incompatible; juego privado ajeno;
roles, permiso, autenticación y CSRF; campos controlados por el servidor y
rollback completo cuando falla la inserción de auditoría.
