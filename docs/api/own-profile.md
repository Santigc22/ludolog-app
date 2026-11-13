# Perfil propio

La API obtiene siempre el propietario desde la sesión opaca. Estos endpoints no
aceptan un `userId` del cliente y no permiten modificar identidad, credenciales,
estado de cuenta ni roles.

## `GET /api/v1/profiles/me`

Requiere una sesión válida y un `Origin` igual a `WEB_ORIGIN`. Devuelve
`OwnProfileResponseSchema` con `Cache-Control: no-store`:

```json
{
  "profile": {
    "userId": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "username": "player_one",
    "displayName": "Player One",
    "bio": "Board-game enthusiast",
    "avatarUrl": "https://example.com/avatar.png",
    "avatarMediaId": null,
    "locationText": "Bogotá",
    "visibility": "PUBLIC",
    "createdAt": "2026-09-21T20:00:00.000Z",
    "updatedAt": "2026-09-21T20:15:00.000Z"
  }
}
```

Además de leer el perfil, renueva la actividad de la sesión sin superar su
vencimiento absoluto.

## `PATCH /api/v1/profiles/me`

Requiere sesión, `Origin` permitido y el encabezado `X-CSRF-Token`. Acepta una
actualización parcial mediante `UpdateOwnProfileRequestSchema`:

```json
{
  "displayName": "Player One",
  "bio": "Board-game enthusiast",
  "avatarUrl": "https://example.com/avatar.png",
  "locationText": "Bogotá",
  "visibility": "PUBLIC"
}
```

Campos permitidos:

| Campo | Regla |
|---|---|
| `displayName` | `null` o texto de 1–120 caracteres |
| `bio` | `null` o texto de 1–2000 caracteres |
| `avatarUrl` | `null` o URL HTTP/HTTPS de máximo 2048 caracteres |
| `locationText` | `null` o texto de 1–160 caracteres |
| `visibility` | `PRIVATE` o `PUBLIC` |

Debe enviarse al menos un campo. El contrato es estricto: propiedades como
`email`, `username`, `password`, `status`, `role` o `userId` provocan
`400 VALIDATION_ERROR`; no se ignoran silenciosamente.

La interfaz web utiliza la carga local documentada en [media.md](./media.md),
que devuelve `avatarMediaId` y limpia la URL heredada. `avatarUrl` se conserva
temporalmente en el contrato para compatibilidad con datos anteriores.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Campos ausentes, desconocidos o inválidos |
| `401` | `AUTHENTICATION_REQUIRED` | No existe sesión |
| `401` | `SESSION_INVALID` | La sesión fue revocada o la cuenta no está activa |
| `401` | `SESSION_EXPIRED` | La sesión venció |
| `403` | `CSRF_TOKEN_INVALID` | Token CSRF ausente o incorrecto en `PATCH` |
| `403` | `PERMISSION_DENIED` | Falta el permiso global `profile.update` |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |

## Pruebas automatizadas

Las pruebas verifican lectura autenticada, actualización de todos los campos,
normalización, persistencia, invariancia de email y rol, visibilidad inválida,
URL insegura, campos no permitidos, ausencia de sesión y CSRF incorrecto.
