# Development seeds

Contiene el catálogo mínimo controlado y cuentas locales para pruebas manuales.
Nunca se ejecuta durante el arranque normal ni mediante `npm run db:seed`.

Desde la raíz se aplica explícitamente con:

```powershell
npm.cmd run db:seed:development
```

El comando se niega a operar salvo que `NODE_ENV=development` y la conexión
apunte exactamente a `ludoteca_dev`. Usa UUID estables y upserts
transaccionales, por lo que puede repetirse sin duplicar juegos o ediciones.

## Cuentas locales

Todas usan la contraseña `LudotecaDev2026!` y solo existen en `ludoteca_dev`.

| Correo                     | Rol global        | Rol en principal | Rol en secundaria |
| -------------------------- | ----------------- | ---------------- | ----------------- |
| `admin@ludoteca.local`     | `ADMIN`           | `OWNER`          | `MANAGER`         |
| `usuario@ludoteca.local`   | `USER`            | `MANAGER`        | `OWNER`           |
| `moderador@ludoteca.local` | `MODERATOR`       | `VIEWER`         | `VIEWER`          |
| `contenido@ludoteca.local` | `CONTENT_MANAGER` | `MEMBER`         | `MEMBER`          |

Las dos ludotecas compartidas permiten comparar capacidades de lectura y
escritura. Un rol global elevado no omite la membresía ni el rol interno que la
API exige para cada recurso.
