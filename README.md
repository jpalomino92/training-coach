# THE Training coach

App web (PWA) para seguir rutinas de fuerza: registro de series (peso, repeticiones y RIR), última sesión, sugerencias de doble progresión, temporizador de descanso, historial, progreso por ejercicio y peso corporal.

React 18 + TypeScript + Vite. Backend en producción: Supabase (Auth + PostgreSQL con Row Level Security). Modo demo con almacenamiento local para desarrollo y pruebas.

## Comandos

```
npm install
npm run dev          # http://localhost:5173 (modo demo por defecto)
npm run test         # Vitest: lógica y componentes
npm run test:e2e     # Playwright en móvil (375 y 390 px)
npm run screenshots  # capturas de todas las pantallas en screenshots/ (5 anchos × claro/oscuro)
npm run build        # lint + tsc + build de producción en dist/
npm run build:single # un único index.html en dist-single/ (solo modo demo)
```

## Configuración

Copia `.env.example` a `.env`:

- `VITE_APP_MODE=demo` → cuentas y datos en `localStorage` de este navegador.
- `VITE_APP_MODE=supabase` → rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la clave pública `anon`, nunca la `service_role`) y ejecuta `supabase/schema.sql` en el SQL Editor del proyecto.

El nombre de la app es la constante `APP_NAME` de `src/config.ts`.

## Estructura

```
src/config.ts            APP_NAME, modo y claves por variables de entorno
src/domain/              routines (datos), poses (SVG), progression, workout (selectores), format, types
src/services/auth/       DemoAuth (PBKDF2, nunca contraseñas en claro) y SupabaseAuth
src/services/storage/    LocalStore y SupabaseStore con la misma interfaz; todo lleva user_id
src/state/               AppContext (sesión, datos, navegación) y TimerContext
src/components/          Componentes reutilizables (mismos nombres de clase que design/components.css)
src/views/               Hoy, Rutina, Progreso (+ peso corporal), Historial, Perfil, acceso y perfil inicial
src/styles/              tokens.css (copia literal de design/tokens.css) y CSS por componente
supabase/schema.sql      Tablas + Row Level Security
tests/unit, tests/e2e    Vitest + Testing Library, Playwright
legacy/                  Prototipo original (fuera del build), solo como referencia
```

## Funciones

- **Hoy**: una serie a la vez, rellenada con la última sesión; temporizador de descanso (sonido y vibración al terminar, pantalla encendida opcional); sensación por ejercicio; notas; récords personales al superar tu mejor marca; constancia semanal ("Esta semana: 2 de 4").
- **Alternativa del día** ("¿Máquina ocupada?"): usa la alternativa de la rutina; sus series se guardan aparte (clave `ejercicio__alt`) con su propio historial y sugerencia.
- **Resumen al terminar**: duración, series, volumen, récords y comparación con la sesión anterior del mismo día. **Nota del entrenamiento** que se guarda sola.
- **Deshacer** al borrar una serie, un entrenamiento o un peso corporal. **Calculadora de discos** en los ejercicios con barra (barra de 20, 15 o 10 kg). **Calendario mensual** en Historial.
- **Perfil → Descanso**: los descansos de la rutina o los tuyos (básicos y accesorios por separado). Los datos de la rutina no cambian.
- **Perfil → Importar y exportar**: CSV de peso corporal y del historial de series (`,` o `;`, coma decimal, fechas `dd/mm/aaaa` o `aaaa-mm-dd`), con vista previa y errores por línea. Plantillas descargables.
- **Contraseña**: "Cambiar contraseña" en Perfil (pide la actual).

## Rutinas

Los programas son solo datos (`src/domain/routines.ts`). Para añadir uno, copia una entrada de `routinePrograms`, cambia el `id` y los datos; la interfaz no se toca. Cada ejercicio tiene `weightStep` (2,5 kg por defecto; 1 kg con mancuernas y en la rutina de 56 años). Las rutinas con `safety.requiresHealthNotice` exigen aceptar el aviso de salud al elegirlas.

`tests/unit/routines.test.ts` comprueba que el contenido de las rutinas coincide literalmente con el del prototipo.

## Modo demo

- La contraseña nunca se guarda: solo un hash PBKDF2-SHA256 con sal aleatoria.
- Cada usuario tiene su propia clave (`fuerza:v1:data:<user_id>`) y cada registro lleva `user_id`.
- Cerrar sesión solo borra la sesión, nunca los datos.
- No es un sistema de seguridad real: cualquiera con acceso al dispositivo puede leer el almacenamiento del navegador.

## Supabase

1. Crea el proyecto y ejecuta `supabase/schema.sql` en SQL Editor.
2. Authentication → Sign In / Providers → Email: con "Confirm email" activado, la app pide confirmar el correo antes de iniciar sesión.
3. Authentication → URL Configuration: pon la URL pública de la app en **Site URL** y añade `https://TU-APP/**` en **Redirect URLs** (enlaces de confirmación de email).
   Para enviar correos a cualquier persona hace falta un SMTP propio (Authentication → Emails → SMTP Settings): el servicio de correo incluido en Supabase solo envía a los miembros del equipo del proyecto y muy pocos por hora.
   Si el proyecto se creó con una versión anterior de `schema.sql`, ejecuta las migraciones de `supabase/migrations/` en orden.
