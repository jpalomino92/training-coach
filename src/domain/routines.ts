/* ==========================================================
   Routine Data
   Cada programa es solo DATOS. La app no tiene lógica específica
   de ningún programa: para añadir una rutina nueva basta con
   añadir una entrada a routinePrograms.
   Contenido copiado literalmente del prototipo (legacy/js/data/routines.js);
   solo se añade weightStep.
   ========================================================== */
import type { Exercise, Program } from './types';

type Extra = Partial<Pick<Exercise, 'perSide' | 'warn' | 'compound' | 'weightStep'>>;

/** Paso de peso por defecto (kg) para los botones − / +. */
export const DEFAULT_WEIGHT_STEP = 2.5;

/**
 * E(key, nombre, series, rango, rir, descanso(s), pose, músculo, técnica, alternativa, extra)
 * rango: '8-12' (repeticiones) o '30-45s' (segundos)
 * extra: { perSide, warn, compound, weightStep }
 * `key` identifica el ejercicio para el historial y el progreso.
 */
function E(key: string, name: string, sets: number, range: string, rir: string, rest: number, pose: string, muscle: string, cue: string, alt: string, extra?: Extra): Exercise {
  const isTime = /s$/.test(range);
  const [a, b] = range.replace('s', '').split('-').map(Number);
  return {
    key, name, sets,
    reps: { min: a, max: b || a },
    unit: isTime ? 's' : 'reps',
    rir, rest, pose, muscle, cue, alt,
    perSide: false, warn: '', compound: false, weightStep: DEFAULT_WEIGHT_STEP,
    ...extra
  };
}

export const PAIN_GUIDE = {
  normal: 'Molestia muscular normal: ardor o cansancio en el músculo que trabajas durante la serie, y agujetas difusas 24–48 h después que mejoran al moverte.',
  stop: 'Señales para detenerte: dolor articular, punzante o que aumenta con cada repetición; dolor en la columna; dolor que se irradia a brazos o piernas; hormigueo, entumecimiento o pérdida de fuerza repentina.',
  action: 'Si aparece alguna señal de alarma, detén el ejercicio y no lo retomes hasta consultarlo con un profesional sanitario. Nunca entrenes a través de un dolor agudo.'
};

