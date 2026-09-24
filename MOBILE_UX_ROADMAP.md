# Roadmap de UX/UI móvil de ScaleGrams

**Fecha:** 2026-09-24  
**Alcance:** frontend React de Nutrición y Entrenamiento. Documento de implementación; esta revisión no modifica la aplicación.  
**Autoridad visual:** `PRODUCT.md` y `DESIGN.md` de este repositorio. Conservar la identidad, los datos nutricionales y los flujos funcionales actuales.

## Objetivo

En una pantalla táctil, abrir un día guardado o una receta debe mostrar el detalle de inmediato en un diálogo visible y fácil de cerrar. Extender el mismo criterio al resto de la aplicación: la misma intención debe producir la misma interacción, sin detalles que aparezcan fuera del viewport, controles tapados ni cambios sorpresivos de posición.

## Hallazgos verificados en el código

| Prioridad | Superficie | Evidencia | Impacto |
| --- | --- | --- | --- |
| P0 | **Reutilizá tu día** | `src/features/day-presets/DayPresetsPage.jsx` renderiza la lista y luego un `<aside className="abm-preview-panel">`; `src/styles/19-abm.css` cambia `.day-presets-workspace` a una columna a 900 px, pero deja el preview después de toda la lista. | Al tocar cualquier tarjeta, el detalle puede quedar muy abajo; la selección cambia sin una respuesta visible inmediata. |
| P0 | **Recetas**, propias y exploración | `src/features/recipes/Recipes.jsx` inserta `.collection-browser-inline-preview` después de la tarjeta seleccionada y llama a `scrollIntoView`; `src/styles/19-abm.css` lo habilita hasta 760 px. | Abre un detalle dentro del flujo y desplaza la pantalla; se comporta distinto de días guardados y de los diálogos de la app. |
| P1 | **Corte responsive de bibliotecas** | Días guardados pasa a una columna a 900 px y recetas a 760 px; la navegación móvil comienza a 900 px en `src/styles/08-responsive-sections.css`. | Entre 761 y 900 px, experiencias equivalentes tienen topologías distintas. Verificar también el ancho útil justo por encima de 900 px, cuando vuelve la barra lateral. |
| P1 | **Inicio y estados de detalle** | `loadPresets()` selecciona automáticamente el primer día; `openRecipe()` espera la petición de detalle antes de mostrar contenido. | El futuro diálogo de días no debe abrirse solo; recetas necesitan respuesta de carga inmediata y error recuperable. |
| P1 | **Cobertura de pruebas** | `e2e/day-presets-responsive.spec.js` prueba disposición de fecha y edición, pero no la apertura de un detalle. No hay prueba equivalente de detalle móvil de recetas. | El problema puede reaparecer aunque pasen las pruebas responsive actuales. |

**Patrones útiles que ya existen:** `src/components/dialog/ModalShell.jsx` y `useDialogLifecycle.js` proveen portal, bloqueo del scroll, Escape, foco y restauración; Historial (`HistoryDayPreview`) y Calendario de entrenamiento (`TrainingDayDetail`) ya muestran días mediante diálogo. Reutilizar esta infraestructura. Las capturas antiguas de `output/playwright/` muestran versiones previas; no sirven como validación visual actual.

## Contrato móvil que debe regir toda la app

| Intención | Teléfono y tablet compacta | Escritorio amplio |
| --- | --- | --- |
| Ver el detalle completo de una entidad de biblioteca (día, receta) | En teléfono, sheet modal desde abajo de hasta 92 % del alto visible; entre 600 y 900 px, diálogo centrado y contenido. Título, cierre visible y cuerpo desplazable. | Lista y preview lateral; selección sin salto de scroll. |
| Editar o crear un elemento largo | Diálogo de tarea a pantalla completa, cuerpo desplazable y acciones siempre alcanzables. | Diálogo contenido. |
| Confirmar una operación destructiva o reemplazar datos | Diálogo compacto con consecuencias explícitas y acciones diferenciadas. | El mismo contrato semántico, con tamaño de escritorio. |
| Mostrar una aclaración breve dentro de una tarjeta | Expansión local solo si aparece junto al elemento activado y no desplaza al usuario a otra sección. | Igual, cuando resulte útil. |

**Punto de corte inicial:** usar hasta 900 px para los detalles modales de ambas bibliotecas, porque allí cambia el shell a navegación móvil. Validar el espacio disponible entre 901 y 1200 px con el sidebar abierto; si las dos columnas se comprimen, elegir un corte según el ancho real del contenedor, sin forzar un número de dispositivo. Al cambiar el tamaño mientras un detalle está abierto, mantener una sola representación accesible y un estado coherente.

