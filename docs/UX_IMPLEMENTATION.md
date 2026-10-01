# ImplementaciÃ³n de auditorÃ­a UX/UI

Fuente: auditorÃ­a del 2026-10-01; 46 hallazgos y SG047 reportado por el usuario.

| Commit | Hallazgos | Cambio | VerificaciÃ³n |
|---|---|---|---|
| 01 | SG001 | Botones nativos de cÃ¡mara/galerÃ­a; acciones dentro del Ã¡rea visible, tambiÃ©n al buscar. CI en fix/**. | Pruebas de diÃ¡logo mÃ³vil: controles >=44 px y footer <=430 px; teclado y navegaciÃ³n accesible. |
| 02 | SG047 | Rectángulo visible único; footer en fila propia durante el teclado; textarea acotado y desplazamiento sólo del diálogo superior. | SG047 falló antes de corregir y pasó en Chromium/WebKit iPhone; 5 regresiones Chromium aprobadas. No se probó dispositivo físico. |
