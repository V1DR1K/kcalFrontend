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

## Desde Visual Studio Code

1. Abrir la carpeta del repositorio.
2. Ejecutar la tarea `npm: dev` desde `Terminal > Run Task`.
3. Usar `Run and Debug > Vite: abrir en navegador` para abrir la app.

## Nota

Las pantallas siguen usando Tailwind, Google Fonts y Material Symbols desde CDN, por lo que necesitan conexion a internet para verse iguales al export original.
