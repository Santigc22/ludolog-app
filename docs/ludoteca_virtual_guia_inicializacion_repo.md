# Ludoteca Virtual — Guía de inicialización del repositorio

**Estado:** guía operativa v1.1  
**Fecha:** 21 de septiembre de 2026  
**Aplica a:** E00 — Fundación técnica local  
**Gestor del monorepo:** npm workspaces  
**Ejecución actual:** local, sin hosting ni servicios cloud

## 1. Propósito

Esta guía indica qué debe instalarse, desde qué directorio debe ejecutarse cada
comando y qué estructura debe existir antes de asignar trabajo a un agente.

No reemplaza la arquitectura ni los ADR. Si aparece una contradicción, se
aplica este orden:

1. reglas funcionales del dominio;
2. arquitectura y ADR vigentes;
3. historia asignada;
4. esta guía operativa.

Documentos relacionados:

- `ludoteca_virtual_arquitectura_aplicacion.md`;
- `ludoteca_virtual_adr_001_datos_validacion.md`;
- `ludoteca_virtual_adr_002_npm_workspaces.md`;
- `ludoteca_virtual_epica_00_fundacion_tecnica.md`;
- `ludoteca_virtual_guia_trabajo_agentes.md`.

## 2. Decisiones aplicadas

| Tema | Decisión |
|---|---|
| Runtime | Node.js 24 LTS |
| Paquetes | npm workspaces, un solo `package-lock.json` raíz |
| Backend | Express 5 + TypeScript |
| Frontend | Next.js 16, App Router + TypeScript |
| Contratos | Zod 4 en `packages/contracts` |
| Datos | PostgreSQL 18 instalado localmente en Windows |
| Acceso a datos | Drizzle ORM + `pg`, internos de `apps/api` |
| Desarrollo conjunto | `concurrently` desde el script raíz `npm run dev` |
| Hosting | Fuera de alcance |

### Aclaración sobre la base de datos

No se crea `packages/database`. Solo Express puede acceder a PostgreSQL, por lo
que conexión, schema y migraciones viven bajo:

```text
apps/api/src/infrastructure/database/
```

`apps/web` y `packages/contracts` nunca importan esa infraestructura.

### Drizzle estable

La documentación oficial de Drizzle muestra actualmente una versión candidata
v1 mediante el tag `@rc`. Este proyecto no instalará una versión candidata sin
una decisión explícita. Los comandos de esta guía usan el canal estable y el
`package-lock.json` conservará las versiones resueltas.

## 3. Software necesario en la máquina

Instalar antes de clonar o crear el repositorio:

| Herramienta | Requisito | Uso |
|---|---|---|
| Git | versión estable vigente | Control de versiones |
| Node.js | 24 LTS recomendado | API, web y tooling |
| npm | incluido con Node; versión 11 o superior | Workspaces y dependencias |
| PostgreSQL | versión 18 para Windows | Base de datos local |
| pgAdmin | incluido en el instalador; opcional para operar | Administración gráfica de PostgreSQL |
| Editor | VS Code recomendado, no obligatorio | Desarrollo |

No es necesario instalar globalmente Express, Next.js, TypeScript, Drizzle,
Zod, `tsx` ni `concurrently`.

### Verificación previa

**Ubicación:** cualquier directorio.

```bash
git --version
node --version
npm --version
psql --version
```

Resultado esperado:

- Node muestra `v24.x` preferiblemente;
- npm muestra `11.x` o superior;
- `psql` muestra PostgreSQL 18.x.