El diálogo de lectura debe mostrar contenido relevante desde el primer viewport: nombre, contexto, totales y primera sección. Si excede el alto, desplazar **solo el cuerpo**; cabecera y cierre permanecen visibles. Respetar safe areas, `visualViewport`, orientación horizontal, `prefers-reduced-motion` y objetivos táctiles de 44 px o más. Cerrar con botón, Escape y backdrop; al cerrar, devolver el foco a la tarjeta que lo abrió y conservar la posición de la lista. Evitar montar dos copias accesibles del mismo preview.

## Fases de implementación

### Fase 0 — Línea base y mapa de flujos

1. Levantar el frontend con respuestas de API simuladas y datos realistas: lista vacía, 1 elemento, 20 elementos; nombre largo, descripción larga, receta con muchos ingredientes y día con todas las comidas. No usar datos de producción.
2. Capturar pantallas **actuales** de Día, Reutilizá tu día, Recetas propias, Recetas exploradas, Historial, Planes, Registrar/Alimentos, Perfil, Entrenamiento Día, Calendario, Cardio y Ejercicios a 320, 390, 430, 768, 900, 901 y 1024 px; incluir teléfono horizontal y viewport bajo con teclado. Registrar qué sucede después de cada toque principal.
3. Clasificar cada detalle: modal correcto, expansión local útil, navegación a otra pantalla o detalle remoto fuera del viewport. Usar esta clasificación para ampliar las fases 3 y 4 solo cuando haya un defecto comprobado.

**Entrega:** matriz breve de pantalla × acción × resultado, con capturas actuales y defectos reproducibles. Distinguir emulación de prueba en dispositivo físico.

### Fase 1 — Base compartida para detalles de bibliotecas

1. Crear una composición reutilizable de `NutritionCollectionPreview` dentro de `ModalShell` para detalles de lectura. Mantenerla separada de los diálogos de edición y confirmación.
2. Definir el estado de apertura explícitamente; la selección de escritorio no implica abrir un modal móvil. El componente debe aceptar título, contenido, estado de carga/error, acciones opcionales y referencia al botón disparador.
3. Darle cabecera y cierre visibles, scroll único para el cuerpo, altura que se adapte al viewport y padding de safe area. No usar `scrollIntoView` para llevar al usuario al detalle.
4. Revisar el comportamiento al rotar o cruzar el breakpoint: nunca dejar un modal invisible que bloquee scroll o foco, ni dos previews anunciados al lector de pantalla.
5. En disparadores que **abren** un diálogo, usar nombre accesible y `aria-haspopup="dialog"`; reservar `aria-pressed` para una selección persistente de escritorio. Dentro del diálogo, evitar el botón “Volver” de `NutritionCollectionPreview` si duplica el cierre de la cabecera. Si se abre una confirmación sobre el detalle, conservar una sola capa activa para foco y lector de pantalla.

**Archivos guía:** `src/components/dialog/ModalShell.jsx`, `src/components/dialog/useDialogLifecycle.js`, `src/features/shared/NutritionCollectionPreview.jsx`, `src/styles/16-dialog.css`, `src/styles/19-abm.css`.

**Aceptación:** tocar una tarjeta muestra un diálogo dentro del viewport sin mover la lista subyacente; Escape y cierre restauran foco y scroll; el título es el nombre accesible del diálogo; el contenido largo se puede recorrer por completo.

### Fase 2 — Reutilizá tu día

1. En `DayPresetsPage.jsx`, separar `selectedPreset` (preview de escritorio) de la apertura móvil. `loadPresets()` puede preseleccionar para escritorio, pero **nunca** abrir automáticamente el diálogo al cargar.
2. Al tocar `.day-preset-card-select` en modo compacto, abrir el diálogo con el día tocado. Conservar fecha de trabajo y selección al cerrar. Mantener hidratación de imágenes y descartar respuestas de un día que ya no esté seleccionado.
3. Mostrar comidas agrupadas y totales en el diálogo. La acción **Aplicar** debe estar disponible desde el detalle y continuar al diálogo actual de **Sumar/Reemplazar** cuando la fecha ya tiene elementos. No aplicar implícitamente al abrir el preview.
4. Mantener **Editar** y **Borrar** accesibles, pero reducir el ruido de tres acciones por tarjeta en 320 px: elegir una jerarquía clara, con aplicar como acción principal y eliminar detrás de una acción secundaria etiquetada. No esconder ninguna función.
5. Ocultar el `<aside>` y su estado vacío del flujo móvil; conservarlo en escritorio. Actualizar el texto “Elegí una card para revisar su contenido” por una instrucción natural y específica si sigue visible.

**Aceptación:** el día 1 y el día 20 se abren con el mismo toque y el mismo desplazamiento; la lista no salta al fondo; cerrar vuelve exactamente a la tarjeta; aplicar sobre fecha con datos exige elección explícita entre sumar y reemplazar.

### Fase 3 — Recetas propias y exploradas

