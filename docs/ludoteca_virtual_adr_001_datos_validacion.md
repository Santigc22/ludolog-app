# ADR-001 — Acceso a PostgreSQL y validación de contratos

**Proyecto:** Ludoteca Virtual  
**Estado:** Aceptada  
**Fecha:** 19 de septiembre de 2026  
**Decisión:** Drizzle ORM + `pg` para persistencia; Zod 4 para contratos y
validación

## 1. Propósito

Registrar la decisión sobre:

1. cómo acceder a PostgreSQL desde Express;
2. cómo versionar y aplicar cambios de esquema;
3. cómo validar la información que entra y sale de la API;
4. cómo compartir contratos entre Express y Next.js sin acoplar el frontend a
   la base de datos.

Este ADR complementa el ERD y el documento de arquitectura. No modifica las
reglas funcionales del dominio.

---

## 2. Contexto

Ludoteca Virtual parte de un modelo relacional amplio y deliberadamente
explícito. El baseline contiene aproximadamente 85 tablas y utiliza:

- UUID;
- claves compuestas;
- múltiples relaciones N:M;
- `CHECK` constraints;
- índices normales, únicos y parciales;
- históricos;
- catálogos estructurales;
- transacciones que modifican varias tablas;
- consultas que podrán requerir joins y agregaciones no triviales.

El proyecto será desarrollado inicialmente por una sola persona. Por eso la
solución debe ofrecer seguridad de tipos y productividad, pero conservar
visibilidad sobre SQL y PostgreSQL. La herramienta no debe redefinir el dominio
ni obligar a convertirlo en CRUD genérico.

---

## 3. Criterios de decisión

Los criterios utilizados fueron:

1. compatibilidad natural con PostgreSQL;
2. soporte para constraints, claves e índices del ERD;
3. transacciones explícitas;
4. consultas tipadas sin ocultar SQL;
5. migraciones SQL revisables y versionables;
6. integración sencilla con Express y TypeScript;
7. facilidad razonable para un desarrollador individual;
8. posibilidad de usar SQL explícito cuando sea necesario;
9. independencia entre persistencia y contratos HTTP.

---

## 4. Alternativas consideradas

### 4.1 Prisma ORM

Ventajas consideradas:

- experiencia de desarrollo accesible;
- cliente fuertemente tipado;
- ecosistema y documentación amplios;
- migraciones integradas.

Razón para no elegirlo:

El modelo de Ludoteca Virtual ya utiliza PostgreSQL de forma bastante directa.
Para este proyecto se prioriza que índices parciales, constraints y consultas
complejas permanezcan visibles y cercanos a SQL. Prisma podría funcionar, pero
su mayor nivel de abstracción no ofrece aquí una ventaja suficiente frente a
la traducción adicional que introduciría.

Esta conclusión es específica para este proyecto; no implica que Prisma sea
una mala opción general.

### 4.2 Kysely

Ventajas consideradas:

- query builder TypeScript cercano a SQL;
- inferencia fuerte de consultas y resultados;
- escape hatches para SQL dinámico o no representable;
- poco acoplamiento arquitectónico.

Razón para no elegirlo:

Kysely encaja bien en la capa de queries, pero exige decidir y mantener más
piezas por separado para schema y migraciones. Drizzle ofrece un equilibrio más
conveniente para este proyecto individual: definición de schema, migraciones y
consultas tipadas dentro del mismo ecosistema, sin alejarse demasiado de SQL.

### 4.3 SQL directo con `pg`

Ventajas consideradas:

- control total;
- correspondencia exacta con PostgreSQL;
- ausencia de abstracción ORM.

Razón para no elegirlo como mecanismo principal:

Obligaría a mantener manualmente más mapeos, tipos y repetición en una base
grande. `pg` seguirá siendo el driver y SQL directo continuará permitido como
escape hatch, pero no será la interfaz habitual de repositories.

### 4.4 Drizzle ORM

Ventajas decisivas:

- API de consultas cercana a SQL;
- schema PostgreSQL expresado en TypeScript;
- soporte de PK/FK simples y compuestas, `UNIQUE`, `CHECK` e índices con
  cláusula `WHERE`;