Si Windows no reconoce `psql`, puede utilizarse **SQL Shell (psql)** desde el
menú Inicio o agregarse temporalmente al `PATH` de PowerShell:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
psql --version
```

El proyecto añade `.nvmrc` con `24`. No se debe usar una versión Current o EOL
solo porque esté instalada localmente.

## 4. Estructura objetivo inicial

```text
ludoteca-virtual/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── errors/
│   │   │   ├── infrastructure/
│   │   │   │   └── database/
│   │   │   ├── middleware/
│   │   │   ├── modules/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── drizzle/
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   └── lib/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── contracts/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── config/
│       └── package.json
├── docs/
├── .env.example
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── README.md
```

`packages/test-utils` se crea únicamente al resolver G02 y comenzar E00-ST09.
No se crean carpetas de módulos vacías para aparentar avance.

## 5. Dos niveles de inicialización

La preparación se divide para no adelantar historias:

### Nivel A — Preparación manual del repositorio

Deja Git, npm workspaces, carpetas, package manifests y scripts raíz listos.
Corresponde a E00-ST01 y puede hacerse antes de asignar un agente.

### Nivel B — Instalación por historia

Express, Next.js, Zod y Drizzle se instalan cuando el agente recibe E00-ST02 a
E00-ST06. La persona que prepara el repositorio no debe ejecutar todos los
comandos futuros si el propósito es asignar historias separadas.

## 6. Nivel A — Crear el repositorio y los workspaces

### 6.1 Crear o clonar el repositorio

Si todavía no existe un repositorio remoto:

**Ubicación:** carpeta padre donde vivirá el proyecto.

```bash
mkdir ludoteca-virtual
cd ludoteca-virtual
git init -b main
```

Si el repositorio remoto ya existe:

```bash
git clone <URL_DEL_REPOSITORIO> ludoteca-virtual
cd ludoteca-virtual
```

Todos los comandos siguientes se ejecutan desde la raíz `ludoteca-virtual/`,
salvo que se indique otra ubicación.

### 6.2 Crear el `package.json` raíz

```bash
npm init -y
npm pkg set name=ludoteca-virtual version=0.0.0 type=module license=UNLICENSED
npm pkg set private=true --json
npm pkg set "workspaces[0]=apps/*" "workspaces[1]=packages/*"
npm pkg set "engines.node=>=24 <25" "engines.npm=>=11"
npm pkg delete main scripts.test
```

El resultado debe contener, como mínimo:

```json
{
  "name": "ludoteca-virtual",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": {
    "node": ">=24 <25",
    "npm": ">=11"
  }
}
```

### 6.3 Crear directorios de workspace

Este comando Node es equivalente en Windows, macOS y Linux:

```bash
node -e "['apps/api','apps/web','packages/contracts','packages/config','docs'].forEach(p=>require('fs').mkdirSync(p,{recursive:true}))"
```

### 6.4 Inicializar manifests de los workspaces

```bash
npm init -y -w apps/api
npm init -y -w apps/web
npm init -y -w packages/contracts
npm init -y -w packages/config
```

Asignar nombres estables:

```bash
npm pkg set name=@ludoteca/api version=0.0.0 type=module -w apps/api
npm pkg set private=true --json -w apps/api

npm pkg set name=@ludoteca/web version=0.0.0 -w apps/web
npm pkg set private=true --json -w apps/web

npm pkg set name=@ludoteca/contracts version=0.0.0 type=module -w packages/contracts
npm pkg set private=true --json -w packages/contracts

