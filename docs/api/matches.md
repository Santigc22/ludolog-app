# Partidas: MVP

La primera vertical de partidas usa `/api/v1/matches`. Todos los endpoints
requieren origen web y sesión. Las escrituras también requieren CSRF y los
permisos estructurales `match.create` o `match.update`.

## `POST /api/v1/matches`

Registra una partida para un juego visible. `copyId` y `gameEditionId` son
opcionales: una persona puede registrar algo jugado fuera de sus ludotecas.
Cuando se envía una copia accesible, la API conserva también la ludoteca en la
que se encontraba como referencia histórica.

```json
{
  "gameId": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
  "copyId": null,
  "gameEditionId": null,
  "status": "COMPLETED",
  "visibility": "PRIVATE",
  "startedAt": "2026-11-13T18:30:00.000Z",
  "durationMinutes": 45,
  "location": "Casa",
  "notes": null,
  "participants": [
    {
      "userId": "f393aa06-8b03-44c8-b75a-8e15f59aa7b6",
      "outcome": "WIN",
      "score": 42
    },
    {
      "guestName": "Invitada",
      "outcome": "LOSS",
      "score": 10
    }
  ]
}
```

La cantidad de participantes debe respetar `game.minPlayers` y
`game.maxPlayers`. Cada participante representa la cuenta actual o un nombre
invitado, nunca ambos. La asociación segura de otras cuentas se añadirá cuando
exista búsqueda y consentimiento entre usuarios. Las partidas `INCOMPLETE` y
`CANCELLED` solo aceptan `NO_RESULT`; una inconclusa sí permanece en el
historial.

Responde `201` con `MatchResponseSchema`. Además de errores generales puede
devolver `GAME_NOT_FOUND`, `COPY_NOT_FOUND`, `GAME_EDITION_NOT_FOUND`,
`COPY_EDITION_MISMATCH`, `MATCH_PARTICIPANT_NOT_FOUND` y
`MATCH_PARTICIPANT_RANGE_INVALID`.

## `GET /api/v1/matches`

Lista únicamente las partidas creadas por la sesión actual, ordenadas desde la
más reciente. Admite `page`, `pageSize`, `gameId` y `status`. Responde con
`MatchListResponseSchema`.

## `GET /api/v1/matches/:matchId`

Consulta una partida propia con participantes, resultados y referencias de
juego, edición, copia y ludoteca. Una partida ajena responde `404` para no
revelar su existencia.

## `PATCH /api/v1/matches/:matchId`

Edita fecha, duración, lugar, notas, visibilidad, estado o la lista completa de
participantes de una partida propia. Juego, edición, copia y ludoteca son
referencias históricas inmutables. Marcar una partida como cancelada no la
elimina.

Los contratos viven en `packages/contracts/src/match/match.contracts.ts`. La
integración con PostgreSQL, permisos, rangos y privacidad se prueba en
`apps/api/test/match.test.ts`.
