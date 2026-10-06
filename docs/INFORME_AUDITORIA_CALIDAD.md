# Informe de auditoría de calidad

**Alcance:** frontend React/Vite y backend Java/Spring Boot de ScaleGrams.  
**Uso:** guía para cambios graduales; conservar contratos públicos y evidencia útil.  
**Fecha de revisión:** 2026-10-06.

## Hallazgos y seguimiento

| ID | Hallazgo | Ámbito | Seguimiento |
| --- | --- | --- | --- |
| A1 | `NutritionService` y `TrainingService` concentran responsabilidades de varios dominios, demasiadas dependencias y helpers privados. Hay servicios fachada que aún delegan la implementación completa. | Backend | En curso: cardio y catálogo de entrenamiento, catálogo y resumen nutricional, consultas de recetas y presets separados (`eec03ee`, `7501119`, `9617358`, `e69db2b`). La fachada pura `TrainingPlanService` se eliminó. En relación con la auditoría, `NutritionService` pasó de 2321 a 1601 líneas y `TrainingService` de 1948 a 1481. Quedan extracciones pendientes; ver el plan debajo. |
| A2 | Hay dos DTO `PageResponse` con el mismo contrato JSON y lógica repetida para normalizar página/tamaño. Los endpoints repiten el tamaño predeterminado. | Backend | Resuelto en `kcalBackend` (`a58e008`): contrato común y límites configurables, conservando el JSON. |
| A3 | Las rutas, etiquetas de navegación y títulos se mantienen en estructuras separadas. | Frontend | Resuelto: una tabla de metadatos genera rutas, títulos y navegación lateral/móvil. `check:frontend` y `build` pasan. |
| A4 | Hay valores ambientales fijos en código: proxy local de Vite, zona horaria y timeouts HTTP de Auth/Gemini. | Frontend y backend | Resuelto: proxy y parámetros de backend externalizados conservando sus valores predeterminados; nombres documentados en ambos README. |
| A5 | Parte de la documentación describe una arquitectura anterior o enlaza a `PROJECT_STATUS.md`, que no existe. | Frontend y backend | Corregido en el commit de documentación asociado. |
| A6 | `assets/vitality-api.js` sólo lo cargan prototipos HTML históricos; no forma parte de la aplicación React. | Frontend | Resuelto: prototipos, adaptador y diseños agrupados bajo `reference/prototypes/vitality-peak/`; enlaces actualizados y contenido preservado. |
| A7 | Hay capturas de Playwright y un proyecto de video promocional versionados. Son artefactos grandes, pero pueden tener valor de evidencia o entrega. | Frontend | Resuelto: nueve capturas y el proyecto promocional completo están en `reference/evidence/` y `reference/marketing/`; las nuevas salidas de Playwright quedan ignoradas. |
| A8 | `recipeIngredientWeight` se llamaba recursivamente a sí mismo sin caso base al resolver el peso de ingredientes. | Backend | Corregido y publicado en `1247202`. |

## Orden de trabajo

1. Corregir documentación obsoleta y dejar este informe versionado.
2. Compartir DTO y normalización de paginación sin cambiar el JSON de la API.
3. Consolidar metadatos de navegación y títulos sin cambiar rutas ni presentación.
4. Externalizar proxy, zona horaria y timeouts manteniendo los valores actuales como predeterminados.
5. Extraer responsabilidades de los servicios grandes por dominio, preservando límites transaccionales y contratos.
6. Mantener los prototipos y artefactos de evidencia identificados hasta decidir una ubicación de archivo adecuada.

## Seguimiento de A1

La primera etapa mantiene los contratos HTTP y movió estas responsabilidades a servicios propios:

- `TrainingCardioService`: registros, mantenimiento, resúmenes y métricas semanales de cardio (`kcalBackend` `eec03ee`).
- `TrainingCatalogService`: módulos, categorías, ejercicios y sus reglas de registro (`kcalBackend` `9617358`).
- `FoodCatalogService` y `FoodYieldPolicy`: altas, edición, enriquecimiento y reglas de preparación del catálogo (`kcalBackend` `e69db2b`).
- `FoodCatalogSearchService` y `FoodNutrientMapper`: búsqueda del catálogo y conversión de nutrientes.
- `RecipeService`: consultas y paginación de recetas; los flujos de escritura todavía delegan operaciones compartidas a `NutritionService`.
- La fachada pura `TrainingPlanService` se eliminó; las rutas llaman a `TrainingService`, donde sigue la implementación de planes.
- `DayPresetService` y `DayPresetCodec`: operaciones y serialización de presets; aplicar un preset todavía coordina registros de comidas desde `NutritionService`.
- `NutritionOverviewService`: dashboard, tipos de comida e historial.

El hallazgo A1 sigue abierto: ambos servicios principales conservan flujos grandes y responsabilidades pendientes. Próximas extracciones recomendadas: implementación de planes y ciclo de vida de sesiones; escrituras de recetas y registros de comidas; flujos de confirmación de IA. `RecipeService` ya ejecuta sus consultas, aunque todavía delega escrituras. Hacer cada movimiento por dominio y conservar límites transaccionales y contratos.

La validación de compilación de esta etapa fue `kcalBackend`: `mvnw -DskipTests compile` completó correctamente. No se ejecutó la suite de pruebas.

## Criterios

- No borrar prototipos ni evidencia de producto sin verificar antes su uso y conservar su contenido.
- Mantener rutas, payloads y comportamiento visibles sin cambios salvo que un hallazgo requiera lo contrario.
- Registrar cada punto resuelto en un cambio independiente y enlazarlo al historial de Git.
- La auditoría inicial no ejecutó la suite completa; los cambios deben validarse durante su implementación.
