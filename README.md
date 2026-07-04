# kcalFrontend

Frontend React de **KazaFitness**, producto de **KazaDesarrollos**, construido con Vite.

## Estructura

- `src/main.jsx`: aplicacion React, vistas y cliente HTTP.
- `src/styles.css`: estilos base de la app.
- `index.html`: punto de montaje de Vite.
- `*/code.html` y `*/screen.png`: prototipos originales de Google Stitch conservados como referencia.
- `.env.example`: ejemplo de configuracion para la URL del backend.

## Requisitos

- Node.js 18 o superior.
- Visual Studio Code o Visual Studio con soporte para proyectos Node/npm.

## Como correrlo

Instalar dependencias:

```bash
npm install
```

Levantar el servidor local:

```bash
npm run dev
```

Abrir la URL que muestra Vite, normalmente:

```text
http://localhost:5173/
```

## Como correrlo desde el celular en la misma WiFi

1. Buscar la IP local de tu PC:

```powershell
ipconfig
```

Usar la IPv4 de tu adaptador WiFi, por ejemplo `192.168.0.25`.

2. Levantar el backend escuchando en la red:

```powershell
cd C:\Users\Tomas\Desktop\Proyectos\KCALS\kcalBackend
$env:SERVER_ADDRESS="0.0.0.0"
.\mvnw.cmd spring-boot:run
```

3. Crear o actualizar `.env` en `kcalFrontend`:

```text
VITE_API_BASE_URL=http://TU_IP_LOCAL:8081
```

Ejemplo:

```text
VITE_API_BASE_URL=http://192.168.0.25:8081
```

4. Levantar el frontend para LAN:

```powershell
cd C:\Users\Tomas\Desktop\Proyectos\KCALS\kcalFrontend
npm run dev:lan
```

5. Abrir desde el celular:

```text
http://TU_IP_LOCAL:5173
```

Si no carga, revisar el Firewall de Windows y permitir los puertos `5173` y `8081`.

## Backend

La integracion espera el backend en:

```text
http://localhost:8081
```

Si necesitás cambiarlo, crea un archivo `.env` con:

```text
VITE_API_BASE_URL=http://localhost:8081
```

Credenciales demo:

```text
Email: alex@kazadesarrollos.com
Password: password123
```

Endpoints consumidos:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/nutrition/dashboard?date=YYYY-MM-DD`
- `GET /api/foods`
- `GET /api/foods?q=texto`
- `GET /api/foods?category=PROTEIN`
- `POST /api/foods/preview`
- `POST /api/nutrition/food-logs`
- `GET /api/foods/barcode/{barcode}`
- `GET /api/nutrition/history?year=YYYY&month=M`
- `GET /api/profile`
- `POST /api/nutrition/water-logs`

El backend debe permitir CORS desde Vite, por ejemplo `http://127.0.0.1:5173`.

## Producción

La app usa rutas `/api` del mismo origen por defecto, una configuración segura detrás de un proxy inverso. Si frontend y API se publican en dominios distintos, definir `VITE_API_BASE_URL` al compilar:

```powershell
$env:VITE_API_BASE_URL="https://api.ejemplo.com"
npm ci
npm run build
```

El contenido estático listo para publicar queda en `dist/`. Las credenciales demo sólo se completan automáticamente en modo desarrollo y no forman parte del bundle de producción.

Para HTTPS local opcional se puede definir `VITE_DEV_HTTPS=true`; normalmente conviene usar HTTP local y terminar TLS en la infraestructura de producción.

## Scripts

```bash
npm run dev
npm run dev:lan
npm run build
npm run preview
npm run preview:lan
```

## Desde Visual Studio Code

1. Abrir la carpeta del repositorio.
2. Ejecutar la tarea `npm: dev` desde `Terminal > Run Task`.
3. Abrir `http://localhost:5173/`.
