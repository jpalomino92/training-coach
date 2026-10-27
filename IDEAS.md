# Ideas

Lista viva de funcionalidades para la app. Se van sacando y agregando.
Estados: **en curso**, **pendiente**, **en pausa** (con el motivo) y **hecha**.

## Pendientes

### Por verificar y completar

- **Aviso push del descanso**: probarlo en el teléfono con la app publicada e instalada (Android y iPhone).
  La Edge Function `rest-push` usa `npm:web-push`; si falla en Supabase, cambiar a una librería para Deno.
  Ver los logs de `rest-push` si no llega la notificación.
- **Rutina con IA con el catálogo de ExerciseDB**: probarla con OpenAI de verdad (solo se probó con datos
  de prueba) y revisar que la IA use bien `ref`. Requiere `import-routine` desplegada de nuevo.
- **Vídeos del especialista**: faltan el 13, 14, 15 y del 21 al 26.
- **Buscar en el catálogo desde el editor**: al añadir un ejercicio, buscar en español entre los ~1.300 del
  catálogo de ExerciseDB sin conexión (hay que traducir los nombres una vez), además de la búsqueda en vivo.
- **Asistidos en Progreso**: el gráfico de un ejercicio asistido muestra la ayuda; conviene indicar que
  bajar es mejor (o invertir el eje).

### Gamificación

Premiar la **constancia y la buena técnica**, no los kilos ni el volumen (la rutina de la especialista
no compite en peso y nadie tiene que forzar con dolor). Marcar dolor y parar nunca resta.

- **Fase 1: ritmo semanal y nivel de la mascota** (sin cambios en Supabase)
  - Racha de **semanas cumplidas** según la rutina de cada uno (4 días ella, 5 vos); el descanso no la corta.
  - **Comodín** mensual para una semana de enfermedad o viaje. La semana de descarga cuenta como cumplida.
  - **Experiencia** por sesión: terminarla, completar las series, registrar el RIR, hacer calentamiento
    y movilidad, ganarle a la mascota de hace un mes.
  - Rocky **evoluciona de aspecto** cada 5 niveles (accesorios: gorrito, capa, corona…) y usa las poses de
    ejercicio de `design/rocky` (press, sentadilla, flexiones, soga, correr, festejo) en Hoy y al subir de nivel.
- **Fase 2: álbum de animales y logros**
  - Cada animal del comparador se desbloquea la primera vez que el volumen semanal lo alcanza
    (álbum de figuritas con siluetas grises de lo que falta).
  - Álbum aparte por **minutos de movilidad y cardio**, para que la rutina de la especialista no quede en desventaja.
  - Logros de constancia ("primer mes completo", "12 semanas seguidas"), de progreso ("superaste un estancamiento",
    "primer récord en cada ejercicio") y de cuidado ("hiciste la alternativa en vez de forzar", "completaste la descarga").
  - **Nunca** logros por entrenar con dolor, por ir al fallo ni por días seguidos sin descanso.
- **Fase 3: misiones semanales** cortas y personalizadas según el historial ("subí el peso en 1 ejercicio",
  "hacé los 4 días", "15 min de cardio final en 3 sesiones"), siempre alcanzables.
- **Fase 4: liga familiar** (ver "Liga familiar de animales"): barra común cooperativa, reacción 💪 cuando
  otro completa su sesión, sin ranking individual.
- **Recompensas cosméticas**: colores de días, temas, fondos de la tarjeta de la mascota y del resumen para
  compartir. Nada que cambie el entrenamiento.

### Recordatorios

Avisos (notificaciones de la PWA) de "hoy te toca Torso A" según la semana tipo y "hace 4 días que no entrenás".
Pensado sobre todo para quien entrena en días fijos.

### Seguimiento del dolor

La app ya guarda "dolor" por ejercicio (FeelPicker). Aprovecharlo: mapa de "este ejercicio te molestó 3 veces
este mes", sugerir la alternativa automáticamente y bajar la carga si se repite. Clave para artrosis o columna.

### Resumen para compartir

Imagen tipo "Wrapped" semanal o mensual (volumen en animales, récords, racha, nivel de la mascota)
para mandar por WhatsApp.

### Metas y 1RM estimado

Estimar el 1RM de los básicos y fijar metas ("100 kg en sentadilla") con una fecha proyectada según el ritmo de progreso.

### Medidas corporales

Cintura, cadera, brazo, muslo y pecho junto al peso corporal, con gráficos. Es la base de la verificación biométrica.

### Ideas tomadas de openGym

