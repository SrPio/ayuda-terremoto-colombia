# Ayuda Terremoto Colombia

**Dónde llevar las donaciones, y qué se necesita en cada punto.**

Plataforma web abierta que centraliza los puntos de acopio habilitados en Colombia tras el
terremoto de magnitud 7,4 del **10 de agosto de 2026**, con epicentro en San José del Palmar
(Chocó), y que cruza lo que cada persona tiene para donar con las necesidades reales de cada punto.

> **Proyecto open source y sin ánimo de lucro.** No recibe, administra ni solicita dinero.
> Licencia [MIT](LICENSE): puedes auditarlo, copiarlo, desplegar tu propia versión o adaptarlo a
> otra emergencia.

---

## El problema que resuelve

Después del sismo, la información de los acopios quedó repartida entre alcaldías, gobernaciones, la
Cruz Roja, bancos de alimentos, notas de prensa y cadenas de WhatsApp. El resultado es conocido en
cualquier desastre:

- unos puntos se desbordan de cosas que no necesitan, mientras municipios enteros esperan agua;
- la gente lleva lo que tiene a mano, no lo que hace falta;
- nadie sabe qué punto ya está saturado ni cuál cerró ayer.

Esta aplicación hace dos cosas concretas:

1. **Consultar** — todos los puntos de acopio por departamento, con la lista de lo que pide cada uno
   y su nivel de urgencia.
2. **Emparejar** — un asistente de cuatro preguntas (*¿qué tienes?* → *¿cuánto?* → *¿dónde estás?* →
   *¿tienes transporte?*) que responde con una necesidad concreta, la cantidad que falta y un botón
   que abre WhatsApp con el mensaje ya escrito.

Ejemplo real del flujo:

```
Tengo 100 cajas de agua en Medellín, con transporte
  ↓
📍 Necesidad detectada: Buenaventura, Valle del Cauca
💧 Agua · faltan 80 cajas · ALTA
🚛 Transporte disponible: Sí
[ Coordinar entrega por WhatsApp ]
```

Además, cualquiera puede **agregar** un punto nuevo, **corregir** los datos de uno existente o
**reportar** que ya cerró — sin crear cuenta.

---

## Decisiones de diseño que vale la pena conocer

Estas son las decisiones no obvias del proyecto. Si vas a contribuir, empieza por aquí.

### 1. No hay cuentas de usuario, y el navegador no puede escribir en la base

Pedirle registro a alguien que está organizando un acopio en su barrio es una barrera absurda. Pero
si no hay login, tampoco se puede confiar en `auth.uid()` para limitar quién escribe.

La salida habitual —dejar que el rol anónimo haga `INSERT`— significa que cualquiera con la `anon
key` (que es **pública por diseño**, va en el bundle de JavaScript) puede escribir en la base con un
script de tres líneas. En una emergencia eso es una invitación al vandalismo de datos.

Así que:

- **RLS concede únicamente `SELECT`**, y solo sobre puntos con `status = 'approved'`. No existe
  ninguna política de escritura para `anon` ni para `authenticated`, y además se revocan los
  permisos de tabla como segunda barrera.
- **Toda la escritura pasa por Edge Functions** que validan, aplican captcha y limitan por IP, y
  escriben con `service_role` — una llave que nunca sale del servidor.

### 2. Nada se publica sin revisión

Los puntos nuevos, las correcciones y las solicitudes de retiro entran como `pending` y aparecen en
una cola de moderación. Un dato falso durante un desastre no es un error de contenido: manda gente y
camiones a una dirección equivocada.

La moderación se abre en `/admin` con una **clave que solo existe como secreto de la Edge Function**
`moderate`. No está en el bundle, no está en el repositorio, y se compara en tiempo constante con un
límite de intentos por IP.

### 3. No se inventan cantidades

Las fuentes públicas dicen **qué** recibe cada punto, pero casi nunca **cuánto** le falta. El
esquema permite `cantidad_solicitada = NULL` y la interfaz muestra *"cantidad por confirmar"* en vez
de estimar un número. Una cifra inventada haría que alguien cargue un camión con destino equivocado.

Las cifras reales las carga la moderación desde `/admin` cuando se confirman con el punto.

### 4. No se guardan direcciones IP

Para frenar el spam se almacena un HMAC-SHA256 de la IP con una sal secreta, nunca la IP. Alcanza
perfectamente para contar "cuántos envíos hizo este visitante en la última hora" y no construye un
registro de quién estuvo consultando puntos de acopio.

### 5. Los puntos cerrados no se borran

Se marcan como `inactive`. Borrarlos garantiza que alguien los vuelva a agregar mañana.

### 6. El sello de frescura es parte del dato

