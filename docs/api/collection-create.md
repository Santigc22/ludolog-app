# Crear una ludoteca personal

## `POST /api/v1/collections`

Crea una ludoteca personal y asigna al usuario autenticado una membresía
`OWNER`. Requiere:

- `Origin` igual a `WEB_ORIGIN`;
- sesión válida;
- permiso global `collection.create`;
- encabezado `X-CSRF-Token` válido.

Ludoteca y membresía se insertan en una sola transacción. Si cualquiera de las
dos operaciones falla, no se conserva ningún registro parcial.

## Solicitud

El contrato fuente es `CreateCollectionRequestSchema` de
`@ludoteca/contracts`:

```json
{
  "name": "Mi colección",
  "description": "Juegos de la estantería principal",
  "visibility": "PRIVATE"
}
```

| Campo | Regla |
|---|---|
| `name` | Requerido; texto de 1–140 caracteres tras recortar bordes |
| `description` | Opcional; `null` o texto de 1–2000 caracteres |
| `visibility` | Opcional; `PRIVATE` o `PUBLIC`; por defecto `PRIVATE` |

El contrato es estricto. No acepta `userId`, `createdByUserId`, `type`,
`status`, `role`, `isForSale` ni `archivedAt`. En particular,
`isForSale: true` responde `400`; la capacidad de venta permanece diferida a
E07.

## Respuesta `201`

La respuesta usa `CreateCollectionResponseSchema` e incluye
`Cache-Control: no-store`:

```json
{
  "collection": {
    "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "type": "PERSONAL",
    "status": "ACTIVE",
    "name": "Mi colección",
    "description": "Juegos de la estantería principal",
    "visibility": "PRIVATE",
    "isForSale": false,
    "createdByUserId": "3297a863-b2f0-4746-bfec-e76517342f86",
    "effectiveRole": "OWNER",
    "createdAt": "2026-09-21T22:30:00.000Z",
    "updatedAt": "2026-09-21T22:30:00.000Z",
    "archivedAt": null
  }
}
```

La respuesta permite al creador consultar inmediatamente el recurso creado.
El endpoint general de detalle se incorpora en E02-ST04.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Body inválido, campo desconocido o capacidad no soportada |
| `401` | `AUTHENTICATION_REQUIRED` | No existe cookie de sesión |
| `401` | `SESSION_INVALID` | Sesión revocada o cuenta inactiva |
| `401` | `SESSION_EXPIRED` | La sesión venció |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF ausente o incorrecto |
| `403` | `PERMISSION_DENIED` | Falta el permiso `collection.create` |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |
| `500` | `INTERNAL_SERVER_ERROR` | Falla inesperada; la transacción se revierte |

## Pruebas automatizadas

Las pruebas cubren normalización y campos controlados por servidor, valores por
defecto, persistencia de una única membresía `OWNER`, autenticación, CSRF,
rechazo de venta/grupo/estado y rollback cuando falla la membresía.