export const routinePrograms: Record<string, Program> = {

  /* ------------------------------------------------------
     PROGRAMA ORIGINAL (hombre) — se conserva tal cual
     ------------------------------------------------------ */
  maleUpperLower: {
    id: 'maleUpperLower',
    name: 'Torso / Pierna con prioridad en piernas',
    shortName: 'Torso / Pierna',
    audience: 'Hombre',
    level: 'Intermedio',
    daysPerWeek: '4–5',
    description: 'Rutina torso/pierna para ganar y conservar músculo durante la pérdida de peso, con tres días de pierna si entrenas cinco.',
    intensity: 'RIR 1–3. En los básicos pesados deja 2–3 repeticiones en reserva; en máquinas puedes acercarte al fallo en la última serie.',
    progression: { minRirToProgress: 1, cautious: false, step: '2,5 kg en básicos y 1–2 kg en accesorios' },
    safety: { requiresHealthNotice: false, warnings: [] },
    weekPlan: [['L', 'PA'], ['M', 'TA'], ['X', null], ['J', 'PB'], ['V', 'TB'], ['S', 'PC'], ['D', null]],
    cardio: '8–10 mil pasos al día y 2–3 sesiones de 20–30 min moderadas, lejos de los días de pierna o después del torso.',
    tips: [
      'Proteína: 1,6–2,2 g por kg de peso al día. Prioriza la proteína en cada comida.',
      'Baja entre 0,5 y 1 % de tu peso por semana. Más rápido suele costar músculo.',
      'Cuéntale a tu médico que entrenas fuerza, sobre todo al ajustar la dosis de medicación.'
    ],
    days: [
      { id: 'PA', name: 'Pierna A', focus: 'Cuádriceps', color: 'red', exercises: [
        E('squat_bar', 'Sentadilla con barra', 4, '6-8', '2-3', 150, 'squat', 'Cuádriceps y glúteo', 'Pies a la anchura de hombros. Baja al menos hasta el paralelo con el pecho alto.', 'Sentadilla en Smith o hack', { compound: true }),
        E('rdl_bar', 'Peso muerto rumano', 3, '8-10', '2', 150, 'rdl', 'Isquiotibiales y glúteo', 'Rodillas casi fijas. Lleva la cadera atrás hasta sentir estirar el isquio.', 'Peso muerto rumano con mancuernas', { compound: true }),
        E('leg_press', 'Prensa', 3, '10-12', '2', 90, 'legpress', 'Cuádriceps', 'La zona lumbar no se despega del respaldo. No bloquees las rodillas arriba.', 'Sentadilla hack', { compound: true }),
        E('leg_curl_lying', 'Curl femoral tumbado', 3, '10-12', '1-2', 90, 'legcurl', 'Isquiotibiales', 'Cadera pegada al banco. Baja lento, en 3 segundos.', 'Curl femoral sentado'),
        E('calf_standing', 'Gemelos de pie', 4, '10-15', '1-2', 60, 'calf', 'Gemelos', 'Pausa de 1 segundo abajo, en estiramiento completo.', 'Gemelos en prensa'),
        E('plank', 'Plancha frontal', 3, '30-45s', '2', 45, 'plank', 'Core', 'Glúteo apretado y cuerpo en línea recta.', 'Plancha con rodillas apoyadas'),
        E('knee_raise', 'Elevaciones de rodillas', 3, '10-12', '2', 45, 'kneeraise', 'Core', 'Sube sin balancearte y controla la bajada.', 'Dead bug')
      ]},
      { id: 'TA', name: 'Torso A', focus: 'Fuerza en básicos', color: 'blue', exercises: [
        E('bench_press', 'Press banca', 4, '6-8', '2-3', 150, 'bench', 'Pectoral y tríceps', 'Escápulas juntas y abajo. La barra baja a la línea del pecho.', 'Press en máquina', { compound: true }),
        E('row_bar', 'Remo con barra', 4, '8-10', '2', 150, 'row', 'Dorsales y espalda media', 'Espalda neutra, torso inclinado. Tira la barra hacia el ombligo.', 'Remo en máquina', { compound: true }),
        E('shoulder_press_db', 'Press militar con mancuernas', 3, '8-10', '2', 90, 'ohp', 'Deltoides', 'Abdomen firme, sin arquear la espalda. Sube hasta casi estirar.', 'Press de hombros en máquina', { compound: true, weightStep: 1 }),
        E('lat_pulldown', 'Jalón al pecho', 3, '10-12', '2', 90, 'pullup', 'Dorsales', 'Lleva los codos hacia las costillas, pecho hacia la barra.', 'Dominadas asistidas'),
        E('lateral_raise', 'Elevaciones laterales', 3, '12-15', '1-2', 60, 'lateral', 'Deltoide lateral', 'Codos ligeramente flexionados. Sube hasta la altura del hombro.', 'Elevación lateral en polea', { weightStep: 1 }),
        E('curl_db', 'Curl de bíceps', 3, '10-12', '1-2', 60, 'curl', 'Bíceps', 'Codos quietos pegados al cuerpo. Puedes hacerlo en superserie con el tríceps.', 'Curl en polea baja', { weightStep: 1 }),
        E('triceps_pushdown', 'Tríceps en polea', 3, '10-12', '1-2', 60, 'pushdown', 'Tríceps', 'Codos fijos a los lados. Estira del todo abajo.', 'Extensión con mancuerna')
      ]},
      { id: 'PB', name: 'Pierna B', focus: 'Glúteo, isquios y unilateral', color: 'yellow', exercises: [
        E('hip_thrust', 'Hip thrust con barra', 4, '8-10', '2', 150, 'hipthrust', 'Glúteo mayor', 'Espalda alta en el banco. Aprieta glúteo arriba 1 segundo, mentón abajo.', 'Hip thrust en máquina', { compound: true }),
        E('bulgarian_split', 'Sentadilla búlgara', 3, '8-10', '2', 150, 'lunge', 'Cuádriceps y glúteo', 'Pie trasero en el banco. Baja recto, peso en el talón delantero.', 'Estocada trasera', { perSide: true, compound: true }),
        E('hack_squat', 'Sentadilla hack o frontal', 3, '8-10', '2', 150, 'squat', 'Cuádriceps', 'Torso más vertical que en la sentadilla normal.', 'Prensa con pies bajos', { compound: true }),
        E('leg_curl_seated', 'Curl femoral sentado', 3, '10-12', '1-2', 90, 'legcurl', 'Isquiotibiales', 'Controla la fase de vuelta, sin soltar el peso.', 'Curl femoral tumbado'),
        E('leg_ext', 'Extensión de cuádriceps', 3, '12-15', '1-2', 90, 'legext', 'Cuádriceps', 'Pausa arriba 1 segundo con el cuádriceps apretado.', 'Sissy squat asistida'),
        E('calf_seated', 'Gemelos sentado', 4, '12-15', '1-2', 60, 'calf', 'Sóleo y gemelos', 'Recorrido completo, sin rebotes.', 'Gemelos en prensa')
      ]},
      { id: 'TB', name: 'Torso B', focus: 'Volumen e hipertrofia', color: 'green', exercises: [
        E('incline_db', 'Press inclinado con mancuernas', 4, '8-10', '2', 150, 'incline', 'Pectoral superior', 'Banco a 30°. Baja hasta sentir estirar el pecho.', 'Press inclinado en máquina', { compound: true, weightStep: 1 }),
        E('pullup', 'Dominadas o jalón', 4, '6-10', '2', 150, 'pullup', 'Dorsales', 'Empieza colgado con brazos estirados. Pecho hacia la barra.', 'Dominadas asistidas', { compound: true }),
        E('cable_row', 'Remo en polea baja', 3, '10-12', '2', 90, 'cablerow', 'Espalda media', 'Torso quieto. Junta las escápulas al final del tirón.', 'Remo en máquina'),
        E('dips', 'Fondos o press en máquina', 3, '8-10', '2', 90, 'dips', 'Pectoral y tríceps', 'Inclínate un poco hacia delante. Baja hasta que el codo forme 90°.', 'Press de pecho en máquina'),
        E('face_pull', 'Face pull', 3, '12-15', '2', 60, 'facepull', 'Deltoide posterior', 'Tira de la cuerda hacia la frente, abriendo las manos.', 'Pájaros con mancuernas'),
        E('hammer_curl', 'Curl martillo', 3, '10-12', '1-2', 60, 'curl', 'Bíceps y braquial', 'Agarre neutro, como sosteniendo un martillo.', 'Curl con cuerda en polea', { weightStep: 1 }),
        E('triceps_ext', 'Extensión de tríceps', 3, '10-12', '1-2', 60, 'pushdown', 'Tríceps', 'Codos fijos. Estira del todo en cada repetición.', 'Tríceps en polea')
      ]},
      { id: 'PC', name: 'Pierna C', focus: 'Opcional, 5.º día', color: 'black', optional: true, exercises: [
        E('deadlift', 'Peso muerto convencional', 3, '5-6', '2-3', 180, 'deadlift', 'Cadena posterior', 'Barra pegada a las piernas. Empuja el suelo con los pies, espalda neutra.', 'Peso muerto con barra hexagonal', { compound: true }),
        E('leg_press_high', 'Prensa con pies altos', 3, '10-12', '2', 90, 'legpress', 'Glúteo e isquios', 'Pies arriba en la plataforma para cargar más glúteo e isquio.', 'Hip thrust', { compound: true }),
        E('walking_lunge', 'Zancadas caminando', 3, '10-12', '2', 90, 'walklunge', 'Cuádriceps y glúteo', 'Paso largo, la rodilla trasera casi toca el suelo.', 'Estocada en Smith', { perSide: true }),
        E('leg_curl_lying', 'Curl femoral tumbado', 3, '10-12', '1-2', 90, 'legcurl', 'Isquiotibiales', 'Baja lento, en 3 segundos.', 'Curl femoral sentado'),
        E('abductor_machine', 'Abductor y aductor', 2, '12-15', '1-2', 60, 'abductor', 'Glúteo medio y aductores', 'Movimiento controlado, pausa en la apertura.', 'Abducción con banda'),
        E('calf_standing', 'Gemelos de pie', 3, '12-15', '1-2', 60, 'calf', 'Gemelos', 'Pausa arriba y abajo.', 'Gemelos en prensa')
      ]}
    ]
  },

  /* ------------------------------------------------------
     PERFIL 1 — Mujer, pérdida de peso + ganancia muscular
     Referencia: Etapa 2 Mujer
     ------------------------------------------------------ */
  femaleFatLossMuscle: {
    id: 'femaleFatLossMuscle',
    name: 'Recomposición con prioridad en espalda y postura',
    shortName: 'Recomposición',
    audience: 'Mujer',
    level: 'Intermedio (1 año o más entrenando)',
    daysPerWeek: '5',
    description: 'Fuerza e hipertrofia para mantener y ganar músculo mientras pierdes grasa. Espalda y estabilidad escapular repartidas en tres días, glúteo en tres días y core corto tres veces por semana.',
    intensity: 'RIR 1–2 en máquinas y ejercicios de aislamiento; RIR 2 en los básicos (sentadilla, hip thrust, peso muerto rumano, remos pesados).',
    progression: { minRirToProgress: 1, cautious: false, step: '1–2,5 kg en básicos y el mínimo disponible en accesorios' },
    safety: {
      requiresHealthNotice: false,
      warnings: [
        'Si sientes dolor (no molestia muscular) en la espalda durante un ejercicio, detente y usa la alternativa.',
        'Un sujetador deportivo de sujeción alta puede hacer más cómodos los ejercicios en los que te inclinas.'
      ]
    },
    weekPlan: [['L', 'F1'], ['M', 'F2'], ['X', 'F3'], ['J', 'F4'], ['V', 'F5'], ['S', null], ['D', null]],
    cardio: '3–4 sesiones de 30–45 min a intensidad moderada (caminata en pendiente, bici o elíptica), en días distintos o después de las pesas, nunca justo antes. Suma pasos diarios.',
    tips: [
      'Con Mounjaro el apetito baja: prioriza la proteína en cada comida para proteger el músculo y consulta con tu médico cuánta necesitas.',
      'Si pierdes peso muy rápido o la fuerza baja varias semanas seguidas, coméntalo con tu médico.',
      'El trabajo de espalda busca fortalecer la musculatura postural; si las molestias persisten, consulta con un fisioterapeuta.'
    ],
    days: [
      { id: 'F1', name: 'Día 1', focus: 'Pierna: glúteo e isquios', color: 'red', exercises: [
        E('hip_thrust', 'Hip thrust con barra', 4, '8-12', '2', 120, 'hipthrust', 'Glúteo mayor', 'Espalda alta apoyada en el banco y mentón hacia el pecho. Sube hasta alinear tronco y muslos y aprieta 1 s.', 'Hip thrust en máquina o puente de glúteo con barra', { compound: true }),
        E('rdl_db', 'Peso muerto rumano con mancuernas', 3, '8-12', '2', 120, 'rdl', 'Isquiotibiales y glúteo', 'Rodillas un poco flexionadas. Lleva la cadera atrás con la espalda neutra hasta sentir el estiramiento.', 'Peso muerto rumano en Smith', { compound: true, warn: 'Si lo notas en la zona lumbar en vez de en los isquios, reduce el recorrido y el peso.', weightStep: 1 }),
        E('leg_curl_lying', 'Curl femoral tumbado', 3, '10-15', '1-2', 90, 'legcurl', 'Isquiotibiales', 'Cadera pegada al banco. Sube controlado y baja en 3 segundos.', 'Curl femoral sentado'),
        E('kickback_cable', 'Patada de glúteo en polea', 3, '12-15', '1-2', 60, 'kickback', 'Glúteo mayor', 'Tronco un poco inclinado y abdomen firme. Lleva la pierna atrás sin arquear la zona lumbar.', 'Patada de glúteo en máquina', { perSide: true }),
        E('abductor_machine', 'Abductores en máquina', 3, '15-20', '1-2', 60, 'abductor', 'Glúteo medio', 'Abre de forma controlada, pausa 1 s y vuelve lento.', 'Abducción con banda de pie'),
        E('dead_bug', 'Dead bug', 3, '8-10', '2', 45, 'deadbug', 'Core (anti-extensión)', 'Zona lumbar en contacto con el suelo. Estira brazo y pierna contrarios sin que se despegue.', 'Dead bug solo con piernas', { perSide: true }),
        E('plank', 'Plancha frontal', 3, '30-45s', '2', 45, 'plank', 'Core (anti-extensión)', 'Glúteo apretado, costillas abajo y cuerpo en línea.', 'Plancha con rodillas apoyadas')
      ]},
      { id: 'F2', name: 'Día 2', focus: 'Espalda y postura', color: 'blue', exercises: [
        E('lat_pulldown_neutral', 'Jalón al pecho agarre neutro', 4, '8-12', '2', 90, 'pullup', 'Dorsales', 'Pecho alto y lleva los codos hacia abajo y hacia las costillas, sin balancear el tronco.', 'Jalón en máquina o dominadas asistidas', { compound: true }),
        E('cable_row', 'Remo sentado en polea', 4, '8-12', '2', 90, 'cablerow', 'Dorsales, romboides y trapecio medio', 'Espalda erguida. Tira hacia el ombligo y junta las escápulas al final.', 'Remo en máquina', { compound: true }),
        E('chest_supported_row', 'Remo con pecho apoyado', 3, '10-12', '2', 90, 'chestrow', 'Trapecio medio y romboides', 'Pecho pegado al banco inclinado. Lleva los codos atrás y aprieta las escápulas 1 s.', 'Remo en máquina con apoyo de pecho'),
        E('pullover_cable', 'Pullover en polea', 3, '12-15', '2', 60, 'pullover', 'Dorsales', 'Brazos casi estirados. Lleva la barra desde arriba hasta los muslos sin mover el tronco.', 'Pullover con mancuerna en banco'),
        E('face_pull', 'Face pull', 3, '12-15', '2', 60, 'facepull', 'Deltoide posterior y trapecio medio', 'Tira de la cuerda hacia la frente, separando las manos y girando los hombros hacia fuera.', 'Face pull con banda'),
        E('y_raise', 'Elevación en Y en banco inclinado', 3, '10-12', '2', 60, 'yraise', 'Trapecio inferior', 'Pecho apoyado. Sube los brazos en forma de Y con los pulgares arriba y los hombros lejos de las orejas. Peso ligero.', 'Elevación en Y en polea baja'),
        E('curl_db', 'Curl de bíceps con mancuernas', 3, '10-12', '1-2', 60, 'curl', 'Bíceps', 'Codos quietos a los lados. Sube y baja controlado.', 'Curl en polea baja', { weightStep: 1 })
      ]},
      { id: 'F3', name: 'Día 3', focus: 'Pierna: cuádriceps', color: 'yellow', exercises: [
        E('smith_squat', 'Sentadilla en Smith', 4, '8-12', '2', 120, 'squat', 'Cuádriceps y glúteo', 'Pies un poco adelantados. Baja con control hasta donde mantengas la espalda neutra.', 'Sentadilla hack o goblet', { compound: true }),
        E('leg_press', 'Prensa', 3, '10-15', '2', 120, 'legpress', 'Cuádriceps y glúteo', 'La zona lumbar no se despega del respaldo. No bloquees las rodillas arriba.', 'Sentadilla hack', { compound: true }),
        E('reverse_lunge_db', 'Estocada trasera con mancuernas', 3, '10-12', '2', 90, 'walklunge', 'Cuádriceps y glúteo', 'Paso atrás largo y torso erguido. Empuja con el talón de la pierna delantera.', 'Estocada en Smith', { perSide: true, weightStep: 1 }),
        E('leg_ext', 'Sillón de cuádriceps', 3, '12-15', '1-2', 60, 'legext', 'Cuádriceps', 'Sube hasta estirar, pausa 1 s arriba y baja lento.', 'Extensión de rodilla con banda'),
        E('adductor_machine', 'Aductores en máquina', 2, '12-15', '1-2', 60, 'abductor', 'Aductores', 'Cierra controlado, sin rebotar.', 'Aductor en polea'),
        E('pallof', 'Pallof press', 3, '10-12', '2', 45, 'pallof', 'Core (anti-rotación)', 'De lado a la polea y con las manos en el pecho. Empuja al frente y resiste el giro 2 s.', 'Pallof con banda', { perSide: true })
      ]},
      { id: 'F4', name: 'Día 4', focus: 'Torso: empuje y espalda alta', color: 'green', exercises: [
        E('chest_press_machine', 'Press de pecho en máquina', 3, '8-12', '2', 90, 'chestpress', 'Pectoral y tríceps', 'Escápulas atrás y abajo todo el recorrido. Empuja sin despegar la espalda del respaldo.', 'Press inclinado con mancuernas', { compound: true }),
        E('shoulder_press_db', 'Press de hombros sentada', 3, '8-12', '2', 90, 'ohp', 'Deltoides', 'Respaldo casi vertical, abdomen firme y sin arquear la espalda.', 'Press de hombros en máquina', { compound: true, weightStep: 1 }),
        E('machine_row_wide', 'Remo en máquina agarre abierto', 3, '10-12', '2', 90, 'cablerow', 'Trapecio medio, romboides y deltoide posterior', 'Codos a la altura del pecho. Tira hacia atrás y junta las escápulas.', 'Remo en polea con barra ancha'),
        E('lateral_raise', 'Elevaciones laterales', 3, '12-15', '1-2', 60, 'lateral', 'Deltoide lateral', 'Codos un poco flexionados. Sube hasta la altura del hombro sin encoger el cuello.', 'Elevación lateral en polea', { weightStep: 1 }),
        E('reverse_fly', 'Pájaros en máquina', 3, '12-15', '1-2', 60, 'reversefly', 'Deltoide posterior y romboides', 'Brazos casi estirados. Abre hacia atrás juntando las escápulas.', 'Pájaros con mancuernas con pecho apoyado'),
        E('triceps_rope', 'Tríceps en polea con cuerda', 3, '10-15', '1-2', 60, 'pushdown', 'Tríceps', 'Codos pegados. Estira del todo abajo y separa la cuerda.', 'Extensión de tríceps con mancuerna')
      ]},
      { id: 'F5', name: 'Día 5', focus: 'Glúteo, espalda y core', color: 'black', exercises: [
        E('bulgarian_split', 'Sentadilla búlgara', 3, '8-10', '2', 90, 'lunge', 'Glúteo y cuádriceps', 'Pie trasero en el banco. Inclina un poco el tronco adelante para trabajar más glúteo.', 'Estocada trasera en Smith', { perSide: true, compound: true }),
        E('hip_ext_45', 'Extensión de cadera a 45°', 3, '12-15', '2', 60, 'hipext45', 'Glúteo e isquios', 'Empuja con la cadera, no con la zona lumbar, y para al alinear el cuerpo. Sin pasar de esa línea.', 'Puente de glúteo a una pierna', { warn: 'Si notas molestia lumbar, cambia a la alternativa.' }),
        E('one_arm_row', 'Remo a un brazo con mancuerna', 3, '10-12', '2', 90, 'row', 'Dorsal', 'Mano y rodilla apoyadas en el banco, espalda plana. Lleva el codo hacia la cadera.', 'Remo unilateral en polea', { perSide: true, weightStep: 1 }),
        E('lat_pulldown_supine', 'Jalón al pecho agarre supino', 3, '10-12', '2', 90, 'pullup', 'Dorsales y bíceps', 'Palmas hacia ti. Lleva la barra a la parte alta del pecho con el pecho alto.', 'Jalón con agarre neutro'),
        E('kickback_machine', 'Patada de glúteo en máquina', 3, '12-15', '1-2', 60, 'kickback', 'Glúteo mayor', 'Abdomen firme. Extiende la cadera sin arquear la espalda.', 'Patada de glúteo en polea', { perSide: true }),
        E('farmer_walk', 'Paseo del granjero', 3, '30-40s', '2', 60, 'farmer', 'Core, trapecio y agarre', 'Mancuernas pesadas a los lados, hombros atrás y abajo. Camina erguida.', 'Sostener las mancuernas de pie', { weightStep: 1 }),
        E('side_plank', 'Plancha lateral', 3, '20-30s', '2', 45, 'sideplank', 'Oblicuos (estabilidad lateral)', 'Codo bajo el hombro, cadera alta y cuerpo en línea.', 'Plancha lateral con rodillas apoyadas', { perSide: true })
      ]}
    ]
  },

  /* ------------------------------------------------------
     PERFIL 2 — Mujer de 56 años, menopausia, artrosis,
     antecedente de cirugía de columna.
     Referencia: Etapa 1 Mujer, adaptada por seguridad
     ------------------------------------------------------ */
  femaleMenopauseSafeStrength: {
    id: 'femaleMenopauseSafeStrength',
    name: 'Fuerza segura para preservar y ganar músculo',
    shortName: 'Fuerza segura',
    audience: 'Mujer',
    level: 'Principiante o retomando',
    daysPerWeek: '3',
    description: 'Tres sesiones de cuerpo completo con máquinas, apoyos y poleas. Cada músculo se trabaja 2–3 veces por semana con cargas moderadas y técnica controlada, evitando carga sobre la columna.',
    intensity: 'RIR 2–4. Nunca al fallo. En ejercicios nuevos o delicados, RIR 3–4 durante las primeras semanas.',
    progression: { minRirToProgress: 2, cautious: true, step: 'el incremento mínimo disponible (1–2 kg o una placa)' },
    safety: {
      requiresHealthNotice: true,
      ackText: 'He leído el aviso y revisaré esta rutina con mi médico o fisioterapeuta antes de empezar.',
      warnings: [
        'Debido al antecedente de cirugía de columna y artrosis, esta rutina debe ser revisada por el médico, fisioterapeuta o profesional sanitario que conozca tu historial antes de comenzar.',
        'Si aparece dolor agudo, irradiado, hormigueo, entumecimiento o síntomas neurológicos, detener el ejercicio y consultar a un profesional sanitario.'
      ],
      rules: [
        'Calienta 5–8 min en bici estática o elíptica antes de cada sesión.',
        'Esta rutina no incluye barra sobre los hombros, peso muerto con barra, flexiones de tronco con peso, giros con carga, saltos ni ejercicios de impacto.',
        'Trabaja siempre en un rango de movimiento cómodo y sin dolor articular.',
        'Respira de forma continua y no aguantes la respiración al empujar.'
      ]
    },
    weekPlan: [['L', 'SA'], ['M', null], ['X', 'SB'], ['J', null], ['V', 'SC'], ['S', null], ['D', null]],
    cardio: 'Caminar 30–45 min 3–4 veces por semana a un ritmo que te permita hablar (los días sin pesas son ideales). La bici estática y la elíptica son buenas opciones de bajo impacto. Evita saltar la soga y trotar salvo que tu profesional sanitario lo autorice.',
    tips: [
      'El entrenamiento de fuerza puede contribuir a mantener la masa muscular y la salud ósea después de la menopausia.',
      'Es normal empezar con cargas bajas. La constancia y la técnica generan el estímulo; la carga llega con las semanas.',
      'Consulta con tu médico cuánta proteína te conviene, sobre todo si tienes alguna condición renal.'
    ],
    days: [
      { id: 'SA', name: 'Día A', focus: 'Pierna y tracción', color: 'red', exercises: [
        E('leg_press', 'Prensa de piernas', 3, '10-12', '3', 120, 'legpress', 'Cuádriceps y glúteo', 'Baja solo hasta donde la pelvis y la zona lumbar siguen pegadas al respaldo. Empuja con todo el pie.', 'Sentarse y levantarse de un banco', { compound: true, warn: 'No hagas recorridos profundos si la zona lumbar se despega del respaldo o si notas dolor en rodilla o cadera.', weightStep: 1 }),
        E('leg_curl_seated', 'Curl femoral sentado', 3, '10-12', '2-3', 90, 'legcurl', 'Isquiotibiales', 'Espalda apoyada en el respaldo. Flexiona y vuelve lento en 3 segundos.', 'Curl femoral con banda, sentada', { weightStep: 1 }),
        E('lat_pulldown_neutral', 'Jalón al pecho agarre neutro', 3, '10-12', '2-3', 90, 'pullup', 'Dorsales', 'Sentada con los muslos sujetos. Lleva los codos hacia abajo sin echar el tronco atrás.', 'Jalón en máquina con apoyo de pecho', { compound: true, weightStep: 1 }),
        E('machine_row_supported', 'Remo en máquina con apoyo de pecho', 3, '10-12', '2-3', 90, 'cablerow', 'Espalda media y alta', 'El apoyo de pecho quita carga a la zona lumbar. Lleva los codos atrás y junta las escápulas.', 'Remo sentado en polea con espalda erguida', { weightStep: 1 }),
        E('abductor_machine', 'Abductores en máquina', 2, '12-15', '2-3', 60, 'abductor', 'Glúteo medio', 'Espalda apoyada. Abre controlado en un rango cómodo para la cadera.', 'Abducción con banda, sentada', { weightStep: 1 }),
        E('dead_bug', 'Dead bug suave', 2, '6-8', '3', 60, 'deadbug', 'Core (estabilidad)', 'Empieza moviendo solo los brazos o solo las piernas. La zona lumbar se mantiene quieta y sin dolor.', 'Respiración abdominal tumbada con rodillas flexionadas', { perSide: true, warn: 'Si aparece dolor lumbar, detente y consulta la alternativa con tu fisioterapeuta.', weightStep: 1 })
      ]},
      { id: 'SB', name: 'Día B', focus: 'Glúteo y empuje', color: 'blue', exercises: [
        E('glute_bridge', 'Puente de glúteo', 3, '10-15', '3', 90, 'glutebridge', 'Glúteo mayor', 'Pies apoyados. Sube hasta alinear cadera y muslos apretando el glúteo, sin arquear la zona lumbar.', 'Hip thrust en máquina con carga ligera', { warn: 'Progresa de peso corporal a banda y después a un peso ligero sobre la cadera.', weightStep: 1 }),
        E('box_squat', 'Sentadilla a banco con mancuerna', 3, '8-12', '3', 120, 'boxsquat', 'Cuádriceps y glúteo', 'Mancuerna ligera al pecho. Siéntate controlada en un banco alto y levántate empujando el suelo.', 'Prensa de piernas', { compound: true, warn: 'Usa un banco a la altura que no genere dolor en rodillas ni cadera.', weightStep: 1 }),
        E('chest_press_machine', 'Press de pecho en máquina', 3, '10-12', '2-3', 90, 'chestpress', 'Pectoral y tríceps', 'Espalda apoyada en el respaldo. Empuja sin bloquear los codos.', 'Press con mancuernas en banco inclinado', { compound: true, weightStep: 1 }),
        E('lateral_raise_seated', 'Elevaciones laterales sentada', 2, '12-15', '2-3', 60, 'lateral', 'Deltoide lateral', 'Sentada con respaldo y mancuernas ligeras. Sube hasta un poco por debajo del hombro.', 'Elevación lateral en polea', { weightStep: 1 }),
        E('face_pull', 'Face pull con banda o polea', 2, '12-15', '2-3', 60, 'facepull', 'Deltoide posterior y trapecio medio', 'De pie y erguida. Tira hacia la cara separando las manos.', 'Remo alto con banda, sentada', { weightStep: 1 }),
        E('triceps_rope', 'Tríceps en polea', 2, '12-15', '2', 60, 'pushdown', 'Tríceps', 'Codos pegados y tronco quieto.', 'Extensión de tríceps con banda', { weightStep: 1 }),
        E('incline_plank', 'Plancha inclinada', 3, '20-30s', '3', 60, 'inclineplank', 'Core (anti-extensión)', 'Manos en un banco y cuerpo en línea. Cuanto más alta la superficie, más fácil.', 'Plancha contra la pared', { weightStep: 1 })
      ]},
      { id: 'SC', name: 'Día C', focus: 'Pierna y espalda', color: 'yellow', exercises: [
        E('leg_ext', 'Sillón de cuádriceps', 3, '10-15', '2-3', 90, 'legext', 'Cuádriceps', 'Sube controlado, pausa y baja lento, en un rango cómodo para la rodilla.', 'Extensión de rodilla con banda, sentada', { warn: 'Con artrosis de rodilla, trabaja solo en el recorrido que no genere dolor.', weightStep: 1 }),
        E('step_up', 'Subida a escalón bajo con apoyo', 2, '8-10', '3', 90, 'stepup', 'Cuádriceps y glúteo', 'Escalón bajo y una mano en un apoyo fijo. Sube empujando con el talón y baja despacio.', 'Prensa a una pierna con carga ligera', { perSide: true, weightStep: 1 }),
        E('adductor_machine', 'Aductores en máquina', 2, '12-15', '2-3', 60, 'abductor', 'Aductores', 'Espalda apoyada. Cierra controlado.', 'Pelota apretada entre las rodillas, sentada', { weightStep: 1 }),
        E('cable_row', 'Remo sentado en polea', 3, '10-12', '2-3', 90, 'cablerow', 'Dorsales y romboides', 'Espalda erguida y fija; solo se mueven los brazos. Junta las escápulas al final.', 'Remo en máquina con apoyo de pecho', { compound: true, warn: 'No balancees el tronco adelante y atrás para mover el peso.', weightStep: 1 }),
        E('pec_deck', 'Aperturas en máquina', 2, '10-12', '2-3', 60, 'pecdeck', 'Pectoral', 'Espalda apoyada. Cierra delante del pecho sin forzar los hombros.', 'Aperturas con banda', { weightStep: 1 }),
        E('curl_seated', 'Curl de bíceps sentada', 2, '10-12', '2', 60, 'curl', 'Bíceps', 'Espalda apoyada en el respaldo y codos quietos.', 'Curl en polea baja', { weightStep: 1 }),
        E('pallof', 'Pallof press', 2, '8-10', '3', 60, 'pallof', 'Core (anti-rotación)', 'De lado a la polea. Empuja al frente y resiste el giro sin rotar la columna.', 'Pallof con banda, sentada', { perSide: true, weightStep: 1 })
      ]}
    ]
  }
};

/* ---------- Índices útiles ---------- */
export const programList = (): Program[] => Object.values(routinePrograms);

export function getProgram(id: string | null | undefined, extra?: Record<string, Program>): Program {
  return (id && (extra?.[id] || routinePrograms[id])) || programList()[0];
}

/** Búsqueda por defecto: solo las rutinas incluidas. */
export const builtinLookup = (id: string): Program | undefined => routinePrograms[id];

export function findExercise(program: Program, key: string): Exercise | null {
  for (const d of program.days) for (const e of d.exercises) if (e.key === key) return e;
  return null;
}

export function findExerciseAnywhere(key: string): Exercise | null {
  for (const p of programList()) { const e = findExercise(p, key); if (e) return e; }
  return null;
}