Cada punto muestra cuándo se actualizó por última vez, y pasadas 72 horas se marca **"por
verificar"**. Un dato viejo no es neutro. La interfaz insiste, en varios lugares, en llamar antes de
desplazarse.

---

## Arquitectura

```
┌─────────────────────────────┐
│  React + Vite (SPA en       │
│  Vercel)                    │
│                             │
│  anon key → SOLO LECTURA    │
└──────────┬──────────────────┘
           │
     ┌─────┴──────────────────────────────┐
     │                                    │
     ▼ lectura directa                    ▼ toda la escritura
┌─────────────────────┐        ┌──────────────────────────────┐
│  PostgREST + RLS    │        │  Edge Functions (Deno)       │
│                     │        │                              │
│  SELECT solo de     │        │  submit    → valida, captcha,│
│  puntos aprobados   │        │              límite por IP,  │
│                     │        │              guarda pending  │
│  RPC de lectura:    │        │  moderate  → exige clave de  │
│   match_needs       │        │              moderador       │
│   critical_needs    │        │                              │
│   public_stats      │        │  service_role (nunca sale    │
│                     │        │  del servidor)               │
└─────────┬───────────┘        └──────────┬───────────────────┘
          │                               │
          └───────────┬───────────────────┘
                      ▼
              ┌───────────────┐
              │  PostgreSQL   │
              │  (Supabase)   │
              └───────────────┘
```

### Stack

| Capa | Herramienta | Por qué |
| --- | --- | --- |
| UI | React 19 + Vite + TypeScript | SPA sencilla de desplegar y de auditar |
| Estilos | Tailwind CSS v4 | Sistema de diseño en un solo archivo (`src/index.css`) |
| Animación | `motion` | Todas las transiciones respetan `prefers-reduced-motion` |
| Datos | TanStack Query + Supabase Realtime | Caché corta y actualización en vivo de las necesidades |
| Mapa | Leaflet + OpenStreetMap | Sin API key, sin cuotas, sin tarjeta de crédito |
| Base de datos | PostgreSQL (Supabase) + RLS | Seguridad en la base, no en el cliente |
| Escritura | Supabase Edge Functions (Deno) | Único punto de entrada de datos |
| Offline | `vite-plugin-pwa` | La lista de puntos se consulta sin señal |
| Hosting | Vercel | Despliegue por CLI |

---

## Modelo de datos

| Tabla | Para qué |
| --- | --- |
| `departments` | 33 departamentos + Bogotá D.C., con código DANE, centroide y bandera `afectado` |
| `need_categories` | Catálogo **cerrado** de tipos de donación. Mantenerlo cerrado es lo que hace posible el emparejamiento |
| `collection_points` | Los puntos de acopio, con `status`, `verificado` y sello de actualización |
| `point_needs` | Qué pide cada punto: cantidad solicitada, cubierta, unidad y urgencia |
| `donation_offers` | Las ofertas del asistente. Sirven para medir qué se ofrece y no encuentra destino |
| `point_change_requests` | Correcciones y solicitudes de retiro, con un `payload` para mostrar el diff |
| `point_reports` | Reportes rápidos: cerrado, saturado, información incorrecta |
| `rate_limits` | Contador por (hash de IP, acción, ventana). Se puede purgar sin consecuencias |

### Funciones

- **`match_needs(categoria, cantidad, departamento, lat, lng, transporte, limite)`** — el motor del
  asistente. Ordena por urgencia → zona afectada → si la donación cubre la necesidad completa →
  cercanía → tamaño del faltante. Quien **no** tiene transporte solo recibe opciones que puede
  alcanzar por su cuenta (su departamento o ~100 km); quien sí lo tiene recibe también opciones
  interdepartamentales.
- **`critical_needs(limite)`** — el manifiesto de la portada.
- **`public_stats()`** — cifras del tablero en una sola consulta.
- **`registrar_intento(...)`** y **`aplicar_solicitud_edicion(...)`** — solo `service_role`.

---

## Levantarlo en local

Requisitos: Node 20+, una cuenta de Supabase y (opcional) Docker si quieres correr Supabase local.

```bash
git clone https://github.com/SrPio/ayuda-terremoto-colombia.git
cd ayuda-terremoto-colombia
npm install
cp .env.example .env   # y completa los valores
npm run dev
```

### Crear el proyecto de Supabase y aplicar el esquema

