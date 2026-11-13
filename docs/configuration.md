# Configuración local

Las aplicaciones utilizan un único archivo `.env` local en la raíz del
monorepo. El archivo está ignorado por Git y se crea a partir de
`.env.example`.

## Variables de la API

| Variable | Uso |
|---|---|
| `NODE_ENV` | Ambiente: `development`, `test` o `production` |
| `API_PORT` | Puerto HTTP entre 1 y 65535 |
| `WEB_ORIGIN` | Origen HTTP(S) permitido para la aplicación web |
| `DATABASE_URL` | Conexión PostgreSQL privada de Express |
| `MEDIA_STORAGE_PATH` | Directorio local para avatares y portadas procesadas |
| `MEDIA_MAX_UPLOAD_BYTES` | Tamaño máximo del body de una imagen; 8 MiB por defecto |

La API carga y valida estas variables al importar su configuración. Los
mensajes de error identifican el nombre inválido, pero no imprimen el valor ni
la cadena de conexión.

## Variable pública de la web

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública base de Express, incluida `/api/v1` |

Solo las variables con prefijo `NEXT_PUBLIC_` pueden formar parte del bundle
del navegador. Next.js no accede a `DATABASE_URL`.

## Puertos locales esperados

```text
Web: http://localhost:3000
API: http://localhost:3001/api/v1
```

El puerto de PostgreSQL forma parte de `DATABASE_URL` y puede variar por
máquina. En el entorno local actual PostgreSQL 18 utiliza `5433`.

Consulta [Imágenes locales](local-media-storage.md) para almacenamiento,
procesamiento, privacidad y copias de seguridad.
