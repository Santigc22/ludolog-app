# Editar metadatos y condición de una copia

## `PATCH /api/v1/copies/:copyId`

Actualiza únicamente atributos ordinarios de una copia. Requiere:

- sesión válida;
- permiso global `copy.update`;
- rol `OWNER` o `MANAGER` en la ludoteca autorizante;
- ludoteca autorizante activa;
- `Origin` igual a `WEB_ORIGIN`;
- header `X-CSRF-Token` válido.

Para una copia activa, la ludoteca autorizante es su ubicación actual. Para una
copia salida se utiliza su último intervalo histórico. Una persona sin
membresía recibe `404 COPY_NOT_FOUND` para no revelar el recurso.

## Body

La fuente de verdad es `UpdateCopyRequestSchema`. Debe contener al menos uno de
estos campos:

```json
{
  "alias": "Copia para torneos",
  "notes": "Una esquina está desgastada",
  "condition": "DAMAGED"
}
```

`alias` y `notes` pueden enviarse como `null` para limpiarlos. Las condiciones
permitidas son `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR` y `DAMAGED`.

El contrato es estricto y rechaza, entre otros:

- `gameId` y `gameEditionId`;
- `currentCollectionId`;
- `lifecycle`;
- `exitReason` y `exitedAt`;
- creador, historial, adquisiciones o auditoría.

Cambiar la condición a `DAMAGED` no retira la copia. Continúa `ACTIVE` en su
ludoteca hasta que se ejecute el caso de uso explícito de salida.

## Respuesta `200`

Devuelve `CopyDetailResponseSchema`, igual que
`GET /api/v1/copies/:copyId`, con `updatedAt` renovado. La operación bloquea la
copia y registra `copy.updated` con estados anterior y posterior dentro de la
misma transacción. Si falla la auditoría, se revierte la actualización.

Se envía `Cache-Control: no-store`.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | UUID/body inválido, body vacío o campo no editable |
| `401` | `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` | Sesión ausente o inválida |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen web no permitido |
| `403` | `PERMISSION_DENIED` | Falta `copy.update` |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF incorrecto |
| `403` | `COLLECTION_ROLE_DENIED` | El rol interno no permite editar |
| `404` | `COPY_NOT_FOUND` | Copia inexistente o no accesible |
| `409` | `COLLECTION_ARCHIVED` | La ludoteca autorizante está archivada |

## Pruebas automatizadas

`copy-update.test.ts` cubre edición por propietario y manager, limpieza de
campos opcionales, condición dañada sin salida, renovación de `updatedAt`,
auditoría anterior/posterior, rechazo de campos de dominio, roles, privacidad,
ludoteca archivada, permiso, autenticación, CSRF y rollback por fallo de
auditoría.
