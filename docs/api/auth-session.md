# Gestión de sesión

Los endpoints de sesión requieren un `Origin` igual a `WEB_ORIGIN`. Las
respuestas sensibles usan `Cache-Control: no-store` y permiten credenciales
únicamente para ese origen.

## `POST /api/v1/auth/login`

Autentica por email y contraseña y crea una sesión opaca nueva.

```json
{
  "email": "player@example.com",
  "password": "una frase suficientemente larga"
}
```

El contrato fuente es `LoginRequestSchema`. El email se normaliza a minúsculas
y la contraseña no se transforma.

La respuesta `200` cumple `SessionResponseSchema`: contiene el usuario y el
token CSRF. También establece:

- `id` en desarrollo o `__Host-id` en producción: token de sesión,
  `HttpOnly`, `SameSite=Lax` y `Secure` en producción;
- `XSRF-TOKEN`: token CSRF legible por la aplicación web para enviarlo como
  `X-CSRF-Token`; PostgreSQL conserva únicamente su hash.

Email inexistente, contraseña incorrecta y cuenta no activa producen el mismo
`401 AUTHENTICATION_FAILED`. Tras cinco fallos por IP e identificador durante
15 minutos se devuelve `429 TOO_MANY_LOGIN_ATTEMPTS`.

## `GET /api/v1/auth/me`

Consulta la cookie de sesión y devuelve el usuario actual según
`CurrentSessionResponseSchema`:

```json
{
  "user": {
    "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "email": "player@example.com",
    "username": "player_one",
    "status": "ACTIVE",
    "roles": ["USER"],
    "profile": {
      "displayName": "Player One",
      "visibility": "PRIVATE"
    }
  }
}
```

`roles` contiene los roles globales vigentes (`USER`, `MODERATOR`,
`CONTENT_MANAGER` o `ADMIN`). Se consulta en cada lectura de sesión para que
los cambios de rol no queden congelados en la cookie. La API continúa
comprobando permisos en cada endpoint protegido; este dato permite adaptar la
navegación, pero no sustituye la autorización del servidor.

Una sesión válida renueva su vencimiento por inactividad sin superar el límite
absoluto de 30 días.

| Estado | Código | Significado |
|---:|---|---|
| `401` | `AUTHENTICATION_REQUIRED` | No existe cookie de sesión |
| `401` | `SESSION_INVALID` | Token desconocido, revocado o cuenta inactiva |
| `401` | `SESSION_EXPIRED` | Venció el límite de inactividad o absoluto |

## `POST /api/v1/auth/logout`

Requiere la cookie de sesión y el encabezado `X-CSRF-Token` con el valor de la
cookie `XSRF-TOKEN`. Revoca la sesión actual, elimina ambas cookies y responde:

```json
{
  "loggedOut": true
}
```

Un token CSRF ausente o incorrecto produce `403 CSRF_TOKEN_INVALID`.

## Pruebas automatizadas

La integración cubre login correcto, errores no enumerables, limitación de
intentos, sesión ausente, válida, expirada y revocada, renovación por actividad,
roles vigentes, validación CSRF y logout.
