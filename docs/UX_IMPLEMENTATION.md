# ImplementaciÃƒÂ³n de auditorÃƒÂ­a UX/UI

Fuente: auditorÃƒÂ­a del 2026-10-01; 46 hallazgos y SG047 reportado por el usuario.

| Commit | Hallazgos | Cambio | VerificaciÃƒÂ³n |
|---|---|---|---|
| 01 | SG001 | Botones nativos de cÃƒÂ¡mara/galerÃƒÂ­a; acciones dentro del ÃƒÂ¡rea visible, tambiÃƒÂ©n al buscar. CI en fix/**. | Pruebas de diÃƒÂ¡logo mÃƒÂ³vil: controles >=44 px y footer <=430 px; teclado y navegaciÃƒÂ³n accesible. |
| 02 | SG047 | RectÃ¡ngulo visible Ãºnico; footer en fila propia durante el teclado; textarea acotado y desplazamiento sÃ³lo del diÃ¡logo superior. | SG047 fallÃ³ antes de corregir y pasÃ³ en Chromium/WebKit iPhone; 5 regresiones Chromium aprobadas. No se probÃ³ dispositivo fÃ­sico. |
| 05 | SG042 | Guardados en cola, identidad del servidor sin borrar escritura nueva; borradores por usuario/sesión, recuperación explícita de conflictos y cierre/finalización ordenados. | 14 pruebas de utilidades y compilación aprobadas; regresiones HTTP y concurrencia E2E en verificación de release. |
