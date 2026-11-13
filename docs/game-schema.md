# Esquema mínimo de juegos y ediciones

E03-ST02 incorpora `games` y `game_editions` mediante la migración `0006`.

## Responsabilidades

- `games` representa la obra general, independientemente de una copia física o
  edición comercial.
- `game_editions` representa una publicación concreta y siempre pertenece a un
  juego. La migración `0013` añade su estado de moderación, autor y fecha de
  actualización; las ediciones preexistentes se conservan como `APPROVED`.
- `mechanics` normaliza los nombres de mecánicas y `game_mechanics` mantiene la
  relación de muchos a muchos con los juegos. La migración `0009` incorpora
  ambas tablas.
- `categories` normaliza categorías temáticas o de modalidad y
  `game_categories` mantiene su relación de muchos a muchos. La migración
  `0012` incorpora ambas tablas con el mismo patrón de integridad.
- Un juego puede existir sin ediciones y una futura copia podrá omitir la
  edición cuando el usuario no la conozca.
- Los nombres de juegos no son únicos: detectar duplicados corresponde al flujo
  de moderación, no a un constraint global.
- Una edición propuesta comienza en `PENDING_REVIEW`, puede pasar a `APPROVED`
  o `REJECTED` y conserva el vínculo con las copias que ya la utilizan.

## Scope y moderación

Durante E03 se aceptan únicamente estas combinaciones:

| Scope | Clasificación | Moderación | Propietario |
|---|---|---|---|
| Privado | `PRIVATE` | `DRAFT` | Obligatorio |
| Catálogo público | `OFFICIAL` o `COMMUNITY` | `APPROVED` | Opcional |
| Archivado | Conserva la clasificación y scope anteriores | `ARCHIVED` | Obligatorio si es privado |

La tabla no contiene `scope_group_id` y rechaza `visibility_code = 'GROUP'`.
Incorporar juegos de grupo requerirá una migración posterior junto con el
modelo real de grupos; no se permite almacenar un scope ambiguo mientras tanto.

## Integridad

- Jugadores mínimos y máximos forman un rango válido y el mínimo es al menos 1.
- Duración, edad, año y complejidad tienen rangos coherentes.
- `archived_at` y el estado `ARCHIVED` deben coincidir.
- La FK de una edición hacia su juego usa borrado restrictivo. Un juego con
  ediciones no puede eliminarse físicamente.
- Cada caso de moderación referencia exactamente un juego o una edición. Un
  índice parcial impide más de un caso pendiente por recurso.
- Los identificadores son UUID v4 generados por PostgreSQL y los timestamps
  usan `TIMESTAMPTZ(3)` según ADR-003.

## Índices

El esquema prepara búsquedas por nombre normalizado, visibilidad/moderación,
propietario y pertenencia de edición. E03-ST04 definirá la consulta y sus límites
de paginación sin añadir relaciones N+1.

Las mecánicas tienen unicidad por nombre normalizado y la tabla intermedia usa
una clave primaria compuesta. Las relaciones se eliminan en cascada cuando se
retira un juego o una mecánica.

Las categorías aplican las mismas reglas: unicidad sin distinguir mayúsculas,
relación compuesta y cascada. Tanto mecánicas como categorías se almacenan de
forma normalizada; la coincidencia parcial pertenece a las consultas, no al
modelo persistido.
