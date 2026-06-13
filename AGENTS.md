# Repository Guidelines

## Project Structure & Module Organization
The application bootstraps from `src/index.tsx` into the single-page shell defined in `src/App.tsx`. Reusable UI flows live in `src/components`, with each step of the quiz creator isolated in its own `*.tsx` file. Shared domain contracts stay in `src/types/quiz.ts`, while persistence helpers (IndexedDB setup, save/load helpers) reside in `src/services/storage.ts`. Static assets and the HTML host document remain under `public`. Configuration files—`tsconfig.json`, `package.json`, and the sample `quiz1.json` export—sit in the repository root; keep generated JSON artifacts out of `src/` and commit only curated samples.

## Build, Test, and Development Commands
Run all Node.js, npm, CRA, Jest, TypeScript, and ESLint commands inside Docker. Never use Windows Node.js or a WSL-native Node.js/npm installation for this repository. Use the Compose service named `app`: install or refresh dependencies with `docker compose build app`, and start local development with `docker compose up --build app`. Run one-off commands with `docker compose run --rm app <command>`, for example `docker compose run --rm app npm run build`, `docker compose run --rm app npm test -- --watchAll=false`, and `docker compose run --rm app npm test -- --coverage`. Always re-run the Dockerized build before publishing UI-affecting changes to ensure CRA can tree-shake and emit static assets cleanly.

## Coding Style & Naming Conventions
Write TypeScript-first React using functional components and hooks. Follow the existing two-space indentation and trailing comma style. Name component files in PascalCase (e.g., `ReviewForm.tsx`), exported component identifiers the same, and keep helpers, hooks, and variables in camelCase. Centralize shared types in `src/types` rather than duplicating literals. Favor small, focused components and colocate scoped styles in sibling `.css` files. Run the CRA-bundled ESLint rules with `docker compose run --rm app npx eslint src --max-warnings=0` before opening a pull request; fix formatting issues using your editor's TypeScript/Prettier integration.

## Testing Guidelines
Jest with React Testing Library ships with `react-scripts`; store tests alongside implementation files as `*.test.tsx` or aggregate suites in `src/__tests__`. Cover the IndexedDB service by mocking `window.indexedDB`, and exercise the multi-step form by asserting Stepper transitions and JSON export behavior. Aim to expand coverage around persistence regressions and validation rules, and keep tests deterministic by clearing IndexedDB mocks between cases.

## Commit & Pull Request Guidelines
Use concise, imperative commit subjects; Conventional Commits (`feat:`, `fix:`, `chore:`) help changelog automation even though the current history is minimal. Each commit should build and pass tests independently. Pull requests must include: a summary of the UX or data impact, Docker-based reproduction or validation steps (`docker compose up --build app`, `docker compose run --rm app npm test -- --watchAll=false`), links to tracked issues, and screenshots or JSON examples whenever UI or export formats change. Request review early if storage version bumps (`services/storage.ts`) are involved so testers can clear their local IndexedDB.

## Data & Storage Notes
IndexedDB versioning lives in `src/services/storage.ts` (`DB_VERSION`). Increment the version when store schemas change and document migrations in the PR. Provide a migration helper or cleanup script such as calling `clearStorage()` so QA can reset state. Validate quiz imports against `quiz1.json` before merging to prevent regressions in author/name/round structure.
