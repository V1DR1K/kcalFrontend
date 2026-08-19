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

## Feature modularization

Feature UI and domain-specific dialogs live below `src/features/<domain>`. Shared modal lifecycle belongs to `src/components/dialog` and provides portal mounting, scroll locking, focus restoration, keyboard trapping, backdrop handling and unique ARIA identifiers.

Current feature boundaries:

- `dashboard`: page coordinator, `useDashboardData`, meal sections, quick/recent meals and picker/AI dialogs.
- `catalog`: catalog shell, independent forms, OCR preview, personal-food panel and catalog utilities.
- `foods`: recipe swipe card, meal-log forms and food/recipe dialogs.
- `profile`: page coordinator plus weight, password, nutrition-plan and tutorial components.
- `history` and `recipes`: page coordinators with feature-local dialogs.

Rules for new code:

- Screens coordinate data and feature state; visual sections and dialogs remain in feature modules.
- Pure transformations belong in `utils`; API and effects belong in hooks or feature services.
- Shared UI primitives belong in `src/components`; features must not import another feature's private implementation when a public entrypoint exists.
- Dialogs use the common lifecycle and must expose unique accessible labels.
