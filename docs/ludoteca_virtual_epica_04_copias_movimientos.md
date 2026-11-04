# Ludoteca Virtual — E04: Copias físicas y movimientos

**Estado de la épica:** `DONE`  
**Dependencias:** E02 y E03  
**Resultado esperado:** registrar copias físicas, conservar su identidad y moverlas o retirarlas con historial y auditoría atómicos.

## 1. Propósito

Completar el primer vertical funcional:

`Usuario → Ludoteca personal → Juego de catálogo → Copia física → Movimiento o salida`

Una copia es un objeto físico concreto. No se confunde con el juego del catálogo ni se recrea al cambiar de ludoteca.

## 2. Reglas trazadas

| Regla | Aplicación |
|---|---|
| R-COPY-01 | Cada copia referencia exactamente un juego |
| R-COPY-02 | La edición es opcional y debe pertenecer al juego |
| R-COPY-03 | Una copia activa pertenece a exactamente una ludoteca |
| R-COPY-04 | Una copia salida puede conservarse sin ludoteca actual |
| R-COPY-05 | Mover no cambia la identidad de la copia |
| R-COPY-06 | Condición física y ciclo de vida son dimensiones separadas |
| R-COPY-07 | Ciclo de vida se limita a `ACTIVE`/`EXITED`; la causa va en `exit_reason` |
| R-COPY-08 | Movimientos conservan historial temporal |
| R-COPY-09 | Transferencias y salidas relevantes generan auditoría |
| R-ACQ-01..03 | La adquisición es histórica y puede repetirse para la misma copia |
| R-AUDIT-01..05 | Auditoría identifica actor, acción, recurso y contexto sin sustituir datos de dominio |

## 3. Invariantes obligatorias

1. `ACTIVE` implica `current_collection_id NOT NULL` y ausencia de causa/fecha de salida.
2. `EXITED` implica `current_collection_id NULL`, `exit_reason` y fecha de salida.
3. Solo puede existir un tramo abierto en `copy_collection_history` por copia.
4. El tramo abierto coincide con `current_collection_id`.
5. La edición, si existe, pertenece al mismo juego de la copia.
6. Estado actual e historial se actualizan dentro de una sola transacción.
7. Ningún endpoint genérico puede modificar directamente `current_collection_id` o `lifecycle`.

## 4. Features e historias

| Historia | Feature | Depende de | Estado inicial |
|---|---|---|---|
| E04-ST01 | Esquema de copias e historial | E02, E03, E00-ST07 | `DONE` |
| E04-ST02 | Registrar una copia | ST01 | `DONE` |
| E04-ST03 | Listar y consultar copias | ST01, ST02 | `DONE` |
| E04-ST04 | Editar metadatos y condición | ST02, ST03 | `DONE` |
| E04-ST05 | Mover una copia | ST02, E02-ST05 | `DONE` |
| E04-ST06 | Retirar una copia | ST02 | `DONE` |
| E04-ST07 | Interfaz de copias | ST02–ST06 | `DONE` |
| E04-ST08 | Pruebas integrales del vertical | ST02–ST07 | `DONE` |

## 5. Historias detalladas

### E04-ST01 — Crear esquema de copias e historial

**Objetivo:** implementar catálogos, `copies`, `copy_collection_history`, `acquisitions` y soporte mínimo de `audit_logs`.

**Criterios de aceptación:**

1. Catálogos estructurales contienen ciclo `ACTIVE`/`EXITED`, condiciones y causas de salida definidas.
2. FKs e índices cubren juego, edición, ludoteca actual e historial.
3. La base de datos impide al menos las combinaciones simples inválidas de lifecycle/collection/exit mediante `CHECK`.
4. Una adquisición pertenece a una copia y la misma copia puede tener varias adquisiciones históricas.
5. Se documentan invariantes complejas que protege el servicio.

### E04-ST02 — Registrar una copia

**Objetivo:** crear una copia activa dentro de una ludoteca accesible.

**Transacción requerida:**

1. validar actor, permiso y acceso a la ludoteca;
2. validar juego visible y edición compatible;
3. crear copia `ACTIVE`;
4. abrir tramo de historial en la misma ludoteca;
5. crear adquisición opcional si se proporcionó;
6. registrar auditoría;
7. confirmar todo o revertir todo.

**Criterios de aceptación:**

1. Una copia nunca queda creada sin historial abierto.
2. El usuario no puede crearla en una ludoteca ajena sin acceso suficiente.
3. La edición inválida se rechaza aunque el frontend la haya ofrecido.
4. El dato de adquisición es opcional y no define el estado actual.
5. La respuesta no expone detalles internos de transacción.

### E04-ST03 — Listar y consultar copias

