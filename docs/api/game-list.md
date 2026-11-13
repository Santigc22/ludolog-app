# Listar y buscar juegos visibles

## `GET /api/v1/games`

Devuelve el catálogo que puede consultar el actor:

- una solicitud anónima ve únicamente juegos públicos, aprobados y activos;
- una sesión válida ve lo anterior y sus propios juegos privados en borrador;
- los juegos privados de terceros y los archivados nunca aparecen.

La autenticación es opcional. Si se envía una cookie de sesión reconocida pero
inválida o vencida, la API responde con el error de sesión correspondiente en
lugar de degradar silenciosamente la solicitud a anónima. Requiere `Origin`
igual a `WEB_ORIGIN`.

## Query

El contrato fuente es `GameListQuerySchema` de `@ludoteca/contracts`:

| Parámetro | Predeterminado | Regla |
|---|---:|---|
| `q` | Sin filtro | Texto de 1 a 100 caracteres después de `trim` |
| `mechanic` | Sin filtro | Nombre parcial de una mecánica, de 1 a 100 caracteres |
| `category` | Sin filtro | Nombre parcial de una categoría, de 1 a 100 caracteres |
| `minPlayers` | Sin filtro | Límite inferior del rango buscado |
| `maxPlayers` | Sin filtro | Límite superior del rango buscado |
| `page` | `1` | Entero mayor o igual a 1 |
| `pageSize` | `20` | Entero entre 1 y 100 |
| `sort` | `name` | `name`, `newest` o `publicationYear` |

La búsqueda se aplica al nombre sin distinguir mayúsculas. `%`, `_` y `\` se
tratan literalmente, no como comodines proporcionados por el cliente.

Cuando se envían ambos límites, deben coincidir exactamente con el rango
registrado del juego: `minPlayers=1&maxPlayers=4` devuelve juegos 1–4, pero no
un juego 2–4. Cuando se envía solo uno, se interpreta como una cantidad puntual
que el juego debe admitir: `minPlayers=4` o `maxPlayers=4` incluye un juego 2–8,
pero una búsqueda puntual de 1 no incluye juegos cuyo mínimo sea 2. Si se
envían ambos límites, `maxPlayers` debe ser igual o mayor que `minPlayers`.

Órdenes estables:

- `name`: nombre normalizado ascendente e ID ascendente;
- `newest`: fecha de creación descendente e ID descendente;
- `publicationYear`: año descendente, valores desconocidos al final, nombre e
  ID como desempate.

Ejemplo:

```text
GET /api/v1/games?q=catan&mechanic=negociacion&category=economico&minPlayers=4&page=1&pageSize=20&sort=name
```

## Respuesta `200`

La respuesta usa `GameListResponseSchema` y `Cache-Control: no-store`:

```json
{
  "games": [
    {
      "id": "e3030001-0000-4000-8000-000000000001",
      "name": "Catan",
      "description": null,
      "publicationYear": 1995,
      "minPlayers": 3,
      "maxPlayers": 4,
      "mechanics": ["Gestión de recursos", "Negociación"],
      "categories": ["Civilización", "Económico"],
      "minDurationMinutes": 60,
      "maxDurationMinutes": 120,
      "minAge": 10,
      "maxAge": null,
      "complexity": 2.3,
      "classification": "OFFICIAL",
      "visibility": "PUBLIC",
      "moderationStatus": "APPROVED",
      "isOwnedByViewer": false,
      "createdAt": "2026-09-22T00:00:00.000Z",
      "updatedAt": "2026-09-22T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

`isOwnedByViewer` permite identificar un juego privado propio sin exponer el ID
del creador. La consulta obtiene todos los campos del listado en una operación y
no ejecuta consultas adicionales por juego.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Query inválida o parámetro desconocido |
| `401` | `SESSION_INVALID` | Se proporcionó una sesión inválida o revocada |
| `401` | `SESSION_EXPIRED` | La sesión proporcionada venció |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |

## Pruebas automatizadas

`game-list.test.ts` cubre catálogo anónimo, juego privado propio, aislamiento de
privados ajenos, archivados, búsqueda literal e insensible a mayúsculas,
mecánicas, categorías, rangos de capacidad de jugadores, ordenamiento,
paginación y queries inválidas.
