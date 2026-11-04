# Listar ludotecas accesibles

## `GET /api/v1/collections`

Devuelve exclusivamente las ludotecas en las que el usuario autenticado tiene
una fila en `collection_members`. La visibilidad pública no sustituye la
membresía en este listado y una ludoteca privada ajena nunca se devuelve.

Requiere `Origin` igual a `WEB_ORIGIN` y una sesión válida. Al ser una lectura,
no requiere token CSRF.

## Query

El contrato fuente es `CollectionListQuerySchema` de
`@ludoteca/contracts`:

| Parámetro | Valor predeterminado | Regla |
|---|---:|---|
| `page` | `1` | Entero mayor o igual a 1 |
| `pageSize` | `20` | Entero entre 1 y 100 |
| `includeArchived` | `false` | Literal `true` o `false` |

Ejemplo:

```text
GET /api/v1/collections?page=2&pageSize=10&includeArchived=true
```

Las archivadas se excluyen por defecto. `includeArchived=true` las añade al
resultado, pero no amplía el acceso: la consulta sigue exigiendo membresía del
usuario autenticado.

## Respuesta `200`

La respuesta utiliza `CollectionListResponseSchema` y se sirve con
`Cache-Control: no-store`:

```json
{
  "collections": [
    {
      "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      "type": "PERSONAL",
      "status": "ACTIVE",
      "name": "Mi colección",
      "description": null,
      "visibility": "PRIVATE",
      "isForSale": false,
      "gameCount": 12,
      "createdByUserId": "3297a863-b2f0-4746-bfec-e76517342f86",
      "effectiveRole": "OWNER",
      "createdAt": "2026-09-21T22:30:00.000Z",
      "updatedAt": "2026-09-21T22:30:00.000Z",
      "archivedAt": null
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

`gameCount` cuenta las copias activas cuya ubicación actual es la ludoteca; no
incluye copias retiradas ni juegos que fueron movidos a otro espacio.
`effectiveRole` procede de la membresía del usuario. El orden estable es
`createdAt` descendente y, en caso de empate, `id` descendente.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Paginación, filtro o parámetro desconocido inválido |
| `401` | `AUTHENTICATION_REQUIRED` | No existe sesión |
| `401` | `SESSION_INVALID` | Sesión revocada o cuenta inactiva |
| `401` | `SESSION_EXPIRED` | La sesión venció |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |

## Pruebas automatizadas

Las pruebas cubren aislamiento frente a ludotecas privadas ajenas, acceso por
membresía a una ludoteca creada por otra persona, roles efectivos, conteo de
juegos activos, orden,
paginación, exclusión/inclusión explícita de archivadas, filtros inválidos y
acceso anónimo.