**Objetivo:** consultar copias actuales de ludotecas accesibles y su detalle autorizado.

**Criterios de aceptación:**

1. Por defecto se listan copias activas de la ludoteca seleccionada.
2. Puede solicitarse historial/salidas mediante filtros explícitos y autorizados.
3. La respuesta distingue juego, edición opcional, condición y lifecycle.
4. No se filtran copias de ludotecas privadas ajenas.
5. Paginación y filtros tienen límites estables.

### E04-ST04 — Editar metadatos y condición

**Objetivo:** actualizar atributos ordinarios sin eludir operaciones de dominio.

**Criterios de aceptación:**

1. Se pueden editar alias, notas permitidas, condición y otros campos aprobados.
2. El endpoint no acepta `current_collection_id`, lifecycle, causa ni fecha de salida.
3. Cambiar condición a `DAMAGED` no retira automáticamente la copia.
4. La operación registra `updated_at` y auditoría cuando la política lo requiera.

### E04-ST05 — Implementar `moveCopy`

**Objetivo:** mover la misma copia entre ludotecas sin perder historial.

**Transacción requerida:**

1. bloquear/leer la copia de forma segura para evitar movimientos concurrentes;
2. comprobar que está `ACTIVE`;
3. autorizar origen y destino;
4. cerrar el tramo histórico abierto;
5. actualizar `current_collection_id`;
6. abrir el nuevo tramo;
7. registrar auditoría;
8. confirmar o revertir todo.

**Criterios de aceptación:**

1. El ID de la copia no cambia.
2. Al finalizar existe exactamente un tramo abierto y coincide con el destino.
3. Un destino igual al origen se rechaza o se trata como no-op explícito sin crear historia falsa.
4. Dos movimientos concurrentes no generan dos tramos abiertos.
5. Ningún repositorio público ofrece un update parcial alternativo que eluda el servicio.

### E04-ST06 — Implementar `exitCopy`

**Objetivo:** retirar una copia por venta externa, intercambio externo, regalo, donación, pérdida, descarte, daño u otra causa.

**Transacción requerida:** cerrar historial, marcar `EXITED`, limpiar colección actual, guardar causa/fecha y auditar.

**Criterios de aceptación:**

1. La copia no se elimina físicamente.
2. Se exige una causa de salida válida.
3. El historial previo y la adquisición permanecen consultables.
4. Una copia ya salida no puede volver a salir sin una operación futura de reingreso explícita.
5. `DAMAGED + ACTIVE` continúa permitido; retirarla por daño exige `exitCopy`.

**Nota:** préstamos, ventas internas y trades aún no existen. E06–E08 añadirán bloqueos y transiciones adicionales; esta historia no debe inventar tablas parciales para ellos.

### E04-ST07 — Crear interfaz de copias

**Objetivo:** registrar, listar, consultar, editar, mover y retirar copias desde Next.js.

**Criterios de aceptación:**

1. El formulario selecciona un juego visible y restringe ediciones al juego elegido.
2. Mover exige destino explícito y confirmación.
3. Retirar explica que la copia saldrá de la ludoteca pero conservará el historial.
4. Condición dañada no se presenta como sinónimo de retirada.
5. La UI se recupera de conflictos concurrentes mostrando el estado actual devuelto por la API.

### E04-ST08 — Probar el vertical completo

**Objetivo:** demostrar las invariantes y el recorrido de usuario de extremo a extremo.

**Escenarios mínimos:**

- crear usuario y ludoteca, elegir juego y registrar copia;
- rechazar una edición perteneciente a otro juego;
- mover una copia A → B conservando ID e historial;
- impedir movimiento a ludoteca no autorizada;
- retirar copia vendida externamente sin comprador registrado;
- conservar copia dañada activa y retirarla después por daño;
- revertir completamente una operación si falla auditoría o apertura/cierre de historial;
- resolver dos movimientos concurrentes sin dos tramos abiertos.

**Criterio de aceptación:** pruebas unitarias de servicios, integración con PostgreSQL y al menos un flujo UI/API pasan desde scripts raíz.

## 6. Límites para el agente

- No implementar préstamos, publicaciones de venta, trades ni reingreso de copias.
- No borrar copias para representar una salida.
- No mezclar condición física con lifecycle.
- No actualizar colección actual fuera de `moveCopy`, `exitCopy` o una operación de dominio futura equivalente.
- Si una restricción del ERD contradice una invariante de este documento, detenerse y registrar el conflicto; no ajustar silenciosamente.

## 7. Cierre del primer vertical

E04 está `DONE` cuando un usuario autenticado puede crear una ludoteca, seleccionar un juego, registrar una copia, modificar su condición, moverla y retirarla, manteniendo en todo momento identidad, historial, auditoría y permisos.
