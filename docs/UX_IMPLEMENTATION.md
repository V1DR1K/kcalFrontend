# Implementación de auditoría UX/UI

Fuente: auditoría del 2026-10-01; 46 hallazgos y SG047 reportado por el usuario.

| Commit | Hallazgos | Cambio | Verificación |
|---|---|---|---|
| 01 | SG001 | Botones nativos de cámara/galería; acciones dentro del área visible, también al buscar. CI en fix/**. | Pruebas de diálogo móvil: controles >=44 px y footer <=430 px; teclado y navegación accesible. |
| 02 | SG047 | Rectángulo visible único; footer en fila propia durante el teclado; textarea acotado y desplazamiento sólo del diálogo superior. | SG047 falló antes de corregir y pasó en Chromium/WebKit iPhone; 5 regresiones Chromium aprobadas. No se probó dispositivo físico. |
| 05 | SG042 | Guardados en cola, identidad del servidor sin borrar escritura nueva; borradores por usuario/sesión, recuperación explícita de conflictos y cierre/finalización ordenados. | 14 pruebas de utilidades y compilación aprobadas; regresiones HTTP y concurrencia E2E en verificación de release. |
| 07 | SG041 | Formulario y payload normalizan músculos de arrays/cadenas/nulos. | 12 pruebas de utilidades aprobadas. |
| 08 | SG027, SG043–045 | Copia con diálogo, activación confirmada, Listo vuelve al borrador y sesiones libres en curso reutilizadas. IDs/objetivos de planes conservados. | 13 utilidades y 13 recorridos de entrenamiento Chromium aprobados. |
| 10 | SG003–004, SG039 | Alternativas separadas de programación; comparación antes/después y recuperación explícita de vista previa. Porcentajes independientes y entrada directa; editor móvil sin superposición. | Compilación y 3 recorridos Chromium aprobados, incluido 320 px y guardado→vista previa→confirmación. |
| 12 | SG040 | Perfil usa la respuesta completa; peso consulta perfil vigente. Meta/origen visibles y eventos actualizan dashboard e historial respetando fecha. | Compilación y 3 recorridos de perfil Chromium aprobados; respuesta con meta modificada verificada. |
| 16 | SG005, SG007, SG011–014 | Cantidades negativas/invalidas visibles y rechazadas; coma decimal, referencias y preparación claras; desconocidos y subtotales parciales; filtros y variantes diferenciadas; aviso cancelable antes de registrar. | 4 pruebas de utilidades, comprobación y compilación; 2 recorridos Chromium aprobados, incluidos cancelación sin escritura y aceptación con datos ausentes. |
| 17 | SG037–038 | Alta con confirmación y Crear otro; recientes actualizados; reconocimiento explícito de archivados centralizado para todas las escrituras JSON, con cola de avisos y cancelación segura. | 3 pruebas de reconocimiento y 5 recorridos Chromium: alta, segunda alta, edición, error y reutilización cancelada/aceptada. Compilación aprobada. |