npm pkg set name=@ludoteca/config version=0.0.0 type=module -w packages/config
npm pkg set private=true --json -w packages/config
npm pkg delete scripts.test main --workspaces
```

Después de cada bloque debe revisarse el `package.json` afectado. `--json` se
usa únicamente para persistir `private` como booleano, no como texto.

### 6.5 Instalar tooling raíz mínimo

```bash
npm install --save-dev concurrently typescript
```

Estas dependencias pertenecen a la raíz porque coordinan todos los workspaces y
fijan una versión única del compilador.

### 6.6 Definir scripts raíz

```bash
npm pkg set "scripts.dev=concurrently --kill-others-on-fail --names api,web \"npm:dev:api\" \"npm:dev:web\""
npm pkg set "scripts.dev:api=npm run dev -w @ludoteca/api"
npm pkg set "scripts.dev:web=npm run dev -w @ludoteca/web"
npm pkg set "scripts.build=npm run build -w @ludoteca/contracts && npm run build -w @ludoteca/api && npm run build -w @ludoteca/web"
npm pkg set "scripts.typecheck=npm run typecheck --workspaces --if-present"
npm pkg set "scripts.lint=npm run lint --workspaces --if-present"
npm pkg set "scripts.test=npm run test --workspaces --if-present"
npm pkg set "scripts.db:generate=npm run db:generate -w @ludoteca/api"
npm pkg set "scripts.db:migrate=npm run db:migrate -w @ludoteca/api"
npm pkg set "scripts.db:seed=npm run db:seed -w @ludoteca/api"
```

Los scripts delegados pueden no funcionar todavía: sus implementaciones
pertenecen a historias posteriores. No se deben añadir comandos falsos como
`echo tests passed`.

### 6.7 Archivos raíz obligatorios

El agente de E00-ST01 debe crear:

- `.nvmrc` con `24`;
- `.gitignore` con `node_modules`, `.next`, `dist`, coverage, `.env*` y una
  excepción para `.env.example`;
- `.env.example` sin secretos reales;
- `tsconfig.base.json` con TypeScript estricto;
- `README.md` con el mapa del monorepo.

No se debe versionar `.env`.

## 7. PostgreSQL local — cierre de G03

Se adopta PostgreSQL 18 instalado directamente en Windows. Docker no forma
parte de los requisitos del proyecto y un agente no debe añadir `Dockerfile`,
`compose.yaml` ni instrucciones de contenedores sin una decisión posterior.

La aplicación continúa dependiendo únicamente de `DATABASE_URL`. Cambiar en
el futuro a un contenedor o a PostgreSQL administrado no debe exigir cambios en
las reglas de negocio.

### 7.1 Instalar PostgreSQL en Windows

1. Abrir la [página oficial de PostgreSQL para
   Windows](https://www.postgresql.org/download/windows/).
2. Descargar el instalador interactivo de EDB para PostgreSQL 18 de 64 bits.
3. Instalar como mínimo:
   - PostgreSQL Server;
   - Command Line Tools;
   - pgAdmin 4, recomendado pero opcional.
4. Mantener el puerto estándar `5432`, salvo que ya esté ocupado.
5. Definir una contraseña local para el superusuario `postgres` y guardarla
   fuera del repositorio.
6. Mantener el locale predeterminado si no existe una necesidad concreta.
7. StackBuilder es opcional y no es necesario para este proyecto.

El instalador registra PostgreSQL como servicio de Windows y normalmente lo
inicia automáticamente.

### 7.2 Comprobar el servicio

Desde PowerShell:

```powershell
Get-Service -Name "postgresql*"
```

El estado esperado es `Running`. También puede verificarse la conexión mediante
SQL Shell:

```bash
psql -U postgres -h localhost -p 5432
```

### 7.3 Crear usuario y bases locales

Dentro de `psql`, conectado como `postgres`:

```sql
CREATE ROLE ludoteca_app WITH LOGIN PASSWORD 'CHANGE_ME_LOCAL';
CREATE DATABASE ludoteca_dev OWNER ludoteca_app;
CREATE DATABASE ludoteca_test OWNER ludoteca_app;
```

Después, salir mediante:

```text
\q
```

`CHANGE_ME_LOCAL` es un marcador. La contraseña real debe existir únicamente
en el `.env` local y no debe reutilizarse en ningún ambiente remoto.

Verificación:

```bash
psql -U ludoteca_app -h localhost -p 5432 -d ludoteca_dev -c "SELECT current_database(), current_user;"
```

El usuario de la aplicación no necesita ser superusuario.

### 7.4 Configurar la aplicación

Valor de desarrollo para `.env.example`:

```dotenv
NODE_ENV=development
API_PORT=3001
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
DATABASE_URL=postgresql://ludoteca_app:CHANGE_ME_LOCAL@localhost:5432/ludoteca_dev
```

Al preparar el entorno, se copia `.env.example` como `.env` y se sustituye el
marcador por la contraseña local. Si la contraseña contiene caracteres
reservados de una URL, deben codificarse en la cadena de conexión.

PostgreSQL seguirá ejecutándose como servicio de Windows aunque se cierre la
terminal. Puede administrarse desde `services.msc`, PowerShell o pgAdmin.

## 8. Nivel B — Dependencias por historia

Todos los comandos se ejecutan desde la raíz. Nunca entrar a un workspace para
crear un segundo `package-lock.json`.

### E00-ST02 — Contratos compartidos

```bash
npm install zod@4 -w @ludoteca/contracts
```

Después deben definirse `build`, `typecheck` y `test` dentro de
`packages/contracts/package.json`. API y web consumirán el workspace por
`@ludoteca/contracts`, nunca por rutas relativas cruzadas.

### E00-ST03 — API Express

Dependencias de runtime:

```bash
npm install express@5 dotenv zod@4 -w @ludoteca/api
npm install @ludoteca/contracts@0.0.0 -w @ludoteca/api
```

Dependencias de desarrollo:

```bash
npm install --save-dev tsx @types/express @types/node -w @ludoteca/api
```

Scripts esperados en `apps/api/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

