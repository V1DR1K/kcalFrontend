# Implementación de auditoría UX/UI

Fuente: auditoría del 2026-10-01; 46 hallazgos y SG047 reportado por el usuario.

| Commit | Hallazgos | Cambio | Verificación |
|---|---|---|---|
| 01 | SG001 | Botones nativos de cámara/galería; acciones dentro del área visible, también al buscar. CI en fix/**. | Pruebas de diálogo móvil: controles >=44 px y footer <=430 px; teclado y navegación accesible. |
| 02 | SG047 | Rectángulo visible único; footer en fila propia durante el teclado; textarea acotado y desplazamiento sólo del diálogo superior. | SG047 falló antes de corregir y pasó en Chromium/WebKit iPhone; 5 regresiones Chromium aprobadas. No se probó dispositivo físico. |
| 05 | SG042 | Guardados en cola, identidad del servidor sin borrar escritura nueva; borradores por usuario/sesión, recuperación explícita de conflictos y cierre/finalización ordenados. | 14 pruebas de utilidades y compilación aprobadas; regresiones HTTP y concurrencia E2E en verificación de release. |
| 07 | SG041 | Formulario y payload normalizan músculos de arrays/cadenas/nulos. | 12 pruebas de utilidades aprobadas. |