- transacciones y savepoints;
- generación de migraciones SQL que pueden revisarse;
- permite estrategia database-first o codebase-first;
- permite SQL explícito cuando la abstracción no sea suficiente.

Costo aceptado:

- será necesario traducir el ERD a schema Drizzle;
- las migraciones generadas deben revisarse, no confiarse ciegamente;
- el equipo debe conservar conocimiento real de SQL y PostgreSQL.

---

## 5. Decisión de persistencia

Se utilizarán:

```text
Drizzle ORM
    ↓
drizzle-orm/node-postgres
    ↓
pg
    ↓
PostgreSQL
```

### Reglas obligatorias

1. El schema Drizzle versionado será la fuente técnica del esquema
   implementado.
2. El ERD será la referencia de diseño y deberá mantenerse alineado cuando una
   decisión de dominio modifique el modelo.
3. Los repositories son la única capa habitual que ejecuta queries.
4. Controllers y routes no pueden importar tablas Drizzle ni el cliente de
   base de datos.
5. Los services controlan las transacciones de los casos de uso.
6. Un repository debe aceptar el contexto `db` o `tx` correspondiente; no debe
   abrir silenciosamente una transacción independiente.
7. El uso de SQL explícito debe estar encapsulado, parametrizado y probado.
8. Drizzle no sustituye constraints de PostgreSQL ni validaciones de dominio.

---

## 6. Estrategia de migraciones

El flujo aprobado será:

```text
Modificar schema Drizzle
        ↓
drizzle-kit generate
        ↓
Revisar migration.sql
        ↓
Probar en PostgreSQL limpio
        ↓
Probar upgrade desde la versión anterior
        ↓
Versionar en Git
        ↓
drizzle-kit migrate en un paso controlado
```

### Políticas

- Ningún cambio manual se hará directamente sobre producción.
- Las migraciones se conservan en Git.
- Una migración aplicada no se reescribe; un cambio nuevo crea otra migración.
- `drizzle-kit push` se limita a bases locales desechables.
- Ambientes compartidos y producción usan migraciones versionadas.
- La migración no se ejecuta automáticamente al iniciar cada instancia de la
  API.
- Un despliegue que requiera una migración debe fallar antes de publicar la
  nueva aplicación si la migración no pudo completarse.
- Los cambios destructivos requieren una estrategia explícita de preservación
  o transformación de datos.
- Seeds estructurales deben ser idempotentes y estar separados de seeds de
  desarrollo.

### Primera migración

El DDL del ERD no se ejecutará sin más como migración productiva. Primero se
traducirá el bloque necesario a Drizzle, se generará SQL y se comparará contra
el baseline para comprobar:

- tipos y nulabilidad;
- PK y FK;
- `UNIQUE` y `CHECK`;
- índices parciales;
- acciones `ON DELETE`;
- defaults;
- nombres de tablas y columnas.

---

## 7. Decisión de validación

Se utilizará **Zod 4** para validar datos no confiables y definir contratos
HTTP compartidos.

Ejemplos de datos no confiables:

- `req.params`;
- `req.query`;
- `req.body`;
- variables de entorno;
- respuestas de servicios externos;
- valores leídos desde almacenamiento no controlado.

Los schemas públicos vivirán en:

```text
packages/contracts/src/
├── common/
├── auth/
├── users/
├── collections/
├── copies/
└── index.ts
```

### Reglas obligatorias

1. El schema Zod es la fuente de verdad del contrato público.
2. Los tipos TypeScript se infieren con `z.infer`; no se duplican manualmente.
3. `params`, `query` y `body` se validan antes de llamar al controller o al
   comienzo de este mediante una abstracción común.
4. Un error de validación se traduce al formato HTTP estándar del proyecto.
5. Next.js puede reutilizar contracts para formularios y consumo de la API.
6. Reutilizar un schema en frontend no sustituye la validación de Express.
7. Los schemas de base de datos no se publican como DTO automáticamente.
8. Los campos internos, de auditoría o sensibles no deben filtrarse por inferir
   una respuesta desde una tabla.