La API debe separar `app.ts` de `server.ts` para que las pruebas puedan importar
la aplicación sin abrir un puerto.

### E00-ST04 — Aplicación Next.js

Se prefiere instalación manual dentro del workspace ya creado, evitando que
`create-next-app` genere un lockfile o configuración raíz paralelos.

```bash
npm install next@16 react@19 react-dom@19 -w @ludoteca/web
npm install @ludoteca/contracts@0.0.0 -w @ludoteca/web
npm install --save-dev @types/node @types/react @types/react-dom -w @ludoteca/web
```

Scripts esperados:

```json
{
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "typecheck": "tsc --noEmit"
  }
}
```

El App Router vive en `apps/web/src/app`. Tailwind, librerías de componentes,
gestores de estado y clientes de fetching no se instalan por defecto; requieren
una necesidad o decisión explícita.

### E00-ST05 — Configuración tipada

Zod ya estará disponible en API y contratos. Deben crearse schemas distintos
para:

- variables privadas de la API;
- variables públicas permitidas en la web;
- configuración de tooling cuando corresponda.

No se accede a `process.env` desde cualquier módulo ni se expone `DATABASE_URL`
al navegador.

### E00-ST06 — Drizzle y PostgreSQL

Dependencias de runtime de la API:

```bash
npm install drizzle-orm pg -w @ludoteca/api
```

Dependencias de desarrollo de la API:

```bash
npm install --save-dev drizzle-kit @types/pg -w @ludoteca/api
```

No usar `@rc` sin ADR. La ubicación será:

```text
apps/api/
├── drizzle/
├── drizzle.config.ts
└── src/infrastructure/database/
    ├── client.ts
    ├── schema/
    └── index.ts
```

Scripts que se incorporarán a `apps/api/package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/infrastructure/database/seeds/run.ts"
  }
}
```

El flujo compartido es `generate → revisar SQL → migrate`. No se usa
`drizzle-kit push` como sustituto de migraciones versionadas.

### E00-ST08 — Operabilidad

La selección de logger y middleware adicionales debe quedar en la historia o
ADR. No instalar anticipadamente paquetes de logging, CORS, seguridad o
observabilidad sin definir cómo se usarán.

### E00-ST09 — Calidad y pruebas

Permanece bloqueada por G02. No instalar todavía Vitest, Jest, Supertest,
Testing Library, Playwright, ESLint o Biome por preferencia personal del agente.
La decisión deberá indicar qué herramienta cubre cada nivel y qué scripts debe
exponer cada workspace.

## 9. Instalación normal después del primer commit

Una vez versionado `package-lock.json`, cualquier humano, CI o agente debe usar:

```bash
npm ci
npm run dev
```

