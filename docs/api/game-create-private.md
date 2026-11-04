# Crear un juego privado

## `POST /api/v1/games`

Crea un juego utilizable inmediatamente por su autor sin incorporarlo al
catálogo global.

Requiere:

- sesión válida;
- permiso global `game.create`;
- `Origin` igual a `WEB_ORIGIN`;
- header `X-CSRF-Token` válido.

## Body

El contrato fuente es `CreatePrivateGameRequestSchema`:

```json
{
  "name": "Mi prototipo",
  "description": "Juego todavía en diseño",
  "publicationYear": 2026,
  "minPlayers": 1,
  "maxPlayers": 4,
  "minDurationMinutes": 20,
  "maxDurationMinutes": 60,
  "minAge": 10,
  "maxAge": 99,
  "complexity": 2.75
}
```

`name`, `minPlayers` y `maxPlayers` son obligatorios. Los demás campos son
opcionales y pueden enviarse como `null` cuando el contrato lo permite. Los
rangos máximos no pueden ser menores que sus mínimos y la complejidad debe estar
entre 0 y 5.

El contrato es estricto. Campos como `visibility`, `classification`,
`moderationStatus`, `createdByUserId` o `editions` son rechazados. La API fija
siempre:

- `classification = PRIVATE`;
- `visibility = PRIVATE`;
- `moderationStatus = DRAFT`;
- propietario igual al usuario autenticado.

Una coincidencia exacta de nombre no bloquea la creación. Dos propuestas pueden
compartir nombre sin que la aplicación suplante un futuro proceso de moderación
o merge.

## Respuesta `201`

La respuesta utiliza `CreatePrivateGameResponseSchema`, equivalente al detalle
del juego recién creado. `isOwnedByViewer` es `true` y `editions` comienza como
arreglo vacío:

```json
{
  "game": {
    "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "name": "Mi prototipo",
    "description": "Juego todavía en diseño",
    "publicationYear": 2026,
    "minPlayers": 1,
    "maxPlayers": 4,
    "minDurationMinutes": 20,
    "maxDurationMinutes": 60,
    "minAge": 10,
    "maxAge": 99,
    "complexity": 2.75,
    "classification": "PRIVATE",
    "visibility": "PRIVATE",
    "moderationStatus": "DRAFT",
    "isOwnedByViewer": true,
    "createdAt": "2026-09-22T00:00:00.000Z",
    "updatedAt": "2026-09-22T00:00:00.000Z",
    "editions": []
  }
}
```

Se envía `Cache-Control: no-store`.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Body inválido, rango incoherente o campo desconocido |
| `401` | `AUTHENTICATION_REQUIRED` | No existe sesión |
| `401` | `SESSION_INVALID` | Sesión revocada o cuenta inactiva |
| `401` | `SESSION_EXPIRED` | La sesión venció |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen no permitido |
| `403` | `PERMISSION_DENIED` | Falta `game.create` |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF ausente o incorrecto |

## Pruebas automatizadas

`game-create.test.ts` cubre creación y lectura inmediata, ownership persistido,
nombres duplicados, rechazo de auto-publicación, validación de rangos y las tres
capas de seguridad: autenticación, permiso y CSRF.
