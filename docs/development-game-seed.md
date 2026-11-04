# Seed de juegos para desarrollo

E03-ST03 proporciona un catálogo pequeño para desarrollar y probar las
consultas de E03 sin pretender ser una fuente oficial o exhaustiva.

## Contenido

El seed crea cuatro juegos públicos aprobados:

- Catan;
- Flip 7;
- Azul;
- Pandemic.

También crea una edición de referencia en español asociada a Catan. Es
suficiente para probar que una selección puede distinguir entre juego y edición
sin poblar datos comerciales avanzados.

Los metadatos son datos controlados de desarrollo. No deben presentarse como
un catálogo editorial oficial ni promoverse automáticamente a otros ambientes.

## Ejecución

Desde la raíz, después de aplicar las migraciones:

```powershell
npm.cmd run db:seed:development
```

El comando exige simultáneamente:

- `NODE_ENV=development`;
- `DATABASE_URL` apuntando exactamente a `ludoteca_dev`.

No se ejecuta mediante `npm.cmd run db:seed`, durante el arranque de la API ni
al preparar `ludoteca_test`.

## Idempotencia

Juegos y ediciones tienen UUID estables reservados para este seed. La escritura
usa upserts dentro de una transacción protegida por advisory lock y verifica el
número de IDs persistidos antes del commit. Ejecutar el comando repetidamente
actualiza esas filas, sin duplicarlas.
