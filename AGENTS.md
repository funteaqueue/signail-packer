# Repository Guidelines

## Project Structure & Module Organization
The application bootstraps from `src/index.tsx` into the single-page shell defined in `src/App.tsx`. Reusable UI flows live in `src/components`, with each step of the quiz creator isolated in its own `*.tsx` file. Shared domain contracts stay in `src/types/quiz.ts`, while persistence helpers (IndexedDB setup, save/load helpers) reside in `src/services/storage.ts`. Static assets and the HTML host document remain under `public`. Configuration files—`tsconfig.json`, `package.json`, and the sample `quiz1.json` export—sit in the repository root; keep generated JSON artifacts out of `src/` and commit only curated samples.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm run dev` (alias of `npm start`) for local development with fast refresh. Produce an optimized bundle via `npm run build`. Run the Jest test watcher with `npm test`; when automating, prefer `npm test -- --watchAll=false`. Coverage reports are available through `npm test -- --coverage`. Always re-run `npm run build` before publishing UI-affecting changes to ensure CRA can tree-shake and emit static assets cleanly.

## Coding Style & Naming Conventions
Write TypeScript-first React using functional components and hooks. Follow the existing two-space indentation and trailing comma style. Name component files in PascalCase (e.g., `ReviewForm.tsx`), exported component identifiers the same, and keep helpers, hooks, and variables in camelCase. Centralize shared types in `src/types` rather than duplicating literals. Favor small, focused components and colocate scoped styles in sibling `.css` files. Run the CRA-bundled ESLint rules with `npx eslint src --max-warnings=0` before opening a pull request; fix formatting issues using your editor's TypeScript/Prettier integration.

## Testing Guidelines
Jest with React Testing Library ships with `react-scripts`; store tests alongside implementation files as `*.test.tsx` or aggregate suites in `src/__tests__`. Cover the IndexedDB service by mocking `window.indexedDB`, and exercise the multi-step form by asserting Stepper transitions and JSON export behavior. Aim to expand coverage around persistence regressions and validation rules, and keep tests deterministic by clearing IndexedDB mocks between cases.

## Commit & Pull Request Guidelines
Use concise, imperative commit subjects; Conventional Commits (`feat:`, `fix:`, `chore:`) help changelog automation even though the current history is minimal. Each commit should build and pass tests independently. Pull requests must include: a summary of the UX or data impact, reproduction or validation steps (`npm run dev`, `npm test -- --watchAll=false`), links to tracked issues, and screenshots or JSON examples whenever UI or export formats change. Request review early if storage version bumps (`services/storage.ts`) are involved so testers can clear their local IndexedDB.

## Data & Storage Notes
IndexedDB versioning lives in `src/services/storage.ts` (`DB_VERSION`). Increment the version when store schemas change and document migrations in the PR. Provide a migration helper or cleanup script such as calling `clearStorage()` so QA can reset state. Validate quiz imports against `quiz1.json` before merging to prevent regressions in author/name/round structure.