1. En `Recipes.jsx`, retirar el preview intercalado por tarjeta y el efecto `scrollIntoView`. Usar el mismo diálogo de lectura de la fase 1 cuando el layout sea compacto; conservar el preview lateral en escritorio.
2. Abrir el diálogo **al tocar**, con esqueleto de carga y nombre de la receta mientras llega `/api/recipes/{id}`. Si falla, mostrar error y **Reintentar** en el propio diálogo, además de **Cerrar**. Ignorar respuestas tardías si el usuario cerró o eligió otra receta.
3. Cubrir `Mis recetas` y `Explorar recetas`, incluidos los listados por usuario. La acción **Guardar en mis recetas** debe quedar disponible y dar confirmación sin cerrar sorpresivamente el diálogo; edición y borrado conservan sus confirmaciones.
4. Mantener el punto de corte y el formato visual alineados con días guardados. El mismo tipo de detalle debe tener igual cabecera, espaciado, métricas, scroll y cierre.

**Aceptación:** ninguna receta se revela debajo de la tarjeta ni mueve el scroll de la biblioteca; la carga lenta tiene respuesta inmediata; tras cerrar se vuelve a la misma receta y posición.

### Fase 4 — Revisión transversal con cambios guiados por evidencia

Revisar y corregir los defectos reproducibles de la matriz de fase 0, en este orden:

1. **Flujos diarios y Registrar:** paneles de comida, selector de alimentos, escáner, crear/editar alimento y receta, teclado, acciones fijas y estados de carga/error. Distinguir expansión local útil de un detalle completo que requiere diálogo. Verificar que acciones por swipe también tengan alternativa visible por toque.
2. **Historial y Calendario de entrenamiento:** conservar sus diálogos existentes; alinear cabecera, desplazamiento, cierre, foco y acción principal con el contrato compartido. Probar días vacíos y densos.
3. **Planes, Perfil, Cardio y Ejercicios:** revisar listas largas, densidad de acciones, formularios, paginación, filtros y confirmaciones a 320 px y en horizontal. Verificar ancho, lectura y objetivos táctiles; corregir solo puntos que fallen, sin trasladar todos los contenidos a modales.
4. **Shell y navegación:** verificar que la barra inferior y el menú Más indiquen claramente la ubicación actual, no cubran contenido/avisos y mantengan etiquetas comprensibles en ambas modalidades. Conservar la misma lógica de navegación entre Nutrición y Entrenamiento.
5. **Texto y accesibilidad:** reemplazar “card” en instrucciones al usuario por “tarjeta” o por la acción concreta. Revisar truncamientos de nombres/nutrientes: un valor esencial no debe existir solo en texto cortado; dar acceso al texto completo en el detalle. Comprobar tamaños táctiles, foco, contraste y reducción de movimiento.

No asumir que toda expansión inline es un defecto. Corregir las que alejan el resultado de la interacción o rompen el contrato entre pantallas equivalentes.

### Fase 5 — Verificación y cierre

1. Añadir pruebas de flujo con datos simulados en `e2e/`: apertura/cierre de día y receta, restauración de foco y scroll, Escape, backdrop, carga/error/reintento de receta, día largo, confirmación Sumar/Reemplazar, biblioteca explorada, cambio de ancho y giro de pantalla. Probar accesibilidad del nombre del diálogo y que solo el modal superior reciba foco.
2. Mantener las pruebas existentes de Historial y Calendario y ampliar solo los casos afectados por cambios compartidos. Ejecutar `npm test`, `npm run check:frontend`, `npm run build` y la suite e2e relevante.
3. Hacer una pasada visual a 320, 390, 430, 768, 900, 901, 1024 y 1280 px en Chromium y WebKit. Para iPhone/Android reales, registrar modelo, navegador y resultado por separado de la emulación. Verificar teclado abierto, safe area, scroll de fondo bloqueado, orientación horizontal y nombres largos.
4. Cerrar con una tabla por pantalla: defecto inicial, cambio aplicado, captura posterior y resultado. No dar por resuelta la UX móvil solo porque no haya overflow horizontal.

## Definición de terminado

- Día guardado y receta se abren como diálogo en el contexto móvil y tablet compacta; ninguno aparece al final de la página ni debajo de una tarjeta.
- La selección, la carga, el error, el cierre y el retorno al lugar de origen son consistentes en ambas bibliotecas.
- Historial, Calendario y las demás secciones cumplen el mismo contrato para acciones equivalentes, sin perder funciones.
- Ninguna acción principal queda fuera del viewport por la barra inferior, footer modal, safe area o teclado. Todo detalle largo se puede leer y cerrar.
- Las pruebas funcionales y la revisión visual documentan la matriz de tamaños; se separan resultados emulados de los observados en dispositivos reales.

## Límites de esta revisión

Las causas P0 están verificadas por estructura JSX y reglas responsive. Los puntos transversales de fases 0 y 4 requieren observación visual fresca de una sesión autenticada; las imágenes históricas del repositorio no representan necesariamente la versión actual. Este plan no requiere cambios de backend ni de datos para resolver el patrón de detalle descrito.
