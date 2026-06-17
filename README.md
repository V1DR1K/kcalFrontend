# kcalFrontend

Proyecto armado a partir de pantallas HTML exportadas desde Google Stitch para **Vitality Peak**.

## Estructura actual

- `index.html`: indice local para navegar las pantallas.
- `*/code.html`: prototipos HTML originales exportados desde Stitch.
- `*/screen.png`: capturas de referencia de cada pantalla.
- `vitality_peak*/DESIGN.md`: guias visuales exportadas.

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
http://127.0.0.1:5173/
```

## Backend

La integracion espera el backend en:

```text
http://localhost:8081
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

## Desde Visual Studio Code

1. Abrir la carpeta del repositorio.
2. Ejecutar la tarea `npm: dev` desde `Terminal > Run Task`.
3. Usar `Run and Debug > Vite: abrir en navegador` para abrir la app.

## Nota

Las pantallas siguen usando Tailwind, Google Fonts y Material Symbols desde CDN, por lo que necesitan conexion a internet para verse iguales al export original.
