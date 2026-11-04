# ADR-002 — Gestión del monorepo con npm workspaces

**Proyecto:** Ludoteca Virtual  
**Estado:** Aceptada  
**Fecha:** 19 de septiembre de 2026  
**Decisión:** Utilizar npm workspaces sin un orquestador adicional durante la
primera etapa

## 1. Propósito

Registrar cómo se administrarán las aplicaciones y paquetes que componen el
monorepo de Ludoteca Virtual.

---

## 2. Contexto

El proyecto tendrá inicialmente:

```text
apps/api              Express + TypeScript
apps/web              Next.js App Router
packages/contracts    Contratos Zod compartidos
packages/config       Configuración técnica compartida
packages/test-utils   Utilidades de prueba justificadas
```

Se busca:

- trabajar desde un solo repositorio;
- compartir contracts sin publicar paquetes externos;
- mantener una instalación reproducible;
- ejecutar scripts por aplicación o de forma conjunta;
- reducir herramientas y configuración durante la primera vertical;
- conservar una ruta de evolución si el monorepo crece.

---

## 3. Costos y licencias

npm workspaces forma parte del npm CLI y no requiere una licencia comercial ni
una suscripción adicional para utilizarlo.

El stack base elegido puede desarrollarse y ejecutarse localmente sin pagar
licencias de software:

- Node.js y npm;
- Express;
- Next.js;
- PostgreSQL;
- Drizzle ORM y Drizzle Kit;
- Zod;
- `pg` / node-postgres;
- npm workspaces.

Esto no significa que operar la aplicación completa sea siempre gratuito.
Pueden existir costos por:

- hosting de frontend y API;
- PostgreSQL administrado;
- dominio y DNS;
- correo transaccional;
- almacenamiento y transformación de imágenes;
- observabilidad;
- backups;
- transferencia de datos;
- capacidad adicional de CI/CD.

Las capas gratuitas de proveedores externos no se consideran una garantía
arquitectónica: pueden cambiar y normalmente tienen límites.

---

## 4. Alternativas consideradas

### 4.1 Repositorios separados

Ventajas:

- ciclos y permisos completamente independientes;
- aislamiento fuerte.

Razón para descartarlo inicialmente:

Introduciría coordinación adicional para contracts compartidos, cambios
coordinados entre frontend/backend y configuración de herramientas. El proyecto
empieza con un solo desarrollador y no necesita esa separación operativa.

### 4.2 pnpm workspaces

Ventajas:

- gestión eficiente de almacenamiento;
- workspaces maduros;
- controles estrictos de dependencias;
- buena base para monorepos grandes.

Razón para no elegirlo:

npm workspaces ya cubre las necesidades iniciales y es una herramienta conocida
por el desarrollador. El beneficio adicional de cambiar de gestor no compensa
introducir otra convención en esta etapa.

### 4.3 npm workspaces + Turborepo

Ventajas:

- grafo y orquestación de tareas;
- caché de builds;
- ejecución incremental;
- mejor experiencia cuando existen muchos paquetes y pipelines costosos.

Razón para no añadirlo todavía:

La primera versión tendrá pocos workspaces y un único desarrollador. No existe
aún un problema medido de tiempo de build o coordinación que justifique otra
capa. Podrá añadirse posteriormente sin cambiar la organización fundamental.

### 4.4 npm workspaces sin orquestador

Ventajas decisivas:

- viene integrado con npm;
- administra varios paquetes desde el proyecto raíz;
- enlaza automáticamente paquetes locales durante `npm install`;
- permite instalar dependencias y ejecutar scripts por workspace;
- utiliza un único lockfile;
- reduce configuración y curva de aprendizaje.

Costo aceptado:

- la ejecución de scripts es más simple que con un orquestador especializado;
- no tendremos caché inteligente ni pipeline incremental inicialmente;
- deberemos mantener scripts raíz claros y consistentes.

---

## 5. Decisión

El monorepo se gestionará con **npm workspaces**.

Configuración raíz inicial:

