# Editar metadatos, condición y edición de una copia

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
los campos editables:

```json
{
  "alias": "Copia para torneos",
  "notes": "Una esquina está desgastada",
  "condition": "DAMAGED",
  "gameEditionId": "86f890e4-3782-4979-82a9-503be7ac418f"
}
```

`alias` y `notes` pueden enviarse como `null` para limpiarlos. Las condiciones
permitidas son `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR` y `DAMAGED`.
`gameEditionId` asigna o cambia una edición existente y `null` deja la copia sin
edición específica. La edición debe pertenecer al mismo juego y estar aprobada
o ser una propuesta pendiente del actor. La edición que ya tenga vinculada la
copia puede conservarse aunque después haya sido rechazada.

En lugar de `gameEditionId` puede enviarse `proposedEdition` con la misma forma
documentada en [copy-create.md](./copy-create.md). La propuesta solo se admite
para juegos públicos aprobados. La edición pendiente, su caso de moderación y
el cambio de la copia se crean en la misma transacción.

El contrato es estricto y rechaza, entre otros:

- `gameId`;
- `currentCollectionId`;
- `lifecycle`;
- `exitReason` y `exitedAt`;
- creador, historial, adquisiciones o auditoría.

Cambiar la condición a `DAMAGED` no retira la copia. Continúa `ACTIVE` en su
ludoteca hasta que se ejecute el caso de uso explícito de salida.

## Respuesta `200`

Devuelve `UpdateCopyResponseSchema`: contiene el detalle actualizado y
`editionProposal`, que es `null` salvo cuando se creó una edición pendiente. La
operación bloquea la copia y registra `copy.updated` con estados anterior y
posterior dentro de la misma transacción. Si falla la auditoría, también se
revierten la edición y su caso de moderación.

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
| `400` | `GAME_EDITION_NOT_FOUND` | La edición no pertenece al juego o no está disponible para el actor |
| `409` | `GAME_EDITION_PROPOSAL_NOT_ALLOWED` | El juego no admite propuestas públicas de edición |

## Pruebas automatizadas

`copy-update.test.ts` cubre edición por propietario y manager, asignación,
eliminación y propuesta de ediciones, limpieza de campos opcionales, condición
dañada sin salida, renovación de `updatedAt`, auditoría anterior/posterior,
rechazo de campos de dominio, roles, privacidad, ludoteca archivada, permiso,
autenticación, CSRF y rollback por fallo de auditoría.
