# Ludoteca Virtual — E03: Catálogo mínimo de juegos

**Estado de la épica:** `DONE`  
**Dependencias:** E00; E01 para creación privada  
**Resultado esperado:** catálogo consultable y capacidad controlada de crear un juego privado utilizable por su autor.

## 1. Alcance

Se implementa el subconjunto necesario para seleccionar un juego al registrar una copia:

- juego;
- ediciones opcionales;
- listado, búsqueda y detalle;
- un conjunto pequeño de datos de desarrollo;
- creación privada por usuario autenticado.

Se difieren moderación/publicación global, merges, expansiones completas, personas, editoriales avanzadas, archivos y configuración de resultados de partidas.

## 2. Reglas trazadas

| Regla | Aplicación |
|---|---|
| R-GAME-01 | El juego representa la obra, no una copia física |
| R-GAME-02 | Una edición pertenece a un juego y es opcional para la copia |
| R-GAME-03 | El catálogo global es compartido y no depende de la posesión |
| R-GAME-04 | Cambios destructivos no deben romper históricos |
| R-GAME-PRIVATE-01 | Un usuario puede crear un juego privado |
| R-GAME-PRIVATE-02 | El juego privado es utilizable inmediatamente por su autor |
| R-GAME-PRIVATE-03 | Privado no equivale a global ni aprobado |
| R-GAME-PRIVATE-04 | La publicación requiere moderación; diferida |
| R-GAME-PRIVATE-05 | El scope debe identificar a su propietario o grupo cuando aplique |

## 3. Features e historias

| Historia | Feature | Depende de | Estado actual |
|---|---|---|---|
| E03-ST01 | Catálogos estructurales mínimos | E00-ST07 | `DONE` |
| E03-ST02 | Esquema de juegos y ediciones | ST01; G04 resuelto | `DONE` |
| E03-ST03 | Seed de catálogo para desarrollo | ST02 | `DONE` |
| E03-ST04 | Listar y buscar juegos visibles | ST02 | `DONE` |
| E03-ST05 | Consultar juego y ediciones | ST02, ST04 | `DONE` |
| E03-ST06 | Crear juego privado | E01-ST07, ST02 | `DONE` |
| E03-ST07 | Interfaz de catálogo y selección | ST03–ST06 | `DONE` |

## 4. Historias detalladas

### E03-ST01 — Preparar catálogos estructurales

**Objetivo:** sembrar únicamente valores indispensables para juegos visibles y su estado de moderación.

**Criterios de aceptación:**

1. Los seeds pertenecen a `system` cuando son necesarios para operar.
2. Son idempotentes y usan códigos estables.
3. No se cargan miles de juegos como seed estructural.
4. Los niveles de visibilidad incompatibles con Game no pueden producir un scope ambiguo.

### E03-ST02 — Crear esquema de juegos y ediciones

**Objetivo:** implementar `games` y `game_editions` con sus relaciones mínimas.

**Criterios de aceptación:**

1. Un juego puede existir sin edición.
2. Una edición siempre referencia un juego válido.
3. Un juego privado identifica a su creador/propietario.
4. Si se permite visibilidad `GROUP`, `scope_group_id` es obligatorio; de lo contrario ese valor se rechaza en esta fase.
5. Eliminaciones físicas que rompan copias o partidas futuras están impedidas o fuera de la API.

### E03-ST03 — Crear seed de desarrollo

**Objetivo:** disponer de pocos juegos conocidos para desarrollo y pruebas.

**Datos sugeridos:** Catan, Flip 7, Azul y Pandemic, con ediciones solo cuando aporten a un escenario probado.

**Criterios de aceptación:**

1. El seed se ejecuta únicamente mediante el comando de desarrollo.
2. Repetirlo no duplica juegos ni ediciones.
3. Los datos se etiquetan claramente como desarrollo, no catálogo oficial exhaustivo.

### E03-ST04 — Listar y buscar juegos visibles

**Objetivo:** permitir búsquedas paginadas del catálogo accesible al actor.

**Criterios de aceptación:**

1. Usuarios anónimos ven solamente juegos públicos aprobados.
2. Un usuario autenticado también puede ver sus juegos privados.
3. Los juegos privados de terceros no aparecen.
4. Búsqueda, orden y paginación tienen defaults y límites explícitos.
5. La consulta evita patrones N+1 para los datos incluidos.

### E03-ST05 — Consultar detalle y ediciones

**Objetivo:** obtener la información necesaria para elegir juego y edición.

**Criterios de aceptación:**

1. Se aplica la misma política de visibilidad que al listado.
2. Las ediciones devueltas pertenecen al juego consultado.
3. Un ID privado ajeno no filtra su existencia según la política acordada.
4. No se devuelven configuraciones de partidas aún no implementadas.

### E03-ST06 — Crear un juego privado

**Objetivo:** permitir que un usuario extienda su catálogo sin contaminar el catálogo global.

**Criterios de aceptación:**

1. Requiere autenticación y permiso `game.create` o el código definitivo del seed.
2. El creador queda registrado y el scope inicial es privado.
3. El juego puede usarse de inmediato por el creador para registrar copias.
4. No puede marcarse directamente como público/aprobado.
5. Una coincidencia de nombre no bloquea automáticamente la creación; puede advertirse sin suplantar moderación.

### E03-ST07 — Crear interfaz de catálogo

**Objetivo:** buscar, ver y seleccionar juegos, además de crear uno privado.

**Criterios de aceptación:**

1. Búsqueda y paginación representan estados de carga, vacío y error.
2. El selector distingue juego de edición.
3. Un juego privado propio está identificado visualmente.
4. La UI no ofrece “publicar” o “aprobar”.
5. La selección produce IDs que la API vuelve a validar; no se confía en el cliente.

## 5. Límites para el agente

- No implementar moderación, merges ni estadísticas de juego.
- No convertir seeds de desarrollo en datos estructurales.
- No hacer público un juego privado por un cambio directo de visibilidad.
- No asumir que el nombre de juego es globalmente único.
- No acoplar el catálogo a la posesión de copias.

## 6. Cierre de la épica

E03 está `DONE` cuando el catálogo visible puede buscarse y consultarse, el usuario puede crear un juego privado seguro y E04 puede referenciar juego y edición sin eludir permisos o visibilidad.
