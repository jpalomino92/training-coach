# Mi entrenamiento

App web multiusuario para seguir rutinas de fuerza: registro de series (peso, repeticiones y RIR), memoria de la última sesión, sugerencias de doble progresión, historial y progreso por ejercicio.

## Estructura

```
index.html              Carga los scripts en orden
css/styles.css          Estilos (mobile first, modo claro y oscuro)
js/config.js            Modo 'demo' o 'supabase'
js/data/routines.js     Routine Data: los programas son solo datos
js/data/poses.js        Ilustraciones SVG de los ejercicios
js/progression.js       Progression Logic (doble progresión)
js/storage.js           Storage: adaptador local y adaptador Supabase
js/auth.js              Authentication: demo (PBKDF2) y Supabase Auth
js/app.js               UI Rendering, Workout Tracking, History, Progress, User Profile
supabase/schema.sql     Tablas + Row Level Security
build.py                Genera dist/index.html en un único archivo
```

## Programas incluidos

| id | Para quién | Días |
|---|---|---|
| `maleUpperLower` | Hombre, torso/pierna (rutina original) | 4–5 |
| `femaleFatLossMuscle` | Mujer con experiencia, pérdida de peso + ganancia muscular, prioridad en espalda y postura | 5 |
| `femaleMenopauseSafeStrength` | Mujer de 56 años, menopausia, artrosis y cirugía de columna | 3 |

Para añadir un programa nuevo, copia una entrada de `routinePrograms` en `js/data/routines.js`, cambia el `id` y los datos. No hace falta tocar `app.js`. Cada usuario tiene `routine_id` en su perfil.

## Ejecutar en local

El modo demo necesita `crypto.subtle`, que solo existe en https o localhost:

```
python3 -m http.server 8000
```

Y abre http://localhost:8000.

## Modo demo

- Las cuentas y los datos se guardan en `localStorage`, solo en ese navegador.
- La contraseña nunca se guarda: solo un hash PBKDF2-SHA256 con sal aleatoria.
- Cada usuario tiene su propia clave (`rtp2:data:<user_id>`) y cada registro lleva `user_id`.
- Cerrar sesión solo borra la sesión, nunca los datos.
- No es un sistema de seguridad real: cualquiera con acceso al dispositivo puede leer el almacenamiento del navegador.

## Pasar a producción con Supabase

1. Crea un proyecto en Supabase.
2. En SQL Editor, ejecuta `supabase/schema.sql`.
3. En Authentication > Providers, deja activado Email.
4. En `js/config.js` pon `mode: 'supabase'`, la URL del proyecto y la clave `anon` (nunca la `service_role`).
5. Publica la carpeta en Vercel, Netlify o cualquier hosting estático.

`SupabaseStore` implementa la misma interfaz que `LocalStore`, así que la interfaz no cambia. Row Level Security garantiza en el servidor que cada usuario solo lee y escribe sus filas.

## Comprobaciones realizadas

Probado con jsdom: registro, inicio de sesión, contraseña incorrecta, alta de perfil, aviso obligatorio en el programa de 56 años, registro, edición y borrado de series, finalización automática y manual, notas, sensación de dolor, historial, progreso por semanas, sugerencia de subir peso tras 12/12/12/12 con RIR 2, separación de datos entre dos usuarios, persistencia tras cerrar sesión, importación de pesos de la versión anterior y ausencia de errores en consola.
