# Publicación administrativa directa

## `POST /api/v1/games/public`

Crea una ficha visible inmediatamente en el catálogo público. Requiere sesión,
CSRF y el permiso `catalog.game.publish_direct`, asignado únicamente a `ADMIN`
por los datos estructurales del sistema.

Acepta los mismos metadatos de la creación privada y añade `classification`,
que puede ser `OFFICIAL` o `COMMUNITY` y usa `OFFICIAL` por defecto.

```json
{
  "name": "Harmonies",
  "minPlayers": 1,
  "maxPlayers": 4,
  "classification": "OFFICIAL",
  "mechanics": ["Colocación de losetas"],
  "categories": ["Naturaleza"]
}
```

La operación es transaccional y registra en conjunto:

- el juego como `PUBLIC` y `APPROVED`;
- un caso de moderación cerrado como `APPROVED`;
- al mismo administrador como proponente y aprobador;
- una acción con resolución `Publicación directa administrativa.`;
- un evento de auditoría `game.public_created_directly` con modo
  `DIRECT_ADMIN`.

Responde `201` con `CreatePublicGameResponseSchema`. Puede devolver `400
VALIDATION_ERROR`, errores de sesión, `403 PERMISSION_DENIED` o `403
CSRF_TOKEN_INVALID`.

La autorización, persistencia e historial se cubren en
`apps/api/test/game-create-public.test.ts`.
