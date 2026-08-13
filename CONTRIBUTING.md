# Cómo contribuir

Gracias por querer ayudar. Este proyecto existe por una emergencia, así que la prioridad es que la
información sea correcta y que la página siga funcionando en un teléfono con mala señal.

## La contribución más valiosa no es código

Si conoces un punto de acopio, **agrégalo desde la aplicación** o abre un issue con la plantilla
correspondiente. Si sabes que un punto cerró o que ya no recibe algo, **repórtalo**. Eso vale más
que cualquier refactor.

## Contribuir con código

### Antes de empezar

- Abre un issue describiendo el problema o la mejora, salvo que sea un arreglo evidente.
- Si el cambio toca **RLS**, las **Edge Functions** o la **moderación**, dilo en el título del
  issue. Son las partes donde un error tiene consecuencias reales.

### Requisitos para un PR

```bash
npm run lint       # sin errores
npm run typecheck  # sin errores
npm run build      # debe compilar
```

Además:

- **Idioma:** la interfaz, los comentarios y los nombres de variables van en español. El proyecto lo
  van a leer y mantener personas en Colombia.
- **Comentarios:** explica el *por qué*, no el *qué*. Si una decisión parece rara, es porque
  probablemente tiene una razón: escríbela.
- **Movimiento:** cualquier animación nueva debe respetar `prefers-reduced-motion` y usar solo
  `transform` y `opacity`.
- **Accesibilidad:** foco visible, contraste AA, navegable con teclado. Los formularios llevan
  `label` real, no `placeholder` como etiqueta.
- **Peso:** este proyecto se usa desde datos móviles en zonas afectadas. Si una dependencia nueva
  suma más de ~10 kB comprimidos, justifícalo en el PR.

### Cambios que necesitan una explicación explícita en el PR

- Agregar cualquier política de `INSERT`, `UPDATE` o `DELETE` en RLS. La respuesta por defecto es
  **no**: la escritura va por Edge Functions. Si crees que hay un caso que lo amerita, explica por
  qué la `anon key` filtrada no sería un problema.
- Ampliar la lista de campos editables por la comunidad (`CAMPOS_EDITABLES` en `submit/index.ts` y
  `aplicar_solicitud_edicion` en `0005_rate_limit.sql`).
- Tocar la comparación de la clave de moderador o el límite por IP.
- Publicar datos que hoy no son públicos (teléfonos de quien aporta, hashes de IP, ofertas).

### Sobre los datos

- **No inventes cantidades.** Si una fuente no publica cuánto falta, el campo va en `NULL` y la
  interfaz dice "cantidad por confirmar".
- **Cita la fuente.** Todo punto nuevo en el seed necesita su `fuente_url`.
- **No borres puntos.** Los que cerraron se marcan `inactive`.

## Estructura del proyecto

```
src/
  componentes/   piezas de interfaz reutilizables
  lib/           datos, formato, movimiento y llamadas a la API
  rutas/         una página por archivo
supabase/
  migrations/    esquema, RLS, funciones y seed
  functions/     submit y moderate
scripts/         geocodificación del seed
```

## Código de conducta

Al participar aceptas el [código de conducta](CODE_OF_CONDUCT.md).
