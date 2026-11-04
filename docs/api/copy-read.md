# Listar y consultar copias

Las lecturas requieren una sesión válida y `Origin` igual a `WEB_ORIGIN`. No
requieren CSRF. El acceso depende de la membresía en la ludoteca, no de conocer
un UUID.

## `GET /api/v1/collections/:collectionId/copies`

Lista las copias asociadas a una ludoteca de la que el actor es miembro. Todos
los roles internos pueden leer. Una ludoteca privada ajena responde `404` y no
revela sus copias.

### Query

El contrato fuente es `CopyListQuerySchema`:

| Parámetro | Predeterminado | Regla |
|---|---:|---|
| `page` | `1` | Entero mayor o igual a 1 |
| `pageSize` | `20` | Entero entre 1 y 100 |
| `lifecycle` | `ACTIVE` | `ACTIVE`, `EXITED` o `ALL` |
| `q` | Sin filtro | Nombre parcial del juego |
| `mechanic` | Sin filtro | Nombre parcial de una mecánica |
| `minPlayers` | Sin filtro | Límite inferior del rango buscado |
| `maxPlayers` | Sin filtro | Límite superior del rango buscado |

Los filtros tienen estas semánticas:

- `ACTIVE`: copias activas cuya ubicación actual es la ludoteca;
- `EXITED`: copias salidas que tuvieron un intervalo en la ludoteca;
- `ALL`: cualquier copia que haya tenido un intervalo allí, incluso si luego
  fue movida a otra ludoteca autorizada.

La consulta predeterminada nunca incluye salidas ni movimientos históricos.
El orden es `createdAt` descendente y luego `id` descendente.
Los filtros de jugadores siguen la misma regla que el catálogo: al completar
ambos límites se exige una coincidencia exacta del rango registrado. Un filtro
1–4 no incluye un juego 2–4.

### Respuesta `200`

`CopyListResponseSchema` devuelve `copies` y `pagination`. Cada elemento
distingue explícitamente juego, edición opcional, condición física y lifecycle:

```json
{
  "copies": [
    {
      "id": "b20ffb0a-0a25-44e7-b07e-a6ec8781900c",
      "gameId": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      "gameEditionId": null,
      "currentCollectionId": "a1d4bbd7-5bf0-4665-bbf8-5885a65108a8",
      "lifecycle": "ACTIVE",
      "condition": "GOOD",
      "alias": "Mi copia",
      "notes": null,
      "exitReason": null,
      "exitedAt": null,
      "createdByUserId": "3297a863-b2f0-4746-bfec-e76517342f86",
      "createdAt": "2026-09-22T14:00:00.000Z",
      "updatedAt": "2026-09-22T14:00:00.000Z",
      "game": {
        "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        "name": "Catan",
        "minPlayers": 3,
        "maxPlayers": 4,
        "mechanics": ["Gestión de recursos", "Negociación"]
      },
      "edition": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

## `GET /api/v1/copies/:copyId`

Devuelve `CopyDetailResponseSchema`. Una copia activa se autoriza usando su
ludoteca actual; una copia salida usa su último intervalo histórico. De esta
forma, conocer una copia antigua no concede acceso después de un movimiento.

Además de los campos del listado, incluye:

- `collectionHistory`, ordenado del intervalo más antiguo al más reciente;
- `acquisitions`, ordenadas cronológicamente.

Cada intervalo informa `collectionId`, nombre, inicio y final opcional. El
detalle conserva las adquisiciones como historial y no las confunde con la
ubicación actual.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | UUID, paginación, lifecycle o campo desconocido inválido |
| `401` | `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` | Sesión ausente o inválida |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen web no permitido |
| `404` | `COLLECTION_NOT_FOUND` | Ludoteca inexistente o actor sin membresía |
| `404` | `COPY_NOT_FOUND` | Copia inexistente o actor sin acceso a su ubicación autorizante |

Ambos endpoints envían `Cache-Control: no-store`.

## Pruebas automatizadas

`copy-read.test.ts` cubre el filtro activo predeterminado, salidas, histórico,
paginación, filtros por juego, mecánica y jugadores, edición opcional,
condición, lifecycle, detalle con
intervalos y adquisiciones, acceso de distintos roles, aislamiento de
ludotecas privadas, sesión requerida y validación de parámetros.
