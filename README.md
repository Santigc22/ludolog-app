# Ludoteca Virtual

Monorepo de la aplicación Ludoteca Virtual. La primera vertical permitirá
gestionar un usuario, sus ludotecas personales, juegos de catálogo, copias
físicas y movimientos con historial.

## Arquitectura

```text
Navegador → Next.js → Express API → PostgreSQL
                            └──────→ imágenes locales
```

- `apps/api`: Express 5, reglas de negocio y acceso exclusivo a PostgreSQL.
- `apps/web`: Next.js 16 con App Router.
- `packages/contracts`: contratos públicos compartidos con Zod 4.
- `packages/config`: reservado para configuración compartida con consumidores
  reales.
- `docs`: dominio, arquitectura, ADR, épicas y documentación HTTP.

El monorepo utiliza npm workspaces y conserva un único `package-lock.json` en
la raíz.

## Requisitos locales

- Git.
- Node.js 24 LTS.
- npm 11 o superior.
- PostgreSQL 18.
- Dos bases locales: `ludoteca_dev` y `ludoteca_test`.
- Un rol sin privilegios administrativos: `ludoteca_app`.

Verifica las herramientas:

```powershell
git --version
node --version
npm.cmd --version
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version
```

## Preparación desde un clon limpio

### 1. Instalar dependencias

Desde la raíz del repositorio:

```powershell
npm.cmd ci
```

Utiliza `npm install` solamente cuando estés modificando dependencias y debas
actualizar el lockfile.

### 2. Crear el rol y las bases

Conéctate a PostgreSQL 18 como administrador. Ajusta el puerto si tu instalación
no utiliza `5433`:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -U postgres `
  -h localhost `
  -p 5433 `
  -d postgres
```

Dentro de `psql`:

```sql
CREATE ROLE ludoteca_app WITH LOGIN;
\password ludoteca_app

CREATE DATABASE ludoteca_dev OWNER ludoteca_app;
CREATE DATABASE ludoteca_test OWNER ludoteca_app;
```

Si el rol o las bases ya existen, no vuelvas a crearlos. Verifica el servidor y
puerto con:

```sql
SELECT version(), inet_server_port();
```

### 3. Configurar variables locales

Copia el ejemplo:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y sustituye los marcadores. Ejemplo de estructura, sin
credenciales reales:

```dotenv
NODE_ENV=development
API_PORT=3001
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
DATABASE_URL=postgresql://ludoteca_app:CHANGE_ME_LOCAL@localhost:5433/ludoteca_dev
TEST_DATABASE_URL=postgresql://ludoteca_app:CHANGE_ME_LOCAL@localhost:5433/ludoteca_test
MEDIA_STORAGE_PATH=.data/media
MEDIA_MAX_UPLOAD_BYTES=8388608
```

Si la contraseña contiene caracteres reservados de URL, codifícala. `.env`
está ignorado por Git y nunca debe versionarse.

### 4. Migrar y sembrar desarrollo

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:seed:development
```

Los system seeds y el catálogo pequeño de desarrollo son idempotentes. El
último comando es explícito, exige `NODE_ENV=development` y solo acepta
`ludoteca_dev`; nunca se ejecuta implícitamente.

### 5. Preparar la base de pruebas

```powershell
npm.cmd run db:test:setup
```

> Este comando elimina y reconstruye el schema `public` de `ludoteca_test`.
> Rechaza cualquier URL que no apunte exactamente a esa base.

### 6. Iniciar API y web

```powershell
npm.cmd run dev
```

Servicios locales:

- Web: <http://localhost:3000>
- API: <http://localhost:3001/api/v1>
- Health HTTP: <http://localhost:3001/api/v1/health>
- Health PostgreSQL: <http://localhost:3001/api/v1/health/database>

También pueden iniciarse por separado:

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

## Calidad y pruebas

Desde la raíz:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:coverage
npm.cmd run build
```

Para aplicar el formato aprobado:

```powershell
npm.cmd run format
```

Las pruebas API utilizan exclusivamente `TEST_DATABASE_URL`. Consulta
[Pruebas y calidad](docs/testing-and-quality.md).

La interfaz de identidad está disponible en <http://localhost:3000/acceso>, el
perfil autenticado en <http://localhost:3000/perfil>, las ludotecas personales
en <http://localhost:3000/ludotecas> y el catálogo de juegos en
<http://localhost:3000/catalogo>. La cola para cuentas `MODERATOR` o `ADMIN`
está en <http://localhost:3000/moderacion>.

## Migraciones

El schema Drizzle es la fuente técnica del esquema implementado. Cuando una
historia autorice un cambio:

```powershell
npm.cmd run db:generate
```

Después se debe:

1. revisar el SQL generado;
2. comparar constraints, índices y defaults con el ERD/ADR;
3. probar la migración sobre `ludoteca_test`;
4. aplicar mediante `npm.cmd run db:migrate`.

No se utiliza `drizzle-kit push` en bases compartidas ni se reescriben
migraciones ya aplicadas.

## Documentación

- [Plan maestro](docs/ludoteca_virtual_plan_desarrollo.md)
- [Arquitectura](docs/ludoteca_virtual_arquitectura_aplicacion.md)
- [Configuración](docs/configuration.md)
- [Pruebas y calidad](docs/testing-and-quality.md)
- [Interfaz de ludotecas](docs/collections-web.md)
- [Interfaz del catálogo](docs/game-catalog-web.md)
- [Moderación de juegos](docs/game-moderation-web.md)
- [Imágenes locales](docs/local-media-storage.md)
- [Esquema de copias e historial](docs/copy-inventory-schema.md)
- [API HTTP](docs/api/README.md)
- [Guía de inicialización detallada](docs/ludoteca_virtual_guia_inicializacion_repo.md)

Cada endpoint debe mantener documentados método, ruta, acceso, entrada,
respuesta, errores, contrato Zod y pruebas relacionadas.

## Problemas frecuentes

### PowerShell bloquea `npm.ps1`

Utiliza `npm.cmd` como muestran los ejemplos. No es necesario cambiar la
política global de PowerShell.

### `psql` abre PostgreSQL 16

Usa explícitamente el binario de PostgreSQL 18 y confirma `version()` y
`inet_server_port()` antes de crear objetos.

### La API falla al iniciar

Comprueba que todas las variables de `.env` existan y que sus URLs sean
válidas. Los errores identifican la variable, pero no imprimen secretos.

### Database health responde `503`

Comprueba que PostgreSQL 18 esté iniciado, que el puerto de `DATABASE_URL` sea
correcto y que `ludoteca_app` tenga acceso a `ludoteca_dev`.

### Las pruebas rechazan la base

`TEST_DATABASE_URL` debe apuntar exactamente a `ludoteca_test`. Esta protección
evita limpiar accidentalmente desarrollo.

### El puerto 3000 o 3001 está ocupado

Detén el proceso que ya utiliza el puerto. Si cambias `API_PORT`, actualiza
también `NEXT_PUBLIC_API_URL` y `WEB_ORIGIN` según corresponda.

## Alcance operativo actual

El proyecto se ejecuta localmente. Hosting, contenedores, dominio, CI/CD
externo y servicios cloud permanecen fuera del alcance de E00.
