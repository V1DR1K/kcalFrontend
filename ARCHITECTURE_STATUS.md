# Frontend architecture status

See `../PROJECT_STATUS.md` for the complete operational report.

The catalog uses server pagination and progressive loading. Its hook and pure paging rules live under `src/features/catalog`; shared browser/API concerns live under `src/services`; reusable view primitives live under `src/components`; configuration and pure helpers live under `src/config` and `src/utils`.

Completed on 2026-07-05:

- Extracted catalog pagination and infinite-scroll observer from `main.jsx`.
- Added page-query and deduplication unit tests.
- Added `npm test` to CI before the production build.
- Verified frontend production build and the complete backend integration suite.
- Added a Playwright authentication smoke test and Chromium execution to CI.

The entrypoint is now limited to mounting React. Application composition lives under `src/app`, while configuration, formatting, browser persistence, HTTP, catalog pagination and reusable UI infrastructure are separate modules. New functionality must be created under `src/features/<domain>`.

Verification: `npm test && npm run build`.
