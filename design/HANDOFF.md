# Handoff de diseño · app de entrenamiento de fuerza

Para Claude Code. Diseño completo en el lienzo "App de fuerza — diseño" (páginas **Wireframes**, **Alta fidelidad** y **Modo oscuro**; la de modo oscuro repite cada pantalla en la misma posición). Esta nota resume las decisiones; los valores exactos están en `tokens.css` y la referencia de componentes en `components.css` (mismos nombres de clase que el lienzo, HTML + CSS sin frameworks).

## Cómo aplicar los tokens

- `<html data-theme="light|dark" data-day="red|blue|yellow|green|black">`.
- `data-theme`: la preferencia del usuario (Perfil → Apariencia: Automático / Claro / Oscuro). En "Automático", JS lo resuelve con `matchMedia('(prefers-color-scheme: dark)')` y escucha cambios.
- `data-day`: el color del día seleccionado. De él salen `--day`, `--day-tint`, `--day-tint-2`, `--day-text` y `--day-ink`, y `--accent` pasa a ser `--day`. En pantallas sin día (acceso) queda en azul.
- Safe areas: `viewport-fit=cover` en el meta viewport y `env(safe-area-inset-*)` en la cabecera, el menú inferior y el temporizador.
- Breakpoints: hasta 899 px, menú inferior fijo. Desde 600 px el contenido se centra a 720 px como máximo. Desde 900 px el menú pasa a una barra superior y el temporizador flota abajo a la derecha.

## Decisiones de diseño

1. **Hoy es una sola tarea a la vez.** Solo el ejercicio activo está abierto; los hechos y los siguientes son filas plegadas de 72 px.
2. **Registrar una serie = un toque en el caso normal.** Cada serie llega rellenada con la misma serie de la última sesión (o con la serie anterior de hoy) y muestra "Última vez: 40 kg × 11".
3. **Peso con − / +** de 2,5 kg (paso configurable por ejercicio). El peso va en su propia fila para que todos los botones midan 64 px incluso a 375 px.
4. **El color del día manda:** disco, borde de la tarjeta activa, chip de series, fondo de la serie en edición, botón principal, barra de progreso y pestaña activa.
5. **Contraste:** `--muted` pasa de #6A7180 a #5F6675. En el día amarillo el texto sobre el color es oscuro. En modo oscuro los colores del día se aclaran y el "negro" se ve gris (#9AA1AF) para que se distinga del fondo.
6. **El aviso de salud es informativo** (azul, --info-tint), no una alarma. El rojo se reserva para el dolor y para borrar.
7. **Los estados nunca dependen solo del color:** cada uno lleva símbolo y texto (○ ◐ ✓, iconos en las sugerencias).

## Qué cambia respecto al diseño actual

- Tarjetas plegables en Hoy en lugar de una lista larga con todos los ejercicios abiertos.
- La fila de serie pasa de tres campos en línea a: peso con − / + arriba, reps y RIR debajo, botón de 56 px.
- Nuevo bloque de referencia por serie ("Última vez").
- Estados del día visibles en cada disco (marca abajo a la derecha).
- Tokens nuevos: `--surface-2`, `--surface-3`, `--line-strong`, tintes de estado (`--ok-tint`, `--warn-tint`, `--danger-tint`, `--info`, `--info-tint`), `--day-tint`, `--day-tint-2`, `--day-text`, `--day-ink` y `--timer-bg`.
- El perfil inicial se divide en 2 pasos (datos → rutina).
- Selector de apariencia en Perfil.
- Interruptor "Mostrar peso corporal" en Perfil (encendido por defecto). Apagado, Progreso no muestra el selector Ejercicios / Peso ni la opción de registrar peso; los registros se conservan. Guardar como preferencia del usuario (`showBodyWeight`).

## Interacciones nuevas

