# Middleware de autenticación y permisos

E01-ST07 introduce primitivas de acceso reutilizables en Express. La API sigue
una secuencia explícita y deniega por defecto:

```text
Origin → requireAuth → requirePermission(code) → requireCsrf → controller → service
```

No todas las rutas necesitan cada paso: CSRF se aplica a operaciones de
escritura basadas en cookie y `requirePermission` solo cuando existe un permiso
global asociado.

## `requireAuth`

- Lee exclusivamente la cookie opaca de sesión.
- Busca su hash en PostgreSQL.
- Rechaza sesiones ausentes, desconocidas, revocadas, expiradas o pertenecientes
  a una cuenta no activa.
- Renueva la actividad sin superar la expiración absoluta.
- Adjunta a `request.auth` el usuario y la sesión ya validados.

Errores públicos: `401 AUTHENTICATION_REQUIRED`, `401 SESSION_INVALID` y
`401 SESSION_EXPIRED`.

## `optionalAuth`

- Sin cookie, continúa como solicitud anónima.
- Con cookie, exige que la sesión sea válida y adjunta `request.auth`.
- Una cookie inválida o vencida produce `401`; no se degrada silenciosamente a
  acceso anónimo.

Se utiliza en lecturas que admiten contenido público pero pueden ampliar la
respuesta según membresía, como el detalle de una ludoteca.

## `requirePermission(code)`

- Requiere que `requireAuth` haya creado `request.auth`.
- Consulta el permiso efectivo mediante `user_roles` y `role_permissions`.
- Recibe códigos estables, por ejemplo `profile.update`.
- No contiene comparaciones contra roles concretos como `ADMIN`.
- Devuelve `403 PERMISSION_DENIED` cuando el usuario autenticado no tiene el
  permiso solicitado.

## Ownership

RBAC no concede acceso automático a todos los recursos de un tipo. El
middleware comprueba únicamente capacidad global; el service o política del
módulo debe comprobar ownership, membresía, visibilidad y estado del recurso.

En el perfil propio, por ejemplo, `requirePermission("profile.update")`
comprueba la capacidad, mientras que el controller entrega al service el
`userId` autenticado y nunca acepta un propietario desde el body.

## `requireCsrf`

Para operaciones de escritura con sesión, compara en tiempo constante el
encabezado `X-CSRF-Token` con el hash asociado a la sesión. Un valor ausente o
incorrecto produce `403 CSRF_TOKEN_INVALID`.

## Pruebas

Las pruebas de middleware cubren:

- acceso permitido con permiso efectivo;
- sesión ausente (`401`);
- usuario autenticado sin permiso (`403`);
- independencia explícita entre permiso global y ownership;
- uso real de los middlewares en sesión y perfil propio.
