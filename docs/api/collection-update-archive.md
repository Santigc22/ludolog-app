# Editar y archivar una ludoteca

Las escrituras combinan tres controles independientes:

1. sesión válida y protección CSRF;
2. permiso RBAC global;
3. rol suficiente en `collection_members`.

Las decisiones de membresía se realizan dentro de una transacción que bloquea
la ludoteca. La visibilidad pública nunca concede edición.

## `PATCH /api/v1/collections/:collectionId`

Requiere el permiso global `collection.update` y rol interno `OWNER` o
`MANAGER`. Solo permite editar una ludoteca `ACTIVE`.

El body se valida mediante `UpdateCollectionRequestSchema`:

```json
{
  "name": "Colección principal",
  "description": "Juegos de la sala",
  "visibility": "PUBLIC"
}
```

| Campo | Regla |
|---|---|
| `name` | Opcional; texto de 1–140 caracteres |
| `description` | Opcional; `null` o texto de 1–2000 caracteres |
| `visibility` | Opcional; `PRIVATE` o `PUBLIC` |

Debe enviarse al menos un campo. El contrato estricto rechaza `status`,
`archivedAt`, `type`, `isForSale`, propietarios, roles y cualquier campo
desconocido.

La respuesta `200` usa `CollectionDetailResponseSchema` y devuelve los datos
actualizados con el rol efectivo y `canEdit: true`.

## `POST /api/v1/collections/:collectionId/archive`

Requiere el permiso global `collection.archive` y rol interno `OWNER`. No
acepta body. Cambia el estado a `ARCHIVED`, establece `archivedAt` y conserva
la ludoteca y todas sus membresías. No existe borrado físico.

La operación es idempotente: repetirla como propietario devuelve `200` con el
recurso archivado. La respuesta usa `CollectionDetailResponseSchema` y marca
`canEdit: false`.

Esta historia no modifica membresías; por tanto, no puede eliminar al último
`OWNER`. Una futura operación de membresías deberá mantener esa invariante bajo
el mismo bloqueo transaccional.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | UUID, body o campos inválidos |
| `401` | `AUTHENTICATION_REQUIRED` | No existe sesión |
| `401` | `SESSION_INVALID` / `SESSION_EXPIRED` | Sesión no utilizable |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF ausente o incorrecto |
| `403` | `PERMISSION_DENIED` | Falta el permiso RBAC de la operación |
| `403` | `COLLECTION_ROLE_DENIED` | La membresía existe, pero su rol no autoriza |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |
| `404` | `COLLECTION_NOT_FOUND` | No existe o el usuario no es miembro |
| `409` | `COLLECTION_ARCHIVED` | Se intentó editar una ludoteca archivada |

El `404` para no miembros evita confirmar la existencia de ludotecas privadas.

## Pruebas automatizadas

Las pruebas cubren edición por `OWNER` y `MANAGER`, denegación a `VIEWER`,
ocultamiento a usuarios externos con permiso global, campos controlados por el
servidor, CSRF, archivado exclusivo del propietario, idempotencia, conservación
de membresías y rechazo de edición posterior al archivado.