```bash
npx supabase login
npx supabase projects create ayuda-terremoto-colombia --org-id <tu-org> --region sa-east-1
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

`db push` aplica las migraciones en orden:

| Archivo | Contenido |
| --- | --- |
| `0001_schema.sql` | Tablas, tipos, índices y triggers |
| `0002_rls.sql` | Políticas de seguridad: solo lectura de lo aprobado |
| `0003_functions.sql` | `haversine_km`, `match_needs`, `critical_needs`, `public_stats` |
| `0004_seed.sql` | Departamentos, categorías y los puntos oficiales iniciales |
| `0005_rate_limit.sql` | Límite por IP y aplicación de solicitudes aprobadas |

### Desplegar las Edge Functions y sus secretos

```bash
npx supabase secrets set MODERATOR_KEY="$(openssl rand -hex 32)"
npx supabase secrets set IP_HASH_SALT="$(openssl rand -hex 32)"
npx supabase secrets set TURNSTILE_SECRET="tu-secreto-de-cloudflare"   # opcional

npx supabase functions deploy submit
npx supabase functions deploy moderate
```

> `MODERATOR_KEY` es la clave con la que se entra a `/admin`. Guárdala en un gestor de contraseñas:
> no queda registrada en ningún otro lugar.

Si no configuras `TURNSTILE_SECRET`, el captcha se omite y siguen activas las demás defensas
(honeypot, tiempo mínimo de llenado y límite por IP).

### Refinar las coordenadas del seed

El seed arranca con el centro de cada ciudad. Para geocodificar las direcciones publicadas:

```bash
npm run geocode > coords.sql
```

Usa Nominatim (OpenStreetMap) respetando su política de 1 petición por segundo y con un User-Agent
identificable. Revisa el SQL generado antes de aplicarlo — un match malo es peor que no tener match.

---

## Desplegar en Vercel

```bash
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel deploy --prod
```

`vercel.json` ya incluye el rewrite de SPA y las cabeceras de caché.

---

## Datos abiertos

Los puntos publicados se pueden consultar directamente. La `anon key` es pública y solo permite
lectura de lo aprobado:

```bash
curl -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/collection_points?status=eq.approved&select=slug,nombre,ciudad,department_code,direccion,telefono,whatsapp,lat,lng,updated_at,point_needs(category_slug,cantidad_solicitada,cantidad_cubierta,unidad,urgencia)"
```

Si eres un medio, una alcaldía o otra iniciativa y quieres reutilizar estos datos, hazlo. Solo pedimos
que cites la fuente original de cada punto, que está en el campo `fuente_url`.

---

## Cómo contribuir

Hay tres formas, en orden de impacto:

1. **Aportar información.** Agrega un punto que falte o reporta uno que ya cerró, directamente en la
   aplicación. No necesitas cuenta ni saber programar. Es la contribución más valiosa.
2. **Abrir un issue.** Hay plantillas para *agregar un punto* y *corregir un punto*, por si prefieres
   GitHub o quieres aportar una lista larga.
3. **Código.** Lee [CONTRIBUTING.md](CONTRIBUTING.md). En resumen: `npm run lint` y
   `npm run typecheck` deben pasar, los comentarios y la interfaz van en español, y cualquier cambio
   que toque RLS o las Edge Functions necesita explicar en el PR por qué sigue siendo seguro.

---

## Fuentes de los datos

Los puntos iniciales provienen del mapa de centros de acopio publicado por **El Tiempo**:

> [Este es el mapa completo de los centros de acopio habilitados en Colombia para ayudar a los
> damnificados del terremoto de magnitud 7,4](https://www.eltiempo.com/datos/este-es-el-mapa-completo-de-los-centros-de-acopio-habilitados-en-colombia-para-ayudar-a-los-damnificados-del-terremoto-de-magnitud-7-3577654)

que recoge los puntos habilitados por la Cruz Roja Colombiana, la Alcaldía de Bogotá, la Gobernación
de Cundinamarca, la Alcaldía de Cali, la Alcaldía de Pereira, la Gobernación del Atlántico, las
alcaldías de Barranquilla, Cartagena, Santa Marta, Montería, Valledupar, Bucaramanga e Itagüí, los
bancos de alimentos y la red SCARE.

Cada punto guarda su `fuente_url`. La urgencia inicial es un valor editorial asignado con una regla
explícita y documentada en `0004_seed.sql`, y cualquier moderador puede corregirla.

---

## Advertencias

- **Confirma por teléfono antes de desplazarte.** Los puntos abren, se saturan y cierran de un día
  para otro. Ningún dato de esta página reemplaza una llamada.
- **Este proyecto no maneja dinero.** Si vas a hacer un aporte económico, hazlo únicamente por los
  canales oficiales de la Cruz Roja Colombiana, los bancos de alimentos o las entidades que estén
  coordinando la respuesta.
- **La información es comunitaria.** Se revisa antes de publicarse, pero puede quedar desactualizada.
  Si ves algo mal, repórtalo: es lo que mantiene esto vivo.

---

## Licencia

[MIT](LICENSE). Úsalo, cópialo, adáptalo. Si lo replicas para otra emergencia y algo del código te
sirvió, cuéntanoslo en un issue: ayuda a saber qué vale la pena mejorar.
