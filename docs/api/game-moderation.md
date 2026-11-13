# Moderación de juegos

Este flujo convierte una ficha privada existente en una ficha comunitaria
global. No crea otro juego: sus ediciones, mecánicas y copias conservan el mismo
`gameId`.

## Proponer un juego

`POST /api/v1/games/:gameId/moderation-submissions`

Requiere sesión, permiso `game.propose_publication`, origen web y CSRF. Solo el
propietario puede proponer un juego privado en estado `DRAFT` o `REJECTED`.

El body usa `SubmitGameForModerationRequestSchema`:

```json
{ "note": "La información y las mecánicas ya fueron verificadas." }
```

La nota es opcional. La respuesta `201` usa
`GameModerationCaseResponseSchema`; el caso y el juego pasan a
`PENDING_REVIEW`. Un segundo envío pendiente responde `409 GAME_NOT_SUBMITTABLE`.

## Consultar la cola

`GET /api/v1/moderation/games?status=PENDING_REVIEW&page=1&pageSize=20`

Requiere `moderation.view`. `status` admite `PENDING_REVIEW`, `APPROVED` o
`REJECTED`. La respuesta `200` usa `GameModerationListResponseSchema` e incluye
la ficha, el autor, el usuario que resolvió el caso, las notas, la lista de
aprobadores disponibles y la paginación. Cuando `status=APPROVED`, el parámetro
opcional `approvedByUserId` limita los resultados a las aprobaciones de ese
usuario.

## Aprobar

`POST /api/v1/moderation/cases/:caseId/approve`

Requiere `moderation.approve`, origen web y CSRF. La operación es transaccional:
el caso pasa a `APPROVED` y el mismo juego queda como `COMMUNITY`, `PUBLIC` y
`APPROVED`. Se registran acción de moderación y auditoría. Las copias no se
reescriben ni se eliminan.

## Rechazar

`POST /api/v1/moderation/cases/:caseId/reject`

Requiere `moderation.reject`, origen web y CSRF. El body usa
`RejectModerationCaseRequestSchema`:

```json
{ "reason": "Faltan datos verificables de la edición." }
```

El motivo tiene entre 3 y 2000 caracteres. El caso y el juego pasan a
`REJECTED`; la ficha permanece privada y visible para su propietario, quien
puede corregirla y volver a proponerla.

## Errores y concurrencia

Los endpoints pueden responder `400 VALIDATION_ERROR`, `401`, `403` o `404` de
acuerdo con autenticación, permisos y existencia. Resolver un caso ya cerrado
responde `409 MODERATION_CASE_ALREADY_RESOLVED`. El bloqueo transaccional y el
índice parcial de base de datos impiden dos decisiones o dos casos pendientes
para el mismo juego.

`moderation.test.ts` cubre permisos, propuesta duplicada, aprobación, rechazo,
visibilidad resultante y preservación de una copia existente.

## Moderación de ediciones

Una edición nueva se propone al registrar una copia mediante
`POST /api/v1/collections/:collectionId/copies`. Solo se admiten propuestas
para juegos públicos aprobados. La edición, la copia y el caso de moderación se
crean en una misma transacción: la copia queda registrada inmediatamente y la
edición comienza en `PENDING_REVIEW`.

Mientras está pendiente, la edición solo aparece en el detalle del juego para
su autor. La copia que originó la propuesta conserva siempre la referencia,
incluso si moderación la rechaza.

### Consultar la cola de ediciones

`GET /api/v1/moderation/editions?status=PENDING_REVIEW&page=1&pageSize=20`

Requiere `moderation.view`. `status` admite `PENDING_REVIEW`, `APPROVED` o
`REJECTED`. La respuesta usa `GameEditionModerationListResponseSchema` e
incluye los datos de la edición, el juego al que pertenece, el autor, la
decisión y la paginación.

### Aprobar o rechazar una edición

- `POST /api/v1/moderation/edition-cases/:caseId/approve`
- `POST /api/v1/moderation/edition-cases/:caseId/reject`

Aprobar requiere `moderation.approve` y hace que la edición quede disponible
para todos los usuarios. Rechazar requiere `moderation.reject` y el mismo body
con `reason` usado para juegos. Ambas escrituras exigen origen web, CSRF y se
ejecutan de forma transaccional junto con la acción y la auditoría.

Cada caso referencia exactamente un juego o una edición. Los índices parciales
impiden que un mismo recurso tenga dos casos pendientes. `moderation.test.ts`
cubre el ciclo completo desde el registro de una copia con edición propuesta
hasta su aprobación y visibilidad pública.