Antes de iniciar la API debe comprobarse que el servicio PostgreSQL de Windows
esté activo. Cuando E00-ST07 esté implementada, un entorno nuevo también deberá
ejecutar, en este orden:

```bash
npm run db:migrate
npm run db:seed
```

URLs previstas:

```text
Web:    http://localhost:3000
API:    http://localhost:3001/api/v1
Health: http://localhost:3001/api/v1/health
```

`npm install` se usa al añadir o modificar dependencias. `npm ci` se usa para
reproducir exactamente el lockfile existente.

## 10. Reglas para instalar dependencias

1. Ejecutar instalaciones desde la raíz.
2. Indicar siempre el workspace con `-w` cuando la dependencia no sea raíz.
3. Mantener un solo `package-lock.json`.
4. No instalar paquetes globalmente para que el proyecto funcione.
5. No editar manualmente `package-lock.json`.
6. No instalar la misma herramienta con versiones diferentes sin justificación.
7. Dependencias de runtime van en `dependencies`; tooling y tipos en
   `devDependencies`.
8. Antes de añadir un paquete, comprobar si Node, Next.js o una dependencia ya
   resuelven la necesidad.
9. Un agente debe explicar cualquier dependencia que no esté enumerada en su
   historia.
10. Nunca ejecutar instalaciones concurrentes que modifiquen el mismo lockfile.

Ejemplos correctos:

```bash
npm install zod@4 -w @ludoteca/contracts
npm install express@5 -w @ludoteca/api
npm uninstall <paquete> -w @ludoteca/web
npm run dev -w @ludoteca/api
npm run typecheck --workspaces --if-present
```

## 11. Checkpoints antes de asignar E00-ST01

Si E00-ST01 será realizada por el agente, la persona solo necesita entregar:

- repositorio Git vacío o clonado;
- acceso de escritura;
- Node/npm/Git disponibles;
- PostgreSQL 18 instalado en Windows o confirmación de que se instalará antes
  de E00-ST06;
- documentos de arquitectura, ADR, guía de agentes y épica E00 accesibles.

El agente debe crear la estructura. No es necesario que el usuario ejecute los
comandos de Nivel A previamente.

Si la persona ejecuta Nivel A, entonces E00-ST01 debe pasar a revisión en lugar
de asignarse como implementación desde cero.

## 12. Validación al terminar E00-ST01

Desde la raíz:

```bash
npm install
npm ls --workspaces --depth=0
npm run typecheck
git status --short
```

Comprobaciones manuales:

- existe un único `package-lock.json` en la raíz;
- no existen `apps/*/package-lock.json` ni `packages/*/package-lock.json`;
- todos los paquetes tienen nombre único;
- el repositorio no contiene `.env` ni secretos;
- `apps/web` no depende de código de `apps/api`;
- no se creó `packages/database`;
- no se añadieron archivos o dependencias de contenedores;
- no se instalaron herramientas bloqueadas por G01, G02, G04 o G05.

E00-ST01 no exige que Express, Next.js o PostgreSQL ya estén funcionales; eso
pertenece a las historias siguientes.

## 13. Checklist de entrega para el agente

- [ ] Ejecutó comandos desde la ubicación indicada.
- [ ] Conservó un solo lockfile raíz.
- [ ] Documentó las versiones efectivamente resueltas.
- [ ] No añadió dependencias fuera de alcance.
- [ ] Los workspaces aparecen en `npm ls --workspaces --depth=0`.
- [ ] Los scripts raíz delegan correctamente.
- [ ] No incluyó secretos.
- [ ] Reportó comandos de validación y resultados.
- [ ] Indicó cualquier desviación de esta guía.

## 14. Fuentes técnicas consultadas

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [Next.js — Installation](https://nextjs.org/docs/app/getting-started/installation)
- [Express — Installing](https://expressjs.com/en/starter/installing/)
- [Drizzle ORM — PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Zod — Installation](https://zod.dev/)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL — instalador para Windows](https://www.postgresql.org/download/windows/)
