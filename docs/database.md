# Base de datos local

## Flujo aprobado

```text
schema Drizzle
→ npm run db:generate
→ revisar SQL generado
→ npm run db:migrate
→ npm run db:seed
```

`drizzle-kit push` no forma parte del flujo compartido.

## Primera migración

La primera migración contiene únicamente los catálogos estructurales y las
tablas RBAC independientes de usuarios:

- 29 tablas lookup;
- `roles`;
- `permissions`;
- `role_permissions`.

E03-ST01 formaliza los subconjuntos de `game_classifications`,
`moderation_statuses` y `visibility_levels` necesarios para el catálogo de
juegos. No requiere una migración adicional porque esas tablas forman parte de
la migración base. La política y sus códigos se documentan en
`game-catalog-system-data.md`; `GROUP` permanece disponible para otros dominios
pero no es una visibilidad válida de Game durante E03.

Las tablas funcionales del ERD se incorporan en las historias que implementan
sus invariantes. El DDL del ERD continúa siendo baseline de comparación y no se
ejecuta directamente.

La migración `0001` incorpora `users` y `profiles` para E01-ST02. Sus índices
funcionales hacen que email y username sean únicos sin distinguir mayúsculas,
y la clave primaria compartida de `profiles.user_id` garantiza una relación
uno a uno.

La migración `0002` completa E01-ST03 con `user_roles`; roles, permisos y sus
asignaciones se mantienen mediante los system seeds idempotentes.

La migración `0003` incorpora sesiones opacas para E01-ST04. Solo persiste los
hashes SHA-256 de los tokens de sesión y CSRF, junto con sus vencimientos y
revocación; los tokens originales permanecen fuera de PostgreSQL.

La migración `0004` añade el índice de sesiones por usuario y garantiza que el
vencimiento por inactividad nunca sea posterior al vencimiento absoluto.

La migración `0005` implementa E02-ST01 con `collection_types`,
`collection_statuses`, `collections` y `collection_members`. En esta fase:

- el único tipo permitido y sembrado es `PERSONAL`;
- los estados son `ACTIVE` y `ARCHIVED`, coherentes con `archived_at`;
- las visibilidades admitidas son `PRIVATE` y `PUBLIC`;
- `is_for_sale` permanece forzosamente en `false` hasta E07;
- la clave primaria `(collection_id, user_id)` impide membresías duplicadas;
- existen índices para listar por miembro, creador y estado.

La base garantiza referencias, unicidad y coherencia de archivado. La
invariante «toda ludoteca conserva al menos un `OWNER`» requiere observar el
conjunto completo de membresías y se protege en una transacción del servicio,
no mediante un `CHECK` por fila. E02-ST02 deberá crear la ludoteca y su primera
membresía `OWNER` en la misma transacción; cualquier operación futura sobre
miembros deberá bloquear la ludoteca y comprobar que no queda sin propietario.

La migración `0006` implementa E03-ST02 con `games` y `game_editions`. Separa la
obra general de sus publicaciones, permite juegos sin edición y exige que toda
edición apunte a un juego existente. En esta fase Game admite únicamente scope
`PRIVATE` con propietario o catálogo `PUBLIC` aprobado; `GROUP` queda rechazado
hasta disponer del modelo de grupos. Los constraints de rangos, archivado y FK
restrictivas se detallan en `game-schema.md`.

La migración `0007` implementa E04-ST01 con `copies`,
`copy_collection_history`, `acquisitions` y `audit_logs`. Protege el lifecycle,
la relación entre juego y edición, un único intervalo histórico abierto por
copia y la repetición válida de adquisiciones. El diseño y las invariantes que
permanecen bajo responsabilidad transaccional del servicio se detallan en
`copy-inventory-schema.md`.

## Comandos

Desde la raíz:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
```

`db:seed` ejecuta exclusivamente system seeds y puede repetirse sin duplicar
filas. El catálogo pequeño de E03-ST03 se ejecuta por separado y únicamente
sobre desarrollo:

```powershell
npm.cmd run db:seed:development
```

Este comando exige `NODE_ENV=development`, verifica que la base sea
`ludoteca_dev` y crea mediante UUID estables cuatro juegos y una edición. No se
ejecuta durante el arranque normal, en producción ni al preparar TEST. El
contenido se detalla en `development-game-seed.md`.

## Verificación destructiva protegida de TEST

```powershell
npm.cmd run db:test:setup -w @ludoteca/api
```

Este comando deriva `ludoteca_test` de la conexión local, verifica el nombre
real antes de modificar nada, recrea únicamente su schema `public`, aplica las
migraciones y ejecuta dos veces los system seeds para demostrar idempotencia.
Se niega a reinicializar cualquier base con otro nombre.

La verificación también prueba los constraints de identidad y ludotecas:
duplicados normalizados, perfil único por usuario, membresía única, venta
deshabilitada y archivado sin pérdida de miembros.

Además valida que los catálogos estructurales de Game contienen todos los
códigos operativos definidos por E03-ST01 después de ejecutar dos veces los
seeds.

Para E03-ST02 también inserta juegos privados y públicos válidos, crea una
edición y demuestra que se rechazan scopes de grupo, privados sin propietario,
públicos sin aprobación, rangos inválidos, ediciones huérfanas y el borrado de
un juego referenciado.

Para E04-ST01 verifica los catálogos de inventario, las combinaciones de
lifecycle, que una edición corresponda al juego, el intervalo abierto único,
las adquisiciones históricas múltiples y el soporte de auditoría.

Nunca debe apuntarse este comando a desarrollo, ambientes compartidos o
producción.

## Rollback

Las migraciones compartidas son acumulativas y no se revierten editando SQL ya
aplicado. En desarrollo local, antes de contener datos valiosos, se puede
recrear la base y ejecutar nuevamente migraciones y seeds. En un ambiente con
datos, el rollback se realiza mediante una nueva migración compensatoria o una
restauración validada del backup. El comando `db:test:setup` es la única
recreación automática y está restringido a `ludoteca_test`.
