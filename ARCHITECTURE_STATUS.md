# Frontend architecture status

See `../PROJECT_STATUS.md` for the complete operational report.

The catalog uses server pagination and progressive loading. Its hook and pure paging rules live under `src/features/catalog`; shared browser/API concerns live under `src/services`; reusable view primitives live under `src/components`; configuration and pure helpers live under `src/config` and `src/utils`.

Completed on 2026-07-05:

- Extracted catalog pagination and infinite-scroll observer from `main.jsx`.
- Added page-query and deduplication unit tests.
- Added `npm test` to CI before the production build.
- Verified frontend production build and the complete backend integration suite.
- Added a Playwright authentication smoke test and Chromium execution to CI.

Remaining screens in `main.jsx` are intentionally treated as legacy migration scope. New functionality must be created under `src/features/<domain>`; existing screens should move when behavior changes, avoiding a risky all-at-once rewrite.

Verification: `npm test && npm run build`.