```json
{
  "name": "ludoteca-virtual",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

No se instalará Turborepo, Nx ni otro orquestador en la primera vertical.

---

## 6. Reglas obligatorias

1. Existirá un único `package-lock.json` en la raíz.
2. `node_modules` y artefactos de build no se versionan.
3. Las instalaciones de CI usarán `npm ci` desde la raíz.
4. Cada workspace declara únicamente las dependencias que utiliza.
5. Una dependencia no se considera disponible solo porque otro workspace la
   instaló.
6. Los paquetes internos se consumen por su nombre de paquete y no mediante
   rutas relativas que crucen sus límites.
7. `packages/contracts` no depende de `apps/api` ni `apps/web`.
8. Los scripts raíz delegan en workspaces; no duplican la implementación de sus
   comandos internos.
9. Los paquetes que no necesiten publicarse se marcarán como privados.
10. Las versiones de Node y npm soportadas se documentarán y validarán en CI.

---

## 7. Comandos esperados

Ejemplos conceptuales:

```bash
# Instalar todo el monorepo de forma reproducible
npm ci

# Ejecutar una aplicación específica
npm run dev --workspace=@ludoteca/api
npm run dev --workspace=@ludoteca/web

# Ejecutar un script en todos los workspaces que lo implementen
npm run test --workspaces --if-present

# Instalar una dependencia en un workspace
npm install zod --workspace=@ludoteca/contracts
```

Los nombres definitivos de paquetes y scripts se confirmarán al crear el
esqueleto real.

---

## 8. Estructura inicial

```text
ludoteca-virtual/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── contracts/
│   ├── config/
│   └── test-utils/
├── docs/
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

`packages/config` y `packages/test-utils` solo se crearán cuando exista código
real que compartir. No deben aparecer vacíos para satisfacer una estructura
teórica.

---

## 9. Condiciones para revisar la decisión

Se evaluará añadir Turborepo, Nx o migrar a otro gestor si aparece evidencia de:

- builds o tests completos demasiado lentos;
- necesidad real de caché local/remota;
- gran cantidad de paquetes con dependencias complejas;
- ejecución incremental difícil de mantener mediante scripts npm;
- crecimiento del equipo y pipelines paralelos;
- problemas reproducibles de aislamiento de dependencias.

La decisión no se revisará únicamente porque otra herramienta sea popular.

---

## 10. Preparación para trabajo mediante agentes

npm workspaces establece el contenedor técnico, pero no es suficiente para
delegar features completas. Antes de asignar trabajo a un agente, cada historia
debe definir:

- objetivo y valor para el usuario;
- contexto funcional y reglas aplicables;
- alcance y fuera de alcance;
- dependencias con otras historias;
- contrato de API esperado;
- tablas o migraciones involucradas;
- permisos y ownership;
- criterios de aceptación comprobables;
- pruebas requeridas;
- restricciones arquitectónicas;
- archivos o módulos que puede modificar;
- Definition of Done.

El agente debe recibir una historia vertical pequeña, no instrucciones abiertas
como “construye el módulo de usuarios”.

---

## 11. Próximo paso

Construir un **plan de desarrollo por features e historias**, ordenado por
dependencias. La primera épica será la fundación técnica y la primera vertical
funcional seguirá siendo:

```text
Auth → Users → Collections → Copies
```

El plan separará:

1. habilitadores técnicos;
2. features funcionales;
3. historias verticales;
4. pruebas y criterios de calidad;
5. paquetes de trabajo apropiados para un agente.

---

## 12. Referencias oficiales

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [Licencia de PostgreSQL](https://www.postgresql.org/about/licence/)
- [Licencia de Next.js](https://github.com/vercel/next.js/blob/canary/license.md)
- [Licencia de Express](https://github.com/expressjs/express/blob/master/LICENSE)
- [Licencia de Drizzle ORM](https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE)
- [Licencia de Zod](https://github.com/colinhacks/zod/blob/main/LICENSE)
- [Licencia de node-postgres](https://github.com/brianc/node-postgres/blob/master/LICENSE)

