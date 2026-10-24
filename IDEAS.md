# Ideas

Lista viva de funcionalidades para la app. Se van sacando y agregando.
Estados: **en curso**, **pendiente**, **en pausa** (con el motivo) y **hecha**.

## Pendientes

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

### Carga de rutinas personalizadas externas — **en curso** (fases 1 y 2 hechas)

si tengo una rutina en PDF o un archivo de texto o escrita a mano, subirla con fotos o archivos para que el sistema la reconozca y la cargue en el sistema.

- **Fase 1 (hecha):** "Mis rutinas" para todos los usuarios (tabla `user_programs`), importar desde
  Excel (.xlsx) o CSV con plantilla, copiar una rutina y crear desde cero. Siempre se revisa en el editor
  antes de guardar; los ejercicios se emparejan con el catálogo y los desconocidos quedan marcados "Revisar".
- **Fase 2 (hecha y activada en Supabase):** fotos, PDF y texto libre con IA (OpenAI, clave solo en la
  Edge Function `import-routine`). Límite de **2 lecturas con IA por usuario y por mes** (las que fallan no cuentan).
  Pasos en el README (sección "Importar rutinas con IA"). Caso de prueba: "ejercicios mama.xlsx" en PDF o fotos.
- **Fase 3 (pendiente):** pesos anotados en la hoja como peso inicial, "ver hoja original".

### Creacion de rutinas personalizadas en base a la informacion del Onboarding.

ESTO ES OPTATIVO ,dejar opcion de que ellos cargen su propia rutina.
que en el onboarding deje seleccionar varias opciones como "ganar fuerza y ganar musculo" o cualquier convinacion para que esto ayude a que un Agente de IA genere una rutina personalizada en base a los datos proporcionados.
con esto debemos mejorar el onboarding

## En pausa

### Avisos al entrenador

Bandeja para el entrenador: dolor marcado, alumno que dejó la rutina asignada,
semana incompleta, ejercicio estancado.
**Motivo:** todavía no se ofrece la app a entrenadores.

## Hechas

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