4. Pruebas contra el proyecto real (usan `.env.supabase.local`, que no se sube al repositorio):
   - `npm run test:supabase` → Row Level Security: un usuario no puede leer, cambiar, borrar ni escribir datos de otro.
   - `npm run test:e2e:supabase` → la app de producción (con service worker) conectada a Supabase, incluido el uso sin conexión.
   - Usan dos cuentas fijas (`SUPABASE_TEST_EMAIL` con los alias `+test-a` y `+test-b`, y `SUPABASE_TEST_PASSWORD`), que se vacían antes de cada prueba. Se crean la primera vez: en ese momento "Confirm email" tiene que estar desactivado. Supabase limita los registros por hora, por eso no se crean cuentas nuevas en cada ejecución.

### Aviso al terminar el descanso (notificaciones push)

Cada persona lo activa en su teléfono (Perfil › "Aviso fuera de la app"). Al empezar un descanso la app
apunta la hora de fin en `push_subscriptions`; cada 5 s un cron de Supabase llama a la Edge Function
`rest-push` si hay alguna vencida, y esta manda la notificación. Si la app está a la vista al terminar,
el aviso se cancela (ya suena la app). En iPhone necesita la app instalada en la pantalla de inicio.

1. SQL Editor: ejecuta `supabase/migrations/2026-10-28_rest_push.sql` (activa `pg_cron` y `pg_net`).
2. Edge Functions → Deploy a new function → Via Editor: nombre `rest-push`, pega
   `supabase/functions/rest-push/index.ts` y deja "Verify JWT" activado.
3. Edge Functions → Secrets: `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (las genera el script de abajo en
   `.env.push`, que no se sube al repo) y, opcional, `VAPID_SUBJECT` (`mailto:` de contacto).
   La clave pública también va en `src/config.ts` (`VAPID_PUBLIC_KEY`).
4. SQL Editor, con los datos de tu proyecto (Settings → API):
   ```sql
   select vault.create_secret('https://<proyecto>.supabase.co/functions/v1/rest-push', 'rest_push_url');
   select vault.create_secret('<clave anon>', 'rest_push_key');
   ```

Claves nuevas: `node -e "const c=require('crypto');const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'jwk'});console.log(Buffer.concat([Buffer.from([4]),Buffer.from(k.x,'base64url'),Buffer.from(k.y,'base64url')]).toString('base64url'),k.d)"`
(pública y privada). Si cambian, las suscripciones existentes dejan de valer y hay que reactivar el aviso.

### Importar rutinas con IA

Las rutinas en fotos, PDF o texto libre se leen con OpenAI desde la Edge Function
`supabase/functions/import-routine` (la clave nunca llega a la app). La misma función crea rutinas a medida
con las respuestas del perfil inicial (`generate`). Hay un límite de 2 usos de IA (leer o crear) por
persona y mes, y un uso que falla no cuenta. Importar desde Excel o CSV no usa IA y no tiene límite.
Las fotos y el PDF originales se guardan en el bucket privado `routine-sources` para "Ver hoja original".

Para crear rutinas, además de los ejercicios de las rutinas incluidas, la IA puede elegir del catálogo de
ExerciseDB (`src/data/exercise-catalog.json`, ~1.300 ejercicios filtrados según dónde entrena la persona):
devuelve el nombre exacto del catálogo en `ref` y el ejercicio llega con sus músculos y el paso a paso
en español. Es solo texto, sin GIF (las animaciones tienen otra licencia, ver `NOTICE.md`). El archivo se
regenera con `node scripts/exercise-catalog.mjs` y se carga aparte, solo al crear una rutina.

1. SQL Editor: ejecuta `supabase/migrations/2026-10-24_user_programs.sql`, `2026-10-25_ai_imports.sql`
   y `2026-10-27_routine_sources.sql`.
2. Edge Functions → Secrets: añade `OPENAI_API_KEY` (opcional: `OPENAI_MODEL`, por defecto `gpt-5-mini`,
   y `AI_IMPORTS_PER_MONTH`, por defecto 2).
3. Edge Functions → Deploy a new function → Via Editor: nombre `import-routine` y pega el contenido de
   `supabase/functions/import-routine/index.ts`. Deja activado "Verify JWT".
   Con la CLI: `supabase functions deploy import-routine` y `supabase secrets set OPENAI_API_KEY=sk-...`.
4. En OpenAI conviene fijar un límite de gasto mensual (Settings → Limits).

### Sin conexión

En modo Supabase la app funciona sin red (`src/services/storage/offlineStore.ts`):

- Cada cambio se guarda al momento en una copia local del dispositivo y se apunta en una cola.
- La cola se envía a Supabase en orden cuando hay conexión (al volver la red, al abrir la app y cada 20 s si falla). Los registros se crean con su id en el dispositivo, así la copia local y el servidor coinciden.
- Fallo de red o sesión caducada: se reintenta. Rechazo definitivo del servidor: se descarta y se avisa. Duplicado: cuenta como enviado.
- La app abre sin conexión con la última copia y la sesión de este dispositivo. Iniciar sesión o crear una cuenta sí necesita internet.
- Un aviso muestra "Sin conexión" y los cambios pendientes mientras quede algo por enviar.

## Publicar gratis

**Vercel** (`vercel.json` incluido): importa el repositorio en vercel.com → framework Vite → añade en Settings → Environment Variables `VITE_APP_MODE=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` → Deploy.

**Netlify** (`netlify.toml` incluido): Add new site → Import from Git → añade las mismas variables en Site configuration → Environment variables → Deploy.

Las dos sirven HTTPS (necesario para instalar la PWA y para el cifrado del modo demo), redirigen todas las rutas a `index.html` y no cachean `sw.js`, para que las actualizaciones lleguen enseguida.
