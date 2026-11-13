# Interfaz web de identidad y perfil

E01-ST08 incorpora el primer recorrido funcional entre Next.js y Express.
Next.js no consulta PostgreSQL ni replica autorización: todas las operaciones
utilizan la API documentada bajo `/api/v1` con `credentials: include`.

## Rutas

| Ruta | Acceso | Función |
|---|---|---|
| `/` | Público | Presentación y estado de la API |
| `/acceso` | Público | Registro e inicio de sesión |
| `/perfil` | Sesión requerida | Consulta, edición del perfil y logout |

La página privada valida la sesión y el perfil al cargar. Una sesión ausente o
expirada muestra una salida segura hacia `/acceso`; no conserva datos privados
en `localStorage`.

La navegación también se adapta a la sesión: oculta `Acceder` al autenticar y
solo muestra `Moderación` cuando `/auth/me` informa un rol `MODERATOR` o
`ADMIN`. Las rutas y endpoints mantienen sus propias comprobaciones de
permisos, independientemente de que un enlace sea visible.

## Formularios

Registro, login y perfil reutilizan los contratos Zod de
`@ludoteca/contracts`. Los controles HTML aportan validación básica y la API
continúa siendo la autoridad final. Los errores se traducen a mensajes útiles
sin revelar existencia de cuentas, SQL, hashes o tokens.

El cliente HTTP:

- incluye cookies en cada llamada;
- valida respuestas con contratos compartidos;
- conserva el código público de error para reaccionar a expiraciones;
- lee `XSRF-TOKEN` únicamente para enviarlo como `X-CSRF-Token` en escrituras.

## Pruebas

Vitest y Testing Library cubren:

- login exitoso y navegación a `/perfil`;
- error de credenciales sin información sensible;
- cambio entre login y registro;
- carga y actualización observable del perfil;
- reacción ante una sesión expirada.
- navegación para visitantes, usuarios normales, moderadores y
  administradores.

Playwright ejecuta en Chromium el flujo real:

```text
registro → sesión → perfil privado → edición → logout
```

`npm run test:e2e` reconstruye `ludoteca_test`, genera el build de producción,
inicia API y web en procesos aislados y los cierra al terminar.
