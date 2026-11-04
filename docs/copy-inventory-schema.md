# Esquema de copias, historial y auditoría

E04-ST01 incorpora la migración `0007_dashing_guardian.sql`. El modelo conserva
la identidad de cada ejemplar físico aunque cambie de ludoteca o salga de la
posesión administrada.

## Tablas

### `copies`

Referencia obligatoriamente un `game` y, de forma opcional, una
`game_edition`. La FK compuesta `(game_edition_id, game_id)` garantiza que la
edición seleccionada pertenezca al mismo juego.

Se mantienen separadas estas dimensiones:

- `lifecycle_code`: `ACTIVE` o `EXITED`;
- `condition_code`: condición física, incluido `DAMAGED`;
- `current_collection_id`: ubicación actual de una copia activa;
- `exit_reason_code` y `exited_at`: motivo y momento de salida.

El `CHECK copies_lifecycle_consistent` exige:

- `ACTIVE`: colección actual presente y datos de salida ausentes;
- `EXITED`: colección actual ausente y motivo/fecha de salida presentes.

### `copy_collection_history`

Cada fila representa un intervalo de permanencia en una ludoteca. Un índice
único parcial impide más de un intervalo con `ended_at IS NULL` por copia y un
`CHECK` impide finalizar antes del inicio.

### `acquisitions`

Registra cómo llegó una copia a una ludoteca. No tiene unicidad por copia: un
mismo ejemplar puede acumular varias adquisiciones históricas. Precio y moneda
son opcionales conjuntamente; cuando hay precio se exige moneda ISO en
mayúsculas.

### `audit_logs`

El soporte mínimo registra actor obligatorio, acción, tipo e ID del recurso,
estado anterior/posterior, contexto y fecha. Los estados se almacenan como
`jsonb`. Esta tabla describe la operación, pero no sustituye el historial de
colecciones ni las adquisiciones.

## Catálogos estructurales

El seed de sistema, idempotente, mantiene:

- lifecycle: `ACTIVE`, `EXITED`;
- condición: `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`;
- causas de salida: `SOLD`, `TRADED`, `GIFTED`, `DONATED`, `LOST`,
  `DISCARDED`, `DAMAGED`, `OTHER`;
- adquisición: `PURCHASE`, `GIFT`, `TRADE`, `INHERITED`, `WON`, `OTHER`.

## Invariantes que debe proteger el servicio

PostgreSQL protege combinaciones locales y referencias, pero E04-ST02 y las
operaciones posteriores deben ejecutar atómicamente:

1. autorizar juego, edición y ludoteca para el actor;
2. crear o actualizar el estado actual y su intervalo histórico en una sola
   transacción;
3. asegurar que el intervalo abierto corresponda a `current_collection_id`;
4. bloquear la copia durante movimientos o salidas concurrentes;
5. insertar auditoría en la misma transacción;
6. impedir actualizaciones genéricas de lifecycle o colección actual;
7. aplicar futuros bloqueos de préstamos, ventas y trueques sin alterar este
   esquema anticipadamente.

Los tests de preparación de `ludoteca_test` comprueban FKs, lifecycle, relación
edición-juego, intervalo abierto único, adquisiciones múltiples y auditoría.
