# Retirar una copia de la posesión administrada

## `POST /api/v1/copies/:copyId/exit`

Retira explícitamente una copia activa sin eliminarla. Requiere:

- sesión válida;
- permiso global `copy.remove`;
- rol `OWNER` o `MANAGER` en su ludoteca actual;
- copia y ludoteca activas;
- `Origin` igual a `WEB_ORIGIN`;
- header `X-CSRF-Token` válido.

Una copia inexistente o cuya última ludoteca no es accesible responde como no
encontrada para evitar revelar recursos privados.

## Parámetros y body

`copyId` debe ser un UUID. El body tiene como fuente de verdad
`ExitCopyRequestSchema` y es estricto:

```json
{
  "reason": "SOLD"
}
```

Las causas admitidas son:

- `SOLD`: venta externa;
- `TRADED`: intercambio externo;
- `GIFTED`: regalo;
- `DONATED`: donación;
- `LOST`: pérdida;
- `DISCARDED`: descarte;
- `DAMAGED`: retirada por daño;
- `OTHER`: otra causa.

La fecha de salida es propiedad del servidor y no se acepta en el body. La
condición física tampoco se modifica: una copia puede permanecer
`DAMAGED + ACTIVE` hasta que esta operación la retire expresamente.

## Respuesta `200`

Devuelve `CopyDetailResponseSchema`, igual que
`GET /api/v1/copies/:copyId`, con:

- el mismo identificador de copia;
- `lifecycle: "EXITED"`;
- `currentCollectionId: null`;
- `exitReason` igual a la causa solicitada;
- `exitedAt` generado por el servidor;
- historial y adquisiciones previas todavía consultables.

Se envía `Cache-Control: no-store`.

La operación se ejecuta en una única transacción: bloquea la copia y su
ludoteca autorizante, valida el estado, cierra exactamente el tramo histórico
abierto, actualiza el lifecycle y registra `copy.exited` con estados anterior y
posterior. El cierre del historial y `exitedAt` comparten el mismo instante. Si
falla cualquier paso, incluida la auditoría, se revierte todo.

Solicitudes concurrentes se serializan mediante el bloqueo de la copia. Solo
una puede confirmar la salida; las posteriores reciben conflicto. No existe
una operación de reingreso en esta historia.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | UUID, causa o body inválido, o campos adicionales |
| `401` | `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` | Sesión ausente o inválida |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen web no permitido |
| `403` | `PERMISSION_DENIED` | Falta `copy.remove` |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF incorrecto |
| `403` | `COLLECTION_ROLE_DENIED` | El rol interno no permite retirar la copia |
| `404` | `COPY_NOT_FOUND` | Copia inexistente u oculta |
| `409` | `COPY_NOT_ACTIVE` | La copia ya salió de la posesión administrada |
| `409` | `COLLECTION_ARCHIVED` | La ludoteca autorizante está archivada |
| `409` | `COPY_HISTORY_INCONSISTENT` | La ubicación actual y el tramo abierto no concuerdan |

## Pruebas automatizadas

`copy-exit.test.ts` cubre salida por manager, copia dañada activa, conservación
del ID, historial y adquisición, continuidad temporal, auditoría, concurrencia,
salida repetida, ludoteca archivada, rol insuficiente, historial inconsistente,
privacidad, autenticación, permiso, CSRF, causas inválidas y rollback completo
ante fallo de auditoría.