9. TypeScript se configura con `strict: true`.

---

## 8. Separación entre modelos

Existirán tres representaciones relacionadas, pero no equivalentes:

| Modelo | Propósito | Fuente |
|---|---|---|
| Persistencia | Tablas, columnas, relaciones e índices | Drizzle schema |
| Dominio/aplicación | Reglas, casos de uso y resultados | Services y tipos internos |
| Contrato HTTP | Entrada y salida pública | Zod en `packages/contracts` |

Ejemplo:

```text
users.password_hash       → existe en persistencia
AuthenticatedUser         → existe internamente
UserResponseSchema        → nunca expone password_hash
```

Evitar esta separación produciría acoplamiento, filtración accidental de datos
y APIs dictadas por la forma de las tablas.

---

## 9. OpenAPI

Zod 4 permite conversión a JSON Schema y tiene un ecosistema de integraciones.
Esto mantiene abierta la generación de OpenAPI a partir de contracts.

La herramienta exacta de OpenAPI no queda decidida en este ADR. Cuando se
evalúe deberá cumplir:

- reutilizar los schemas Zod existentes;
- no mantener una segunda definición manual del mismo DTO;
- documentar respuestas exitosas y errores;
- producir un documento comprobable en CI;
- permitir pruebas contractuales.

---

## 10. Consecuencias

### Positivas

- consultas y resultados tipados;
- cercanía a SQL y PostgreSQL;
- migraciones inspeccionables;
- contratos reutilizables entre Express y Next.js;
- validación en runtime y tipos inferidos;
- separación explícita entre tabla, dominio y API;
- menor riesgo de exponer columnas internas accidentalmente.

### Costos y riesgos

- traducir el ERD inicial será un trabajo considerable;
- Drizzle schema y ERD pueden divergir si no se actualizan juntos;
- los tipos no reemplazan pruebas de integración con PostgreSQL;
- una migración generada puede requerir correcciones manuales;
- compartir contracts puede tentar a introducir lógica de negocio en el
  paquete compartido;
- SQL explícito sin disciplina puede romper el aislamiento de repositories.

### Mitigaciones

- checklist de comparación ERD ↔ Drizzle ↔ SQL generado;
- pruebas de migración desde base vacía y desde versión anterior;
- tests de integración contra PostgreSQL real;
- revisión obligatoria de migrations;
- límites de imports comprobables por linting cuando el proyecto exista;
- contracts sin acceso a base de datos ni servicios.

---

## 11. Condiciones para revisar esta decisión

Este ADR se revisará si ocurre al menos una de estas condiciones:

- Drizzle no puede representar de forma sostenible características esenciales
  del modelo;
- el uso de SQL explícito deja de ser excepcional y domina los repositories;
- las migraciones generan fricción o riesgo repetido;
- el proyecto cambia de lenguaje o runtime;
- los requisitos de rendimiento exigen otra estrategia de acceso;
- los contratos Zod dificultan de manera demostrable la interoperabilidad o la
  generación de OpenAPI.

La preferencia personal por otra librería no es suficiente para reemplazar la
decisión sin evidencia del proyecto.

---

## 12. Próximo paso

Crear el esqueleto del monorepo y comprobar la decisión con una vertical mínima:

1. configurar workspaces;
2. crear `apps/api`, `apps/web` y `packages/contracts`;
3. conectar Express a PostgreSQL mediante Drizzle y `pg`;
4. implementar los schemas estructurales mínimos;
5. generar y revisar la primera migración;
6. definir el primer contrato Zod;
7. exponer un endpoint de salud y una operación sencilla de la vertical;
8. añadir pruebas de migración, repository y validación.

---

## 13. Referencias oficiales

- [Drizzle ORM — Overview](https://orm.drizzle.team/docs/overview)
- [Drizzle — Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Drizzle — Transactions](https://orm.drizzle.team/docs/transactions)
- [Drizzle — Migrations](https://orm.drizzle.team/docs/migrations)
- [Kysely — Introduction](https://kysely.dev/docs/intro)
- [Zod — Documentation](https://zod.dev/)

