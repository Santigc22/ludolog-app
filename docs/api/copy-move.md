# Mover una copia entre ludotecas

## `POST /api/v1/copies/:copyId/move`

Mueve una copia activa a otra ludoteca sin cambiar su identificador ni perder
su historial. Requiere:

- sesión válida;
- permiso global `copy.move`;
- rol `OWNER` o `MANAGER` tanto en la ludoteca de origen como en la de destino;
- copia y ambas ludotecas activas;
- `Origin` igual a `WEB_ORIGIN`;
- header `X-CSRF-Token` válido.

Una copia que no existe o cuyo origen no es accesible responde como no
encontrada para evitar revelar recursos privados.

## Parámetros y body

`copyId` debe ser un UUID. El body tiene como fuente de verdad
`MoveCopyRequestSchema` y es estricto:

```json
{
  "destinationCollectionId": "7b962b21-67dd-49bc-97dd-c14ae1805504"
}
```

No se aceptan campos que intenten editar directamente la ubicación, el
historial o el lifecycle. Mover una copia a su ubicación actual se rechaza de
forma explícita y no crea un tramo histórico falso.

## Respuesta `200`

Devuelve `CopyDetailResponseSchema`, igual que
`GET /api/v1/copies/:copyId`, con el mismo ID, el destino como ubicación actual
y el historial actualizado. Se envía `Cache-Control: no-store`.

La operación se ejecuta en una única transacción:

1. bloquea la copia y las dos ludotecas; estas últimas se bloquean en orden
   estable para evitar interbloqueos entre movimientos cruzados;
2. valida lifecycle, autorización y consistencia del tramo abierto;
3. cierra el tramo del origen y abre el del destino usando el mismo instante;
4. actualiza `currentCollectionId` sin crear otra copia;
5. registra `copy.moved`, con estado anterior y posterior, en la auditoría;
6. confirma todo o revierte todo, incluida la auditoría.

Al confirmar existe exactamente un tramo abierto, correspondiente al destino.
Si dos solicitudes intentan mover simultáneamente la misma copia al mismo
destino, solo una crea historia; la otra observa el estado ya actualizado y
responde con conflicto.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | UUID o body inválido, o campos adicionales |
| `401` | `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` | Sesión ausente o inválida |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen web no permitido |
| `403` | `PERMISSION_DENIED` | Falta `copy.move` |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF incorrecto |
| `403` | `SOURCE_COLLECTION_ROLE_DENIED` | El rol en el origen no permite mover |
| `403` | `DESTINATION_COLLECTION_ROLE_DENIED` | El rol en el destino no permite recibir la copia |
| `404` | `COPY_NOT_FOUND` | Copia inexistente, oculta o sin origen autorizante |
| `404` | `DESTINATION_COLLECTION_NOT_FOUND` | Destino inexistente o no accesible |
| `409` | `COPY_NOT_ACTIVE` | La copia ya fue retirada |
| `409` | `SOURCE_COLLECTION_ARCHIVED` | El origen está archivado |
| `409` | `DESTINATION_COLLECTION_ARCHIVED` | El destino está archivado |
| `409` | `COPY_ALREADY_IN_DESTINATION` | El destino es igual a la ubicación actual |
| `409` | `COPY_HISTORY_INCONSISTENT` | La ubicación actual y el tramo abierto no concuerdan |

## Pruebas automatizadas

`copy-move.test.ts` cubre el movimiento por manager, preservación del ID,
continuidad y unicidad del historial, auditoría anterior/posterior, destino
igual al origen, movimientos concurrentes, copia retirada, historial
inconsistente, ludotecas archivadas, roles insuficientes, privacidad,
autenticación, permiso, CSRF y rollback completo ante fallo de auditoría.
