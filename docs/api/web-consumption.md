# Consumo de la API desde Next.js

La aplicación web consume Express mediante el cliente centralizado en
`apps/web/src/lib/api/client.ts`. Los componentes no construyen URLs completas
ni acceden a PostgreSQL.

La URL base procede obligatoriamente de `NEXT_PUBLIC_API_URL`. Next.js carga el
archivo `.env` de la raíz durante su configuración y valida la variable antes
de iniciar o construir la aplicación. No existe un fallback silencioso.

Las respuestas se validan con los schemas públicos de
`@ludoteca/contracts`. La página inicial usa `HealthResponseSchema` al
consultar `GET /health`.

No se ha introducido un Route Handler o BFF. Si posteriormente se adopta uno,
solo adaptará la comunicación con Express y no contendrá reglas de negocio.

Las variables privadas, incluida `DATABASE_URL`, no son referenciadas por el
código web ni se incluyen explícitamente en la configuración pública.

