# Frontend architecture status

See `../PROJECT_STATUS.md` for the complete operational report.

The catalog uses server pagination and progressive loading. Shared browser/API concerns live under `src/services`; configuration and pure helpers live under `src/config` and `src/utils`. New screens must be created under `src/features/<domain>` instead of adding more responsibilities to `src/main.jsx`.

Verification: `npm run build`.
