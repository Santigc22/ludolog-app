# Imágenes locales

La aplicación guarda portadas de juegos y avatares en el disco de la máquina
que ejecuta la API. No necesita Google Drive, S3 ni una suscripción externa.

## Diseño

- PostgreSQL guarda el identificador, propósito, claves de objeto, dimensiones,
  tamaño y checksum de cada imagen.
- El contenido binario se guarda bajo `MEDIA_STORAGE_PATH` mediante la interfaz
  interna `ObjectStorage`.
- La implementación actual es `LocalObjectStorage`. Sustituirla por S3 en el
  futuro no requiere cambiar los contratos web ni las referencias de base de
  datos.
- `.data/` está ignorado por Git para evitar versionar imágenes personales.

Con la configuración predeterminada y los comandos npm del repositorio, los
archivos se crean en `apps/api/.data/media`. Puede utilizarse una ruta absoluta
para ubicarlos en otro disco:

```dotenv
MEDIA_STORAGE_PATH=D:/Ludoteca/media
MEDIA_MAX_UPLOAD_BYTES=8388608
```

## Procesamiento

La API acepta JPG, PNG y WebP de hasta 8 MiB por defecto. `sharp` corrige la
orientación, elimina metadatos y genera WebP:

| Uso | Imagen principal | Miniatura | Ajuste |
|---|---:|---:|---|
| Avatar | 512 × 512 | 128 × 128 | recorte cuadrado centrado |
| Portada | hasta 800 × 1000 | hasta 320 × 400 | conserva proporción |

Al reemplazar una imagen se actualiza la referencia de forma transaccional y se
eliminan el registro y los archivos anteriores.

## Privacidad y acceso

- El avatar privado solo lo puede leer su propietario o moderación.
- La portada de un juego privado solo la pueden leer su propietario o
  moderación.
- Los avatares de perfiles públicos y portadas de juegos globales aprobados se
  sirven públicamente.
- Los recursos privados usan `Cache-Control: private, no-store`; los públicos
  pueden almacenarse en caché porque cada reemplazo obtiene un identificador
  nuevo.

## Copias de seguridad

Una copia de seguridad completa necesita PostgreSQL y el directorio indicado
por `MEDIA_STORAGE_PATH`. Ambos deben restaurarse de forma coherente. Copiar
solo uno de ellos deja referencias o archivos sin su contraparte.

