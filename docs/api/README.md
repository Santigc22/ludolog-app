# Documentación de la API

La API pública de Ludoteca Virtual utiliza JSON y está versionada bajo
`/api/v1`.

Cada endpoint implementado debe añadir o actualizar su documentación en este
directorio. Como mínimo debe indicar:

- método y ruta;
- propósito y requisitos de acceso;
- parámetros, query y body;
- respuesta exitosa con ejemplo;
- errores públicos posibles;
- contrato Zod que actúa como fuente de verdad;
- pruebas automatizadas relacionadas.

## Endpoints disponibles

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| `GET` | `/api/v1/health` | Comprueba que el proceso HTTP responde | No |
| `GET` | `/api/v1/health/database` | Comprueba la conexión con PostgreSQL | No |
| `POST` | `/api/v1/auth/register` | Crea una cuenta, perfil, rol y sesión | No; origen web requerido |
| `POST` | `/api/v1/auth/login` | Inicia una sesión opaca | No; origen web requerido |
| `GET` | `/api/v1/auth/me` | Consulta y renueva la sesión actual | Sí |
| `POST` | `/api/v1/auth/logout` | Revoca la sesión actual | Sí + CSRF |
| `GET` | `/api/v1/profiles/me` | Consulta el perfil propio | Sí |
| `PATCH` | `/api/v1/profiles/me` | Actualiza campos permitidos del perfil propio | Sí + CSRF |
| `POST` | `/api/v1/collections` | Crea una ludoteca personal y su membresía `OWNER` | Sí + permiso + CSRF |
| `GET` | `/api/v1/collections` | Lista las ludotecas de las que el usuario es miembro | Sí |
| `GET` | `/api/v1/collections/:collectionId` | Consulta una ludoteca aplicando visibilidad y membresía | Opcional para públicas activas |
| `PATCH` | `/api/v1/collections/:collectionId` | Edita metadatos de una ludoteca activa | Sí + permiso + rol + CSRF |
| `POST` | `/api/v1/collections/:collectionId/archive` | Archiva lógicamente una ludoteca | Sí + permiso + `OWNER` + CSRF |
| `GET` | `/api/v1/games` | Lista y busca los juegos visibles para el actor | Opcional para incluir privados propios |
| `GET` | `/api/v1/games/:gameId` | Consulta un juego visible y sus ediciones | Opcional para privados propios |
| `POST` | `/api/v1/games` | Crea un juego privado propiedad del usuario | Sí + permiso + CSRF |
| `POST` | `/api/v1/games/:gameId/moderation-submissions` | Propone un juego privado propio para publicación global | Sí + permiso + CSRF |
| `GET` | `/api/v1/moderation/games` | Lista la cola de propuestas por estado | Sí + `moderation.view` |
| `POST` | `/api/v1/moderation/cases/:caseId/approve` | Publica la ficha existente como juego comunitario global | Sí + `moderation.approve` + CSRF |
| `POST` | `/api/v1/moderation/cases/:caseId/reject` | Devuelve la propuesta al autor con un motivo | Sí + `moderation.reject` + CSRF |
| `POST` | `/api/v1/collections/:collectionId/copies` | Registra una copia activa con historial, adquisición opcional y auditoría | Sí + permiso + rol + CSRF |
| `GET` | `/api/v1/collections/:collectionId/copies` | Lista copias actuales o históricas de una ludoteca accesible | Sí + membresía |
| `GET` | `/api/v1/copies/:copyId` | Consulta una copia, su historial y adquisiciones | Sí + membresía autorizante |
| `PATCH` | `/api/v1/copies/:copyId` | Edita alias, notas y condición sin alterar lifecycle | Sí + permiso + rol + CSRF |
| `POST` | `/api/v1/copies/:copyId/move` | Mueve la misma copia y conserva su historial | Sí + permiso + rol en origen/destino + CSRF |
| `POST` | `/api/v1/copies/:copyId/exit` | Retira una copia sin borrar su historial ni adquisiciones | Sí + permiso + rol + CSRF |

Consulta [health.md](./health.md), [database-health.md](./database-health.md) y
[auth-registration.md](./auth-registration.md) y
[auth-session.md](./auth-session.md), y [own-profile.md](./own-profile.md) para
los contratos detallados. La creación de ludotecas se documenta en
[collection-create.md](./collection-create.md) y su listado en
[collection-list.md](./collection-list.md). La política de detalle está en
[collection-detail.md](./collection-detail.md), y las escrituras en
[collection-update-archive.md](./collection-update-archive.md).
El catálogo visible, sus filtros y ordenamientos se documentan en
[game-list.md](./game-list.md), y el detalle con ediciones en
[game-detail.md](./game-detail.md). La creación privada se documenta en
[game-create-private.md](./game-create-private.md).
El flujo de propuesta, cola, aprobación y rechazo está en
[game-moderation.md](./game-moderation.md).
El registro transaccional de copias se documenta en
[copy-create.md](./copy-create.md).
El listado y detalle de copias se documentan en
[copy-read.md](./copy-read.md).
La edición segura de metadatos se documenta en
[copy-update.md](./copy-update.md).
El movimiento transaccional entre ludotecas se documenta en
[copy-move.md](./copy-move.md).
La retirada explícita de una copia se documenta en
[copy-exit.md](./copy-exit.md).

El patrón utilizado por Next.js para consumir la API se describe en
[web-consumption.md](./web-consumption.md).

El formato transversal de errores, request IDs y logs se describe en
[errors-and-request-ids.md](./errors-and-request-ids.md).

Las reglas de autenticación, permisos y ownership se describen en
[access-control.md](./access-control.md).

## OpenAPI

La estrategia de generación OpenAPI permanece pendiente de `G05`. Esta
documentación versionada no introduce una segunda definición ejecutable del
contrato: los schemas Zod de `@ludoteca/contracts` continúan siendo la fuente
de verdad. Cuando se resuelva `G05`, la documentación automática deberá partir
de esos contratos.
