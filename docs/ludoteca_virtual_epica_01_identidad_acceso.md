# Ludoteca Virtual — E01: Identidad y acceso

**Estado de la épica:** `DONE`  
**Dependencia:** E00  
**Gate principal:** `G01 — estrategia de autenticación y sesión`  
**Resultado esperado:** usuarios autenticados con perfil separado y autorización RBAC reutilizable.

## 1. Propósito y límites

Implementar la identidad mínima sobre la cual dependerán ludotecas, ownership, auditoría y contenido privado.

No incluye grupos, follows, bloqueos sociales, administración completa de usuarios, OAuth ni recuperación de cuenta salvo que `G01` los incorpore expresamente.

## 2. Reglas trazadas

| Regla | Aplicación en esta épica |
|---|---|
| R-USER-01 | La cuenta es única y estable |
| R-USER-02 | Cuenta y perfil se modelan por separado |
| R-USER-03 | El perfil puede tener visibilidad propia |
| R-USER-04 | La desactivación no destruye históricos |
| R-USER-07 | Acciones sensibles requieren autenticación |
| Regla transversal RBAC | Permiso global más acceso al recurso; RBAC no sustituye ownership |

Fuente normativa: `ludoteca_virtual_dominio_reglas.md`.

## 3. Features e historias

| Historia | Feature | Depende de | Estado actual |
|---|---|---|---|
| E01-ST01 | Decidir autenticación y sesión | E00 | `DONE` — ADR-005 aceptada |
| E01-ST02 | Persistir usuarios y perfiles | E00-ST07; G04 resuelto | `DONE` |
| E01-ST03 | Persistir RBAC y semillas | E00-ST07 | `DONE` |
| E01-ST04 | Registrar usuario | ST01–ST03 | `DONE` |
| E01-ST05 | Iniciar/cerrar sesión y consultar sesión | ST01, ST02, ST04 | `DONE` |
| E01-ST06 | Consultar y editar perfil propio | ST02, ST05 | `DONE` |
| E01-ST07 | Middleware de autenticación y permisos | ST03, ST05 | `DONE` |
| E01-ST08 | Interfaz de acceso y perfil | ST04–ST07 | `DONE` |

## 4. Historias detalladas

### E01-ST01 — Decidir autenticación y sesión

**Tipo:** historia de decisión; no autoriza implementación.

**Objetivo:** cerrar el mecanismo antes de modelar tokens, cookies o credenciales.

**Debe resolver:**

- autenticación propia o proveedor externo;
- credencial inicial permitida;
- sesión con cookie segura o tokens;
- duración, renovación y revocación;
- protección CSRF si aplica;
- almacenamiento de secretos y política mínima de contraseñas si aplica;
- comportamiento local de registro, login y logout.

**Entregable:** ADR aprobado que actualice arquitectura y contratos afectados.

**Criterio de aceptación:** no queda ninguna elección de seguridad crítica implícita.

**Regla de parada:** un agente no debe inferir que `password_hash` en el ERD obliga a autenticación propia; el ERD puede ajustarse después del ADR.

### E01-ST02 — Persistir usuarios y perfiles

**Objetivo:** crear el esquema mínimo conforme al ERD vigente y al ADR de autenticación.

**Alcance:** tablas/catálogos de estado de cuenta, `users` y `profiles`; índices y restricciones; migración; mapeo Drizzle.

**Criterios de aceptación:**

1. Cada usuario tiene como máximo un perfil y cada perfil pertenece a un usuario.
2. Identificadores públicos definidos como únicos rechazan duplicados normalizados.
3. La desactivación conserva la fila y sus relaciones históricas.
4. Los campos de credenciales siguen exactamente `G01`.
5. Migración desde base vacía y rollback lógico/documentado son verificables.

### E01-ST03 — Persistir RBAC y semillas

**Objetivo:** representar roles y permisos atómicos sin mezclar acceso a recursos concretos.

**Alcance:** `roles`, `permissions`, `user_roles`, `role_permissions` y seeds estructurales idempotentes.

**Criterios de aceptación:**

1. Existen roles base `USER`, `MODERATOR` y `ADMIN` o los equivalentes aprobados en seeds.
2. Los permisos usan códigos estables como `collection.update` y `moderation.approve`.
3. No se codifican listas de permisos dispersas en controladores.
4. Asignar un permiso no concede por sí solo acceso a todos los recursos de ese tipo.

### E01-ST04 — Registrar un usuario

**Objetivo:** crear cuenta y perfil mínimo de forma atómica.

**Alcance:** contrato, endpoint, servicio, repositorio y pruebas; asignación del rol base.

**Criterios de aceptación:**

1. La entrada se valida con contrato compartido.
2. Cuenta, perfil y rol base se crean en una sola transacción.
3. Conflictos de identificadores producen un error público estable, no un detalle SQL.
4. Los secretos nunca se devuelven ni registran.
5. La respuesta sigue el mecanismo de sesión decidido en G01.

### E01-ST05 — Gestionar sesión

**Objetivo:** permitir login, logout y consulta del usuario actual.

**Criterios de aceptación:**

1. Credenciales válidas crean o recuperan una sesión según G01.
2. Credenciales inválidas no revelan qué identificador existe.
3. Logout invalida la sesión en el alcance definido.
4. `GET /api/v1/auth/me` distingue sesión válida, ausente y expirada.
5. Las protecciones de cookie, CORS y CSRF coinciden con el ADR.

### E01-ST06 — Consultar y editar el perfil propio

**Objetivo:** mantener datos públicos/personales sin modificar identidad o roles accidentalmente.

**Criterios de aceptación:**

1. Solo campos permitidos del perfil pueden modificarse.
2. Cambiar perfil no modifica email, credenciales, roles ni estado de cuenta.
3. La visibilidad acepta solo valores compatibles con perfiles.
4. Lectura y escritura respetan autenticación y ownership.

### E01-ST07 — Implementar middleware de acceso

**Objetivo:** ofrecer primitivas reutilizables `requireAuth` y `requirePermission`.

**Criterios de aceptación:**

1. Rutas protegidas rechazan sesiones ausentes o inválidas de manera uniforme.
2. `requirePermission(code)` consulta la asignación efectiva sin codificar roles concretos.
3. La API distingue autenticación (`401`) de falta de autorización (`403`).
4. El middleware no decide ownership de una ludoteca; esa verificación queda en el servicio/política del módulo.
5. Existen pruebas para permitido, no autenticado y sin permiso.

### E01-ST08 — Crear interfaz de acceso y perfil

**Objetivo:** exponer registro/login/logout y edición de perfil desde Next.js.

**Criterios de aceptación:**

1. Formularios reutilizan contratos compartidos donde corresponda.
2. Errores de validación y servidor se muestran sin revelar información sensible.
3. Las rutas privadas reaccionan correctamente a una sesión expirada.
4. La web llama a Express y no a PostgreSQL.
5. Existe una prueba del flujo principal acordada en G02.

## 5. Reglas de implementación para agentes

- No instalar una librería de autenticación antes de ST01.
- No crear autorización paralela en Next.js que sustituya la validación de Express.
- No mezclar `Profile` con claims de permisos.
- No borrar físicamente usuarios que ya tengan referencias.
- Cualquier cambio a la estrategia de sesión exige actualizar el ADR antes del código.

## 6. Cierre de la épica

E01 está `DONE` cuando un usuario puede registrarse, autenticarse, cerrar sesión, consultar/editar su perfil y atravesar middleware RBAC probado, manteniendo separadas cuenta, perfil, permisos y ownership.
