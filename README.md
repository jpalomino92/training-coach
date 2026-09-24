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
- **Perfil → Descanso**: los descansos de la rutina o los tuyos (básicos y accesorios por separado). Los datos de la rutina no cambian.
- **Perfil → Importar y exportar**: CSV de peso corporal y del historial de series (`,` o `;`, coma decimal, fechas `dd/mm/aaaa` o `aaaa-mm-dd`), con vista previa y errores por línea. Plantillas descargables.
- **Contraseña**: "¿Olvidaste tu contraseña?" envía un enlace (modo Supabase) y "Cambiar contraseña" en Perfil.

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
3. Authentication → URL Configuration: pon la URL pública de la app en **Site URL** y añade `https://TU-APP/**` en **Redirect URLs** (enlaces de confirmación y de recuperación de contraseña, que vuelven a `/?recuperar=1`).
   Para enviar correos a cualquier persona hace falta un SMTP propio (Authentication → Emails → SMTP Settings): el servicio de correo incluido en Supabase solo envía a los miembros del equipo del proyecto y muy pocos por hora.
   Si el proyecto se creó con una versión anterior de `schema.sql`, ejecuta las migraciones de `supabase/migrations/` en orden.
4. Pruebas contra el proyecto real (usan `.env.supabase.local`, que no se sube al repositorio):
   - `npm run test:supabase` → Row Level Security: un usuario no puede leer, cambiar, borrar ni escribir datos de otro.
   - `npm run test:e2e:supabase` → la app de producción (con service worker) conectada a Supabase, incluido el uso sin conexión.
   - Usan dos cuentas fijas (`SUPABASE_TEST_EMAIL` con los alias `+test-a` y `+test-b`, y `SUPABASE_TEST_PASSWORD`), que se vacían antes de cada prueba. Se crean la primera vez: en ese momento "Confirm email" tiene que estar desactivado. Supabase limita los registros por hora, por eso no se crean cuentas nuevas en cada ejecución.

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
