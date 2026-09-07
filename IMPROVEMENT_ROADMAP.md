# ScaleGrams: roadmap de calidad y continuidad

Fecha: 2026-09-05. Estado: auditoría y preparación de rollback en curso.

## Objetivo y autorización

Mejorar Nutrición, Entrenamiento y Cardio de extremo a extremo: coherencia visual, uso con una mano, responsive, accesibilidad, integridad de datos y rapidez con unos 300 ms de latencia. El usuario autoriza cambios, push a main y despliegue, después de respaldar y etiquetar la versión actual. Mantener la identidad ScaleGrams existente (PRODUCT.md y DESIGN.md); no copiar contenido ni inventar datos nutricionales.

## Repositorios y producción

- Frontend: V1DR1K/kcalFrontend, React 19 + Vite. Base inicial c17f9ee.
- Backend: V1DR1K/kcalBackend, Spring Boot 3.5 / Java 21 / PostgreSQL 17 / Flyway. Base inicial d9a69c7.
- VPS: deploy@207.180.192.171, hostname vmi3416148; clave local ~/.ssh/contabo_deploy_ed25519. Nunca copiar claves ni secretos al repositorio.
- Fuentes de producción: /opt/projects/scalegrams/front/scalegrams-frontend y /opt/projects/scalegrams/back/scalegrams-backend.
- Stack: /opt/infra/stacks/scalegrams.compose.yml; desplegar con /opt/infra/bin/deploy-service scalegrams api y web. Configuración privada en /opt/infra/env: no imprimirla.
- Aplicación: https://scalegrams.neticar.com.ar. No afectar otros servicios del VPS.

## Plan de trabajo

- [x] Conectar por SSH y verificar hostname, salud y bases Git; árboles limpios y mismos commits local/VPS.
- [x] Crear tag previo en ambos repositorios y publicarlo; guardar dump PostgreSQL, código, configuración operativa e imágenes actuales; comprobar restauración en base aislada. Backup: `/opt/backups/scalegrams/20260905-pre-quality`; tag: `20260905-pre-quality`.
- [x] Auditar estructura, peticiones, estados vacíos/error, formularios y lógica de los tres módulos.
- [x] Documentar evidencia concreta y prioridades; conservar lo que funciona.
- [x] Nutrición: rastrear duplicados de catálogo vs registros de comidas; impedir que una estimación ambigua cree automáticamente una identidad nueva. Distinguir preparación, marca, origen y valores nutricionales; conservar snapshots históricos.
- [x] Revisar datos en modo lectura, cuantificar duplicados; limpiar únicamente equivalencias demostrables con operación reversible y reporte. No fusionar alimentos solo por parecido del nombre.
- [x] Frontend: tokens semánticos comunes y acentos por módulo, áreas táctiles, safe areas, teclado móvil, modales, navegación y ausencia de desbordes.
- [x] Entrenamiento: revisar edición/guardado de sesiones, fechas, estados, planes y propiedad de registros; corregir fallos verificables.
- [x] Cardio: revisar historial paginado, validación de distancias/tiempos/fechas y mantenimiento; corregir fallos verificables.
- [x] Rendimiento: evitar cascadas/repetición de solicitudes, conservar contenido durante refrescos y diferir herramientas pesadas. Medir con latencia de 300 ms.
- [x] Ejecutar pruebas backend/frontend y build; verificar migraciones sobre copia PostgreSQL y pantallas a 320, 390, 393, 402, 430, 768 y 1440 px cuando el entorno lo permita.
- [ ] Push a main; desplegar componentes desde fuentes canónicas; verificar salud, versión, navegación y errores posteriores.
- [ ] Actualizar este documento con commits, respaldos, resultados, límites y tareas pendientes para otra IA.

## Criterios de aceptación

Los datos históricos conservan cantidades y nutrientes. Confirmar una estimación no agrega filas innecesarias al catálogo. No hay desborde horizontal ni acciones tapadas en las resoluciones verificadas; formularios utilizables con teclado móvil. Los listados permiten acceder a toda la información paginada. Estados de carga y error explican qué ocurre. Pruebas relevantes pasan y producción queda saludable. Distinguir emulación WebKit de validación física en iPhone 15/17.

## Política de alimentos y registros

Una estimación es un registro provisional del usuario; un alimento del catálogo es una identidad reutilizable. Coincidencia exacta compatible puede reutilizarse; coincidencias aproximadas son sugerencias revisables. Crudo/cocido, con/sin ingredientes y marcas diferentes no se fusionan automáticamente. Incorporar nuevos alimentos solo con procedencia y porción claras; nunca rellenar producción con registros de prueba.

## Rollback

El respaldo y tag previos están verificados en `/opt/backups/scalegrams/20260905-pre-quality` y `20260905-pre-quality`. Para volver, restaurar primero imágenes/código anteriores. Restaurar datos solo si es necesario, con la aplicación detenida y respaldo adicional de las escrituras posteriores; un dump antiguo reemplaza los cambios más recientes. Preferir cambios de esquema aditivos compatibles con la versión previa.

## Registro de esta iteración

- Frontend: navegación móvil condensada con menú Más, paginación de Cardio, formato local de distancia, protección contra envíos duplicados, íconos faltantes, inputs de fecha sin selección automática, cancelación segura de cargas y división lazy de historial/perfil.
- Backend: coincidencia IA determinista solo para una ficha exacta, compatible, sin marca y con preparación/categoría iguales; ambigüedad queda como estimación. El guardado de catálogo es idempotente y usa bloqueo de la estimación propietaria. La edición recalcula snapshots de nutrientes sin duplicarlos.
- Datos auditados en restauración: 430 alimentos totales, 92 activos de origen `AI_ESTIMATE`, 701 registros de comidas. Hubo 6 grupos de duplicados activos por nombre/preparación; los 12 registros afectados son importados con marcas o valores diferentes, más una ficha derivada/IA con procedencias distintas. No se eliminaron ni fusionaron filas.
- Validación local: `npm test` (51), `npm run build`, `npm run check:frontend`, `npm run test:e2e` (26), `mvn test` (64 backend). La matriz adicional tomó 320/390/393/402/430/768/1440 px. La consola local mostró un 502 esperado porque el API no corre en el entorno local.
- Pendiente para el cierre operativo: commit, push a `main`, despliegue desde `/opt/projects` y smoke check contra `https://scalegrams.neticar.com.ar`.
