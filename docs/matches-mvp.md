# Partidas — primera vertical

La ruta <http://localhost:3000/partidas> permite registrar, consultar, editar y
cancelar partidas propias.

## Puntos de entrada

- `Partidas` en la navegación abre el historial personal.
- `Registrar partida` en la ficha de un juego preselecciona ese título, sin
  exigir que exista una copia.
- `Registrar partida con esta copia` en una ludoteca vincula juego, edición,
  copia y la ludoteca actual.

## Información incluida

- juego y edición opcional;
- copia y ludoteca opcionales;
- fecha y hora, duración, lugar y notas;
- estado `COMPLETED`, `INCOMPLETE` o `CANCELLED`;
- visibilidad privada o pública;
- usuario actual y participantes invitados;
- resultado y puntuación numérica opcional por participante.

El servidor valida la cantidad de participantes contra el rango del juego y
conserva nombres visibles como snapshots históricos. Por ahora el historial se
consulta exclusivamente desde la cuenta que creó cada partida, incluso si fue
marcada como pública; la lectura social se habilitará cuando existan las reglas
de sharing y perfiles correspondientes.

## Evolución posterior

Quedan deliberadamente fuera de este MVP los equipos, expansiones utilizadas,
imágenes, búsqueda segura de otros usuarios, configuración versionada de
resultados, estadísticas personalizadas por juego, calendario y agregados. El
modelo actual preserva identificadores y resultados básicos para poder añadir
esas capacidades sin reinterpretar el historial.