- **Cabecera compacta fija** al hacer scroll en Hoy: disco pequeño, nombre del día, "7 / 32" y la barra de progreso.
- **Al volver a Hoy** con un entrenamiento en marcha, la página baja sola hasta la serie activa.
- **Sin botón "Empezar":** la primera serie registrada pone el día "En progreso".
- **Completar serie:** guarda, arranca el temporizador con el descanso del ejercicio, vibra 30 ms (`navigator.vibrate`, si existe) y activa la serie siguiente.
- **Temporizador:** "+15 s", visible en todas las pestañas (tocarlo vuelve a Hoy). Al terminar vibra 200 ms y se cierra solo a los 5 s. Se calcula con la hora de fin para que funcione con la pantalla bloqueada.
- **Al completar un ejercicio:** "¿Cómo lo sentiste hoy?" dentro de la tarjeta y el botón "Siguiente: …", que la pliega y abre la siguiente.
- **Si se marca "Dolor"**, la próxima vez el ejercicio muestra la alerta roja con la indicación de detenerse y el enlace a la alternativa.
- **Historial:** la confirmación de borrado aparece dentro de la propia tarjeta, con el foco en "Cancelar".
- **Progreso:** filtro por día con los discos y gráfico con tooltip al tocarlo.
- **Ilustraciones con GIF** del repositorio de ejercicios (formato de referencia: `videos/0002-Hy9D21L.gif`, 1:1 sobre blanco). Van en un cuadrado con esquinas redondeadas: 88 px con radio 18 en la tarjeta activa, 52 px con radio 12 en las filas y 36 px con radio 8 en las listas. Fondo #FFF también en modo oscuro, borde interior de 2 px `--day-tint-2` y `object-fit: contain`. Sin GIF se usa la figura de palitos sobre `--day-tint-2`. Con `prefers-reduced-motion` se muestra un fotograma fijo. `alt` vacío, porque el nombre del ejercicio ya está al lado. Carga diferida (`loading="lazy"`) en todas las filas plegadas.
- **Peso corporal** dentro de Progreso, con un selector "Ejercicios / Peso corporal" (sin sexta pestaña). Incluye el último registro, la variación desde el inicio, 3 cifras resumen, un gráfico con rango (4 semanas / 3 meses / todo) y tooltip, una nota sobre la variación diaria, la lista de registros y una hoja inferior "Registrar peso" con − / + de 0,1 kg. La variación va siempre en color neutro.

## Accesibilidad

- Controles de 48 px como mínimo (56 px los principales, 64 px los campos numéricos).
- Foco visible: contorno de 3 px `--focus` a 3 px de distancia; nunca `outline: none` sin sustituto.
- Contrastes AA en claro y en oscuro con los tokens tal cual.
- Botones deshabilitados con `aria-disabled` (siguen siendo enfocables) y el motivo en `aria-describedby`.
- Errores con `aria-invalid`, mensaje enlazado y `role="alert"` en los errores de envío.
- La serie recién registrada usa `role="status"`; el temporizador solo anuncia el final.

## Pendiente de revisar

- Licencia del repositorio de GIFs antes de usarlo en producción.

## Textos pendientes de confirmar

Nombre de la app ("[Nombre de la app]"), texto del modo demo, nombres de las 3 rutinas y de sus días, y el texto del aviso de salud (conviene que lo revise un profesional sanitario).

## Especificación de componentes

### Botón

**Medidas**

- Alto 56 px (pequeño y enlace: 48 px de área táctil).
- Radio 14 px (pequeño 12 px). Relleno horizontal 20 px.
- Texto Barlow Condensed 600, 21 px (pequeño 18 px). Icono 22 px con 8 px de separación.

**Estados**

- Primario: fondo --accent (color del día), texto --accent-ink.
- Secundario: fondo --surface, borde interior 2 px --line-strong.
- Enlace: sin fondo, subrayado a 3 px.
- Peligro: fondo --danger, solo para eliminar.
- Hover: primario mezcla 8 % de negro; secundario fondo --surface-2.
- Pulsado: translateY(1px).
- Foco: contorno 3 px --focus a 3 px de distancia.
- Deshabilitado: aria-disabled="true", fondo --surface-3, texto --muted.
- Cargando: texto "Un momento…", spinner, aria-busy="true".

**Comportamiento**

- Un solo primario por vista.
- Deshabilitado sigue siendo enfocable y explica el motivo con aria-describedby.
- Mientras carga no admite un segundo toque.

### Campo

**Medidas**

- Texto: 56 px de alto, radio 12, borde 2 px --line-strong, 17 px.
- Numérico: 64 px de alto, Barlow Condensed 700 a 32 px, cifras tabulares, centrado.
- Peso: botones − y + de 64 × 64 a los lados del campo.

**Estados**

- Vacío: placeholder "—".
- Foco: borde --day-text (o --accent) y halo de 4 px al 25 %.
- Error: borde --danger, fondo --danger-tint, mensaje con icono debajo; aria-invalid y aria-describedby.
- Solo lectura.

**Comportamiento**

- inputmode="decimal" en peso (acepta coma), "numeric" en reps y RIR.
- Al enfocar se selecciona todo el valor.
- − / + suman o restan 2,5 kg; el paso se puede definir por ejercicio (1 kg en mancuernas). Nunca baja de 0.
- Se valida al pulsar Completar, no mientras se escribe: reps 1–50, RIR 0–5, peso 0–500.

### Disco de día

**Medidas**

