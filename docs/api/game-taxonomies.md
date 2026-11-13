# Opciones de mecánicas y categorías

## `GET /api/v1/games/taxonomies`

Devuelve los nombres normalizados que pueden utilizarse para autocompletar
mecánicas y categorías. No requiere autenticación. Si existe una sesión válida,
incluye también términos asociados a juegos privados del usuario.

Nunca expone términos que solo estén asociados a juegos privados de otras
cuentas, juegos archivados o propuestas todavía no públicas.

### Respuesta `200`

```json
{
  "mechanics": ["Construcción de mazos", "Drafting"],
  "categories": ["Cartas", "Mazo de cartas"]
}
```

Las listas se ordenan alfabéticamente y no contienen duplicados. La respuesta
usa `Cache-Control: no-store` porque depende de la sesión opcional.

El contrato de respuesta es `GameTaxonomyOptionsResponseSchema`. La cobertura
de acceso y privacidad está en `apps/api/test/game-list.test.ts`; el consumo web
se verifica en `apps/web/test/api-modules.test.ts`.
