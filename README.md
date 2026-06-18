# kcalFrontend

Frontend React de **Vitality Peak** construido con Vite.

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
Email: alex@vitality.com
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

Si el backend corre en otro host, se puede configurar antes de cargar las pantallas:

```html
<script>
  window.VITALITY_API_BASE_URL = "http://localhost:8081";
</script>
```

El backend debe permitir CORS desde Vite, por ejemplo `http://127.0.0.1:5173`.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Desde Visual Studio Code

1. Abrir la carpeta del repositorio.
2. Ejecutar la tarea `npm: dev` desde `Terminal > Run Task`.
3. Abrir `http://localhost:5173/`.
