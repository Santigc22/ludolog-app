# Registro de usuario

## `POST /api/v1/auth/register`

Crea atómicamente la cuenta, su perfil privado, el rol base `USER` y una sesión
opaca. No requiere una sesión previa, pero sí un `Origin` igual a `WEB_ORIGIN`.

## Solicitud

`Content-Type: application/json`

```json
{
  "email": "player@example.com",
  "username": "player_one",
  "password": "una frase suficientemente larga",
  "displayName": "Player One"
}
```

El contrato fuente es `RegisterRequestSchema` de `@ludoteca/contracts`:

- `email`: email válido, máximo 320 caracteres; se normaliza a minúsculas;
- `username`: 3–80 caracteres alfanuméricos, `_` o `-`; se normaliza a
  minúsculas;
- `password`: 15–128 caracteres, sin recorte ni reglas de composición;
- `displayName`: opcional, 1–120 caracteres después de recortar bordes.

## Respuesta `201`

La respuesta establece la cookie de sesión `id` en desarrollo o `__Host-id` en
producción. Es `HttpOnly`, `SameSite=Lax`, usa `Path=/` y en producción también
`Secure`. También establece `XSRF-TOKEN`, legible por la aplicación web y
ligada a la sesión mediante su hash. Ni la contraseña, ni su hash, ni el token
de sesión aparecen en JSON.

```json
{
  "user": {
    "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "email": "player@example.com",
    "username": "player_one",
    "status": "ACTIVE",
    "profile": {
      "displayName": "Player One",
      "visibility": "PRIVATE"
    }
  },
  "csrfToken": "token-opaco-para-operaciones-de-escritura"
}
```

El cuerpo se valida mediante `RegisterResponseSchema` y la respuesta incluye
`Cache-Control: no-store`.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | El body no cumple el contrato |
| `403` | `ORIGIN_NOT_ALLOWED` | El origen no coincide con `WEB_ORIGIN` |
| `409` | `IDENTITY_ALREADY_EXISTS` | Email o username ya están registrados |
| `500` | `INTERNAL_SERVER_ERROR` | Error inesperado sin detalles sensibles |

## Prueba manual opcional

Con la API ejecutándose en el puerto configurado:

```powershell
$body = @{
  email = "tu-correo@example.com"
  username = "tu_usuario"
  password = "reemplaza-por-tu-frase-larga"
  displayName = "Tu nombre"
} | ConvertTo-Json

Invoke-WebRequest `
  -Method Post `
  -Uri "http://localhost:3001/api/v1/auth/register" `
  -Headers @{ Origin = "http://localhost:3000" } `
  -ContentType "application/json" `
  -Body $body `
  -SessionVariable session
```

No es necesario ejecutar esta prueba para completar la historia; las pruebas de
integración crean y eliminan sus propios usuarios en `ludoteca_test`.

## Pruebas automatizadas

- validación y normalización del contrato compartido;
- creación atómica de cuenta, perfil, rol y sesión;
- hash Argon2id y ausencia de secretos en la respuesta;
- cookie segura y hash del token persistido;
- conflicto estable para identificadores duplicados;
- rechazo de entrada inválida y origen no permitido.
