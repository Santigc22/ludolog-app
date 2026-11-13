# Publicación administrativa por lote

## `POST /api/v1/games/public/batch`

Crea entre 1 y 500 juegos visibles inmediatamente en el catálogo público.
Requiere sesión, CSRF y `catalog.game.publish_direct`, permiso estructural
asignado solo a `ADMIN`.

El body contiene una lista `games`; cada elemento usa el mismo contrato de
`POST /api/v1/games/public`:

```json
{
  "games": [
    {
      "name": "Sky Team",
      "minPlayers": 2,
      "maxPlayers": 2,
      "classification": "OFFICIAL",
      "mechanics": ["Cooperativo"],
      "categories": ["Aviación"]
    }
  ]
}
```

No permite nombres repetidos dentro del mismo lote, ignorando mayúsculas y
espacios exteriores. La creación de juegos, taxonomías, casos de moderación,
acciones y auditoría sucede en una sola transacción: si una fila falla, no se
crea ninguna. Cada juego queda `PUBLIC` y `APPROVED`, con el administrador como
proponente y aprobador. Los eventos `game.public_created_directly` comparten un
`batchId` y usan `publicationMode: DIRECT_ADMIN_BATCH`.

Responde `201` con `BulkCreatePublicGamesResponseSchema`:

```json
{
  "games": [],
  "createdCount": 1
}
```

La interfaz de administración acepta CSV UTF-8 de hasta 2 MB, separado por `;`
o `,`, muestra una vista previa y utiliza `|` para separar mecánicas o
categorías. La columna opcional `portada` contiene el nombre del archivo. Por
seguridad del navegador, las imágenes se seleccionan aparte y se emparejan por
nombre; no se leen rutas locales directamente. Las portadas se cargan después
de la transacción del lote, por lo que un fallo de imagen se informa como
pendiente sin borrar los juegos ya publicados.

Puede devolver `400 VALIDATION_ERROR`, errores de sesión, `403
PERMISSION_DENIED` o `403 CSRF_TOKEN_INVALID`. Los contratos se prueban en
`packages/contracts/test/contracts.test.ts`, el cliente y parser en
`apps/web/test`, y la autorización y atomicidad en
`apps/api/test/game-create-public.test.ts`.
