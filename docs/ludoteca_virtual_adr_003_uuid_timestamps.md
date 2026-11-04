# ADR-003 — Generación de UUID y estrategia de timestamps

**Proyecto:** Ludoteca Virtual  
**Estado:** Aceptada  
**Fecha:** 21 de septiembre de 2026  
**Gate resuelto:** `G04`  
**Decisión:** UUID v4 generados por PostgreSQL y timestamps con zona horaria,
precisión de milisegundos y defaults controlados por la base de datos

## 1. Propósito

Definir una estrategia única para:

- identificadores UUID;
- timestamps técnicos de creación y actualización;
- fechas de eventos de negocio;
- representación entre PostgreSQL, Drizzle, TypeScript y la API HTTP.

Esta decisión desbloquea la primera migración de `E00-ST07`.

## 2. Contexto

El ERD utiliza UUID como claves primarias de las entidades principales y
`TIMESTAMPTZ` para los instantes. Deliberadamente no fijaba todavía cómo se
generarían los UUID. Los timestamps técnicos ya expresaban
`DEFAULT CURRENT_TIMESTAMP`.

La aplicación también necesita que las inserciones realizadas por seeds,
migraciones o SQL explícito conserven los mismos defaults que las realizadas
mediante Drizzle. Por ello la generación no puede depender exclusivamente del
proceso Node.js.

## 3. Decisión sobre UUID

Las claves primarias UUID ordinarias se definirán en Drizzle mediante el
equivalente a:

```ts
uuid("id").primaryKey().defaultRandom()
```

El SQL generado deberá producir un default equivalente a:

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
```

### Reglas

1. PostgreSQL genera UUID v4 para las entidades principales.
2. No se requiere una extensión adicional en PostgreSQL 18 para
   `gen_random_uuid()`.
3. Controllers y clientes no generan IDs persistentes por defecto.
4. Un service puede aceptar un UUID ya existente únicamente cuando el caso de
   uso lo justifique expresamente, por ejemplo una importación idempotente.
5. Las FK UUID nunca reciben un default aleatorio.
6. Las PK compartidas, como `profiles.user_id`, reutilizan el UUID de la
   entidad propietaria y no generan otro.
7. Los IDs públicos se tratan como valores opacos; su versión no forma parte
   del contrato HTTP.

### Alternativas descartadas inicialmente

- **UUID generados solo en Node.js:** harían que SQL explícito, seeds y otras
  entradas dependieran de recordar una responsabilidad de aplicación.
- **UUID v7:** PostgreSQL 18 lo soporta y puede mejorar localidad de índices,
  pero no existe todavía evidencia de volumen que justifique cambiar el
  baseline. Adoptarlo posteriormente exige una migración/ADR, no un cambio
  silencioso.
- **Secuencias numéricas públicas:** contradicen el baseline UUID y facilitan
  enumeración accidental de recursos.

## 4. Decisión sobre timestamps

Los instantes persistentes usarán `TIMESTAMPTZ` con precisión de milisegundos.
En Drizzle, el patrón base será:

```ts
timestamp("created_at", {
  withTimezone: true,
  mode: "date",
  precision: 3,
})
  .notNull()
  .defaultNow();
```

### Razones

- `TIMESTAMPTZ` representa un instante y evita timestamps locales ambiguos.
- La precisión de milisegundos coincide con `Date` e ISO 8601 en JavaScript.
- Los defaults en PostgreSQL protegen inserciones fuera del ORM.
- `CURRENT_TIMESTAMP` es estable dentro de una transacción, conveniente para
  cambios atómicos relacionados.

### Reglas para timestamps técnicos

1. `created_at` se genera en PostgreSQL mediante `DEFAULT CURRENT_TIMESTAMP`.
2. `updated_at` recibe el mismo default al insertar.
3. Cada update que modifique estado persistente debe asignar explícitamente
   `updated_at = CURRENT_TIMESTAMP` desde el repository/caso de uso.
4. Inicialmente no se utilizarán triggers genéricos para `updated_at`.
5. No se utilizará `$onUpdate` de Drizzle como garantía de integridad porque
   no protege SQL ejecutado fuera de esa ruta de aplicación.
6. Los timestamps de auditoría se generan dentro de la misma transacción que
   la acción auditada.

### Reglas para fechas de negocio

Campos como `started_at`, `acquired_at`, `loaned_at`, `sold_at` o
`occurred_at` pueden representar un instante proporcionado por el usuario o
por el caso de uso. No reciben automáticamente un default salvo que el dominio
defina inequívocamente que significan “momento de registro”.

El service normaliza y valida estas fechas antes de persistirlas. La base de
datos conserva sus constraints de orden temporal.

## 5. UTC y contratos HTTP

1. Las sesiones PostgreSQL de la API operan con zona horaria UTC.
2. TypeScript recibe los timestamps como `Date` mediante Drizzle.
3. La API serializa instantes como ISO 8601 UTC, por ejemplo:
   `2026-09-21T18:30:00.000Z`.
4. Los contratos HTTP usan strings datetime validados; no exponen objetos
   `Date` en JSON.
5. La zona horaria de presentación pertenece a la interfaz y no altera el
   instante almacenado.

## 6. Migraciones y revisión

Durante `E00-ST07`, cada columna deberá compararse con el ERD para comprobar:

- si genera UUID o reutiliza una clave existente;
- nulabilidad;
- presencia o ausencia de default temporal;
- precisión y zona horaria;
- semántica técnica o de negocio.

La migración SQL generada debe revisarse para confirmar `gen_random_uuid()` y
`timestamp(3) with time zone` donde correspondan.

## 7. Consecuencias

### Positivas

- defaults consistentes para Drizzle, seeds y SQL explícito;
- IDs no secuenciales y opacos;
- fechas comparables entre ambientes;
- precisión alineada con JavaScript;
- comportamiento transaccional predecible.

### Costos

- cada update debe recordar modificar `updated_at` explícitamente;
- UUID v4 no optimiza localidad de índices como UUID v7;
- los tests que dependen del reloj requieren rangos o un reloj controlado para
  datos de negocio.

## 8. Condiciones para revisar la decisión

- evidencia de degradación de índices por UUID v4;
- necesidad demostrada de UUID ordenables;
- adopción de otro runtime temporal distinto de `Date`;
- errores repetidos al mantener `updated_at` que justifiquen triggers;
- requerimientos de precisión superiores a milisegundos.

## 9. Referencias oficiales

- [PostgreSQL 18 — UUID Functions](https://www.postgresql.org/docs/18/functions-uuid.html)
- [PostgreSQL 18 — Date/Time Types](https://www.postgresql.org/docs/18/datatype-datetime.html)
- [PostgreSQL 18 — Date/Time Functions](https://www.postgresql.org/docs/18/functions-datetime.html)
- [Drizzle ORM — PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg)