- 56 px en el selector; 40 px en listas, 36 px en la cabecera compacta, 30–32 px en miniatura.
- Texto Barlow Condensed 700, 19 px.
- Aros interiores: 4 px rgba(0,0,0,.16) y 6 px rgba(255,255,255,.22).
- Marca de estado de 22 px abajo a la derecha, con borde de 2 px del color --bg.

**Estados**

- No iniciado: marca vacía.
- En progreso: marca a medias.
- Completado: marca verde con ✓.
- Seleccionado: aro de 3 px del fondo + 3 px del color del disco; aria-current="true".

**Comportamiento**

- Cambiar de disco cambia --day en toda la pantalla (data-day).
- Si no caben, la fila hace scroll horizontal.
- Texto oscuro sobre el amarillo y en modo oscuro.
- aria-label del tipo "F2, en progreso".

### Interruptor

**Medidas**

- 56 × 32 px, pulgar de 26 px; área táctil ampliada a 48 px de alto.
- Fila de ajuste: relleno 14 / 16, título de 17 px y descripción de 15 px.

**Estados**

- Apagado: fondo --line-strong.
- Encendido: fondo --accent, pulgar a la derecha.
- Foco visible con el contorno estándar.

**Comportamiento**

- role="switch" y aria-checked; toda la fila describe el ajuste con aria-labelledby y aria-describedby.
- "Mostrar peso corporal": apagado oculta el selector Ejercicios / Peso en Progreso y el acceso a registrar peso; los datos no se borran.
- El cambio se aplica al momento, sin botón Guardar.

### Chip

**Medidas**

- 32 px de alto, relleno 0 12, radio completo, 15 px.
- Chip clave (series × reps): fondo --day, Barlow Condensed 700 a 18 px.

**Estados**

- Informativo: sin estados interactivos.

**Comportamiento**

- Los filtros no son chips: son botones redondeados de 48 px con aria-pressed.

### Tarjeta de ejercicio

**Medidas**

- Radio 20, relleno 20 / 16, separación interna 16 px.
- Activa: borde 2 px --day y sombra --sh-2.
- Ilustración: cuadrado de 88 px con radio 18 en la tarjeta activa, 52 px con radio 12 en las filas y 36 px con radio 8 en las listas.
- Nombre: Barlow Condensed 700, 24 px.

**Estados**

- Plegada: fila de 72 px (siguiente o hecha).
- Activa, con última sesión.
- Sin datos previos.
- Completa: borde --ok, "¿Cómo lo sentiste hoy?" y "Siguiente: …".

**Comportamiento**

- Solo hay una tarjeta abierta a la vez.
- Al tocar "Siguiente" se pliega y se abre la siguiente con scroll suave.
- La ilustración es un GIF del repositorio de ejercicios (1:1, fondo blanco): fondo #FFF en claro y en oscuro, borde interior de 2 px --day-tint-2, object-fit: contain. Sin GIF se usa la figura de palitos sobre --day-tint-2.
- Con prefers-reduced-motion se muestra un fotograma fijo (PNG) en lugar del GIF. alt vacío, porque el nombre está al lado.

### Fila de serie

**Medidas**

- Editable: fondo --day-tint, radio 16, relleno 14 / 12. Arriba el peso con − / +; debajo reps y RIR en dos columnas; botón de 56 px.
- Registrada: mínimo 56 px, fondo --ok-tint, check de 28 px y "Editar" como enlace de 48 px.
- Pendiente: 48 px con borde discontinuo.

**Estados**

- Pendiente, editable, con foco, con error.
- Deshabilitada: sin peso ni reps.
- Recién registrada: aro --ok de 2 px durante 2 s, role="status".
- Editando una registrada: Guardar / Cancelar y "Eliminar serie".

**Comportamiento**

- Se rellena con la misma serie de la última sesión, o con la serie anterior de hoy.
- Completar guarda la serie, inicia el descanso del ejercicio, vibra 30 ms si el dispositivo lo permite y activa la serie siguiente.
- Editar abre la serie en su sitio y no reinicia el temporizador.

### Bloque "Última sesión"

**Medidas**

- Fondo --surface-2, radio 12, relleno 12 / 14.
- Etiqueta con la fecha.
- Tres cifras de 28 px: peso, reps ("12 / 11 / 10") y RIR final.

**Estados**

- Con datos.
- Primera vez: borde discontinuo y una indicación de cómo elegir el peso.

**Comportamiento**

- Si el peso cambió entre series se muestra el rango: "40–42,5 kg".

### Sugerencia

**Medidas**

- Radio 12, relleno 12 / 14, icono en círculo de 28 px.
- Primero la acción en negrita y después el motivo.

**Estados**

- Subir (--ok), mantener (--muted), bajar (--warn), dolor (--danger, con borde y role="alert").

**Comportamiento**

