# Hyperframes Composition Brief: ScaleGrams

## Objective
Crear un video breve de lanzamiento para ScaleGrams que muestre cómo el registro diario pone comidas, macros, entrenamiento y cardio en contexto.

## Output
- Composition directory: `composition/`
- Rendered video: `brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:/Users/Tomas/Desktop/Proyectos/KCALS/kcalFrontend`
- Primary files read: `index.html`, `PRODUCT.md`, `src/features/landing/Landing.jsx`, `src/features/dashboard/Dashboard.jsx`, `src/features/dashboard/dialogs/FoodPickerDialog.jsx`, `src/features/history/History.jsx`, `src/styles/01-foundation.css`, `src/styles/03-dashboard-catalog.css`, `src/styles/12-dashboard-summary.css`, `README.md`, `package.json`
- Product name: ScaleGrams
- Tagline / strongest claim: “Tu plan, en contexto.”; conecta comidas, entrenamiento y cardio para que cada día tenga una referencia clara.
- Key UI or visual moment to recreate: anillo calórico y resumen de comidas del dashboard; selector para añadir un alimento; regreso del alimento al registro y actualización del resumen.
- Copy that must appear verbatim:
  - Tu plan, en contexto.
  - Registrá. Revisá. Seguí.
  - Almuerzo
  - Pollo grillado · 150 g

## Creative Direction
- Tone preset: polished
- Creative direction: bitácora diaria serena, con claridad de producto y energía cálida
- Interpretation: pocas escenas con aire, interfaces legibles y movimiento preciso; la música sostiene el ritmo sin convertir el registro nutricional en una competencia.
- Angle: un día no es una lista de calorías aislada. ScaleGrams deja registrar una comida y verla junto al resto del día, entrenamiento y cardio.
- Hook: el dashboard oscuro revela el anillo calórico y “Tu plan, en contexto.” en los primeros segundos.
- Outro / punchline: wordmark ScaleGrams; “Registrá. Revisá. Seguí.”; “Tu plan, en contexto.”
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Medical claims, guaranteed outcomes, or implying photo estimation is universally enabled
  - Real user or account data; all meal values, dates, and totals are fictional demonstration content

## Visual Identity
- Background: #0e1511
- Text: #e1e3df; muted support #bbcabf
- Accent: #4edea3; secondary #89ceff
- Display font: Hanken Grotesk (local source font)
- Body font: DM Sans (local source font)
- Visual references from the project: daily calorie ring, meal list, food picker, compact nutrition summary, dark forest surfaces, mint accent.

## Storyboard
Use `brag-plan.md` as the creative contract.

Scene summary:
1. El día a la vista — 4s — dashboard, partial calorie ring and exact headline.
2. Registrar una comida — 4.7s — tap into Almuerzo, select Pollo grillado, 150 g.
3. Todo queda en contexto — 6.3s — food log joins dashboard, totals update, training/cardio labels appear.
4. ScaleGrams — 5s — product name and the closing copy.

## Audio
- Audio role: warm, professional support
- Audio arc: restrained instrumental bed, a small interaction accent, reveal accent, soft fade under the last line.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (copied into `composition/assets/music/`)
- Music treatment: low opening level, modest lift at the integrated daily summary, gradual fade at the end.
- Music cue guidance: local bundled preset at 109.96 BPM; optional strong cues at 8.74s and 17.47s; preserve readable holds.
- Audio-reactive treatment: unavailable in this environment because FFmpeg is missing for per-frame audio extraction; the mint halo uses restrained fixed-timeline motion.
- Audio-coupled moments: simulated tap, food selection, daily summary reveal, final wordmark.
- SFX selection guidance: polished restraint; use soft interface clicks or a quiet drop only where they match a visible action.
- SFX analysis guidance: `C:/Users/Tomas/.codex/skills/brag/assets/sfx/sfx-analysis.md`.
- Exact SFX choice: choose to fit the implemented animation; avoid reward/weight/judgment cues.
- Audio files: use composition-local paths under `assets/`.

## Hyperframes Instructions
Follow the current Hyperframes core, animation, creative, keyframes, and CLI guidance. Brag owns the product angle, source material, storyboard, brand, and delivery. Hyperframes owns composition structure and implementation. Keep the typography and product UI legible, show the real ScaleGrams visual language, keep total duration within 20 seconds, and use local assets. Run `npx hyperframes check` before rendering.
