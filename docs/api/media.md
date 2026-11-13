# Imágenes administradas

Los endpoints de escritura reciben el archivo como body binario, no como JSON
ni `multipart/form-data`. Se admite `image/jpeg`, `image/png` o `image/webp`.
El límite predeterminado es 8 MiB y puede configurarse con
`MEDIA_MAX_UPLOAD_BYTES`.

## `POST /api/v1/profiles/me/avatar`

Requiere sesión, permiso `profile.update`, origen web y token CSRF. Guarda o
reemplaza el avatar del perfil autenticado. Devuelve
`OwnProfileResponseSchema`; `avatarMediaId` contiene el nuevo identificador y
`avatarUrl` queda en `null`.

## `POST /api/v1/games/:gameId/cover`

Requiere sesión, origen web y token CSRF. Puede ejecutarlo:

- el propietario de un juego privado; o
- una cuenta con `moderation.approve`, mientras el juego está pendiente; o
- una cuenta con `catalog.game.manage`, cuando el juego ya es público.

Devuelve `GameCoverUploadResponseSchema`:

```json
{
  "coverMediaId": "4e145b05-1f8c-4b3f-a535-3c474bb55e95"
}
```

## `GET /api/v1/media/:mediaId?variant=primary|thumbnail`

Sirve el WebP procesado. `variant` es opcional y vale `primary` por defecto.
La sesión es opcional: la API aplica la visibilidad del perfil o juego que
referencia la imagen. Una imagen inexistente o no autorizada responde siempre
`404 MEDIA_NOT_FOUND` para no revelar su existencia.

La respuesta incluye `ETag`, `X-Content-Type-Options: nosniff` y una política
de caché acorde con su visibilidad. `If-None-Match` permite obtener `304`.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `IMAGE_INVALID` | Body vacío o contenido que no es una imagen válida |
| `400` | `VALIDATION_ERROR` | Identificador o variante inválidos |
| `401` | `AUTHENTICATION_REQUIRED` | Escritura sin sesión |
| `403` | `CSRF_TOKEN_INVALID` | Escritura sin token válido |
| `403` | `GAME_COVER_ACCESS_DENIED` | El actor no puede modificar esa portada |
| `413` | `IMAGE_TOO_LARGE` | Archivo superior al límite configurado |
| `415` | `IMAGE_TYPE_UNSUPPORTED` | Content-Type no permitido |
| `404` | `MEDIA_NOT_FOUND` | Imagen ausente o no visible para el actor |

Los contratos públicos están en `@ludoteca/contracts`. La prueba integrada
`apps/api/test/media.test.ts` cubre optimización, reemplazo, privacidad,
publicación, ETag y validación de archivos.