Vistas en [openGym](https://github.com/DuarteSantos8/openGym). Su código tiene licencia AGPL: tomar solo la
idea y programarla de cero; no copiar código ni sus ejercicios propios.

- **Mapa muscular**: qué músculos trabajaste en la semana, sobre una silueta. Los dibujos de
  [MuscleMap](https://github.com/melihcolpan/MuscleMap) tienen licencia MIT y se pueden usar.
- **Importar historial** desde Strong, Hevy o FitNotes (exportan CSV).
- **Perfiles de equipo**: marcar qué material tienes (banco, barra de dominadas…) y ocultar o
  cambiar los ejercicios que lo necesitan.
- **Ejercicios "solo sostener"** (plancha, colgarse, sentadilla en pared) que arrancan como tiempo solos.

### La cámara como juez de técnica

Filmarse una serie y detectar la pose en el navegador (p. ej. MediaPipe):
contar repeticiones, medir el recorrido y detectar trampas
(hombro que sube en la elevación lateral, cadera que se despega en la prensa).
Solo cuentan las repeticiones limpias. Probar bien en celulares de gama media.

### Liga familiar de animales

Meta semanal compartida en equipo con el comparador de animales
("esta semana la familia levantó 1 ballena y 3 elefantes").
Retos cooperativos, no competitivos (entrenamientos o minutos de cardio entre todos),
colección de animales que se desbloquean con rachas.
Reutiliza los grupos con código de invitación del modo entrenador.

### Integracion con datos externos inteligentes

Integrar la app para que se conecte a balanzas inteligentes, o smartwatch para sumar datos de caminatas y ejercicios.

### verificacion biometrica

te ayude y guie asacarte fotos donde te diga como pararte, donde pararte que posciones hacer para hacer un registro de biometricas, crecimiento muscular, disminucion de tallas y ir trackeando cambios fisicos.

## En pausa

### Avisos al entrenador

Bandeja para el entrenador: dolor marcado, alumno que dejó la rutina asignada,
semana incompleta, ejercicio estancado.
**Motivo:** todavía no se ofrece la app a entrenadores.

## Hechas

- Pedidos de la familia (28/10): Rocky anima en Hoy según la semana (festeja, saca bíceps o te echa de
  menos) y salta en el resumen final con "Llevas 2 de 4 esta semana"; "Para hoy, lleva" (agua, toalla,
  guantes, tobillera de polea, pesoneras, banda, esterilla según los ejercicios; se apaga en Perfil);
  calentamiento solo en el primer básico de cada músculo del día; entrenamientos abiertos se cierran solos
  tras 4 h sin actividad (con la hora de la última serie); ejercicios asistidos (menos ayuda es mejor:
  progresión, récords, Rocky, descarga y volumen); aviso push al terminar el descanso aunque la app esté
  cerrada (cron cada 5 s + Edge Function `rest-push`; en iPhone, con la app instalada).

- Rocky, el ratón musculoso, reemplaza al fantasma (misma lógica: tu yo de hace un mes). Poses por humor:
  canchero señalándote (va ganando), brazos cruzados (parejo), sorprendido (vas ganando), agotado (le ganaste)
  y sentado triste (10 días sin entrenar). Las 18 poses de las láminas están en `design/rocky` para la gamificación.

- Carga de rutinas externas, fases 1 a 3: "Mis rutinas" para todos, importar Excel o CSV, y fotos, PDF o
  texto con IA (OpenAI en la Edge Function `import-routine`, 2 usos de IA por persona y mes). Fase 3: el peso
  anotado en la hoja (kg, bloques, libras o peso corporal) queda como peso inicial y viene puesto en la serie 1
  la primera vez; los enlaces de vídeo de la hoja se guardan en el ejercicio; "Ver hoja original" muestra la
  planilla, el texto o las fotos y el PDF (bucket `routine-sources`).
- Rutina a medida con IA desde el perfil inicial (y desde Cambiar de rutina): varios objetivos, días, minutos,
  lugar, lesiones y preferencias. Usa los ejercicios del catálogo, se revisa en el editor y, con lesiones,
  pide aceptar las precauciones y usa progresión prudente. Comparte el límite de 2 usos de IA al mes.
  Además de esos ejercicios puede elegir del catálogo de ExerciseDB (~1.300, filtrados según el lugar),
  que llegan con músculos y paso a paso en español; sin GIF por licencia.
- Vídeos del especialista: 17 de 26 cargados (faltan 13, 14, 15 y 21 a 26).

- Series de calentamiento: en los básicos con carga, escalera hasta el peso de la serie 1
  (con barra: barra sola × 10, 50 % × 5, 70 % × 3, 85 % × 1 y discos por lado; si no, 50 % × 8 y 75 % × 4).
  No se registran. Se puede apagar en Perfil.
- Detección de estancamiento: ≥ 3 semanas y ≥ 3 sesiones sin superar la mejor marca, o 3 sesiones
  seguidas perdiendo contra el fantasma. Planes de 4 semanas: bajar un 10 % y volver a subir, pasar a la
  alternativa o "ahora no". Marca "Estancado" en Progreso.
- Semana de descarga: se propone tras 7 semanas seguidas entrenando (10 % menos de peso, 3–4 en reserva);
  no cuenta para el fantasma ni para el estancamiento.

- Fantasma de hace un mes: cada serie se compara con tu sesión de hace ~4 semanas
  (o la más antigua de una semana anterior si aún no hay un mes), y el resumen final
  cuenta en cuántos ejercicios le ganaste. Se puede desactivar en Perfil.
- Fantasma mascota: dibujo con 5 caras (sobrado, rival, asustado, derrotado, triste) en cada ejercicio,
  en el popup final y en una tarjeta en Progreso. Sube de nivel (y de tamaño) por cada semana que le ganas,
  cuenta la racha y se pone triste y transparente tras 10 días sin entrenar.
- Rutina del especialista, biseries y circuitos, resumen con animales al terminar.
- Cambiar de rutina con historial compartido, hombro según Boulder Shoulders Bible, cardio final.
