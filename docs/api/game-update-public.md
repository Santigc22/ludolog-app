# Administrar una ficha pública

## `PATCH /api/v1/games/:gameId`

Actualiza un juego activo que ya pertenece al catálogo público. Requiere una
sesión con el permiso `catalog.game.manage`, origen web permitido y token CSRF.
Ese permiso pertenece únicamente a los roles `CONTENT_MANAGER` y `ADMIN`.

El body usa `UpdatePublicGameRequestSchema`. Es parcial, pero debe incluir al
menos un campo:

```json
{
  "name": "Azul",
  "description": "Juego abstracto de colocación de losetas.",
  "publicationYear": 2017,
  "minPlayers": 2,
  "maxPlayers": 4,
  "minDurationMinutes": 30,
  "maxDurationMinutes": 45,
  "minAge": 8,
  "maxAge": null,
  "complexity": 1.8,
  "mechanics": ["Colocación de losetas", "Drafting"],
  "categories": ["Abstracto", "Familiar"]
}
```

Los campos opcionales pueden enviarse como `null` cuando corresponde. Los
rangos deben ser coherentes. Las mecánicas y categorías se normalizan, se
deduplican sin distinguir mayúsculas y reemplazan su lista anterior cuando se
incluyen.

La respuesta `200` usa `UpdatePublicGameResponseSchema` y devuelve la ficha
completa actualizada. El cambio es inmediato y genera el evento de auditoría
`game.public_updated` con estado anterior, estado nuevo y campos modificados.

Solo se admiten juegos `PUBLIC`, `APPROVED` y con clasificación `OFFICIAL` o
`COMMUNITY`. Los juegos privados siguen su flujo propio de autor y moderación.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Body vacío, tipos o límites inválidos |
| `400` | `GAME_RANGE_INVALID` | Un máximo queda por debajo de su mínimo existente o enviado |
| `401` | `AUTHENTICATION_REQUIRED` | No existe una sesión válida |
| `403` | `PERMISSION_DENIED` | El rol no administra el catálogo público |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF ausente o inválido |
| `404` | `PUBLIC_GAME_NOT_FOUND` | El juego no existe o no es una ficha pública aprobada y activa |

`game-update.test.ts` cubre autorización, actualización de datos, mecánicas y
categorías, auditoría, rangos inválidos y rechazo de fichas privadas.