- Dolor tiene prioridad sobre todo lo demás.
- Subir: todas las series llegan al máximo del rango con el RIR indicado.
- Bajar: alguna serie quedó por debajo del mínimo, o con RIR 0 antes del mínimo.
- Mantener: cualquier otro caso.
- Nunca promete resultados.

### Aviso de salud

**Medidas**

- Compacto (Hoy): fondo --info-tint, radio 12, icono info de 22 px, título de 16 px, una frase y el enlace "Leer aviso completo".
- Completo (perfil inicial): tarjeta con la lista de avisos y una casilla obligatoria de 24 px dentro de una etiqueta de 48 px o más.

**Estados**

- Compacto.
- Completo sin marcar: "Empezar" deshabilitado, con el motivo.
- Completo marcado.

**Comportamiento**

- Solo aparece en las rutinas que lo requieren (requiresHealthNotice).
- Se guarda la fecha de aceptación.
- El enlace abre el texto completo en una hoja inferior.

### Temporizador de descanso

**Medidas**

- Flotante: 12 px de margen lateral; abajo, menú (64 px) + safe area + 12 px.
- Radio 20, fondo --timer-bg, tiempo a 44 px con cifras tabulares.
- Botones de 48 px: "+15 s" y "Saltar". Barra de 6 px en --day.

**Estados**

- Cuenta atrás.
- Terminado: fondo verde, "Descanso terminado" y la serie que toca.
- En otras pestañas: tocarlo vuelve a Hoy.

**Comportamiento**

- Se calcula con la hora de fin (Date.now) para que funcione aunque se bloquee la pantalla.
- Al terminar vibra 200 ms y se cierra solo a los 5 s o con "Cerrar".
- aria-live="polite" solo anuncia el final.

### Menú inferior

**Medidas**

- 64 px + env(safe-area-inset-bottom). Fondo --surface con borde superior --line.
- 5 pestañas iguales, icono de 22 px en una píldora de 54 × 30 y etiqueta Barlow Condensed 600 a 13 px.

**Estados**

- Activa: píldora --day-tint-2, color --day-text, aria-current="page".

**Comportamiento**

- Desde 900 px pasa a una barra superior de 72 px.
- El temporizador flota siempre por encima del menú.

### Tarjeta de historial

**Medidas**

- Plegada: fila de 72 px con disco de 40 px, fecha + día y estado.
- Abierta: borde 2 px --day; una fila por ejercicio con "60 kg × 10 / 10 / 9 / 9 · RIR 1".

**Estados**

- Completado.
- Terminado sin completar: "◐ Terminado con 20 de 26 series".
- Confirmación de borrado.

**Comportamiento**

- "Eliminar entrenamiento" abre la confirmación dentro de la propia tarjeta y lleva el foco a "Cancelar".
- Al eliminar, la tarjeta se retira y se anuncia "Entrenamiento eliminado".

### Tarjeta de progreso

**Medidas**

- Radio 20, relleno 16.
- Ilustración de 48 px, nombre y día; dos cifras de 28 px (último peso y peso máximo).
- Gráfico de 64 px: línea de 2 px en --day-text, sin ejes, punto final de 9 px con aro --surface.
- Evolución: "Semana 1 → 32,5 kg" y "Semana 7 → 40 kg".

**Estados**

- Con datos.
- Con menos de 2 semanas: el gráfico se sustituye por "Necesitas 2 semanas de datos para ver la evolución".

**Comportamiento**

- Un punto por semana: el peso máximo de esa semana.
- Al tocar o pasar el cursor por el gráfico aparece "Semana 4 · 37,5 kg".
- El aria-label resume la tendencia.

### Peso corporal

**Medidas**

- Selector Ejercicios / Peso corporal: 52 px de alto, fondo --surface-3, opción activa en --surface con --sh-1.
- Cifra principal a 56 px con "kg" a 28 px. Variación en una píldora neutra de 32 px.
- Tres cifras resumen de 28 px. Gráfico de 326 × 190 px con 3 líneas de guía y etiquetas de 12 px.
- Hoja "Registrar peso": radio superior 24; campo de 72 px con − / + de 0,1 kg.

**Estados**

- Con datos, vacío y hoja de registro abierta.
- Punto seleccionado en el gráfico: aro --accent, línea guía discontinua y etiqueta "15/09 · 74,6 kg".

**Comportamiento**

- La variación se muestra en color neutro, sin verde ni rojo: el peso no se presenta como éxito o fracaso.
- Rango: 4 semanas, 3 meses o todo. Un punto por registro.
- El último valor lleva etiqueta directa; al tocar un punto aparece su fecha y peso.
- La lista de registros hace de tabla accesible del gráfico; cada fila se puede editar.
- La nota explica que el peso varía de un día a otro y que importa la tendencia.
