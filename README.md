# WriteSpace — discovery slice

A static React 18 / JavaScript / Vite application. This implementation includes public discovery and the shared scaffolding in `PLAN.md` only. No backend, API, database, external authentication, or seed posts are included.

## Current scope

- `/` renders the public navbar, editorial hero, a real newest-post BlogCard mini preview (or an honest blank state), three asymmetric features, newest three local posts, and footer.
- Links retain their planned destinations: `/login`, `/register`, `/blogs`, `/blog/:id`, and ownership-aware `/edit/:id` links on BlogCard when supplied a session.
- Only `/` is wired. Other destinations show an inline **Page not found** state with a working home link. Login, registration, protected routes, avatars, writing, and administration belong to later slices. Guest reader/login redirection and authenticated CTAs are not implemented here.
- The landing surface is slate/white with indigo controls, Georgia display type, sans body text, and reduced-motion-safe CSS-only preview animation. Tailwind uses its standard palette with empty `theme.extend`; CSS contains only the three directives.

## Install and run

Use Node.js 20 and npm. Run commands from `frontend/`:

```sh
npm install
npm run dev
```

Optional: copy `.env.example` to `.env` locally (do not commit it). Defaults work without copying. `DEV_HOST` / `DEV_PORT` default to `127.0.0.1` / `5173`; `PREVIEW_HOST` / `PREVIEW_PORT` default to `127.0.0.1` / `4173`. `TEST_BASE_URL` defaults to the preview origin; keep the example URL aligned if overriding preview ports. Shell environment values override file values. For a remotely accessed dev server, set the bind host appropriately. No client secrets or backend URL are needed.

## Verification

```sh
node node_modules/vitest/vitest.mjs run src/utils/storage.test.js src/pages/LandingPage.test.jsx src/components/BlogCard.test.jsx
npm run build
npm run preview
```

Vitest collects only `src/**/*.test.{js,jsx}` and excludes E2E. Setup cleans the DOM, clears browser storage, and restores mocks after each test. Tests cover malformed list/record types, missing/blank fields, timestamps/roles, read exceptions, successful replacement writes, failed writes without a memory fallback, excerpts, date and accent order, ownership links, safe text rendering, populated/empty landing, CTAs, navigation, and accessible shared fields.

`e2e/discovery.spec.js` is authored for parent verification, **not executed by this slice**. After a build, the parent can install Chromium and run:

```sh
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test
```

The JS config uses one worker, desktop/mobile projects, and a Vite-preview webServer with environment-controlled host/port. Journeys use one initial visit followed by clicks, inspect real localStorage, and capture/assert console and page errors. The assertions use exact current discovery reader/All Blogs destinations; the parent should update these to the exact final login redirect after route guards are wired, and complete cross-feature authentication coverage. Source review and browser preflight (screenshots, accessibility snapshots, rendered HTML, computed styles) are planned for the parent after feature slices; no preflight artifacts are generated here.

## Local persistence and demo safety

`storage.js` exports `getPosts`, `savePosts`, `getUsers`, and `saveUsers`. It uses only `writespace_posts` and `writespace_users`. Each read is protected, validates the entire array against required record strings/timestamps and internal `admin`/`user` roles, and returns `[]` for missing, corrupt, or unavailable storage without overwriting it. Writes validate before saving and throw friendly errors for invalid records, serialization errors, quota limits, or unavailable storage. There is no in-memory fallback or false save success.

This is **non-sensitive demo software**, not secure publishing or authentication. Browser-local data is neither encrypted nor synced. The planned identity slices store plaintext passwords and use the intentionally public built-in `admin` / `admin` credential. Never use real passwords, confidential posts, or sensitive personal data. Client-side roles and guards can be bypassed and do not provide server-enforced security. Clearing browser data loses all local records. Modern secure-context browsers supporting `crypto.randomUUID()` are required for later creation flows.

## Static deployment

### Vercel

Set the Vercel project **Root Directory to `frontend`** and select the Vite preset. Build command: `npm run build`; output directory: `dist`. `frontend/vercel.json` contains only the required `/(.*)` → `/index.html` SPA rewrite. Do not configure the repository root as the project root. Rewrite behavior still requires deployment verification by the parent.

### Docker / nginx

From workspace root:

```sh
docker build -t writespace-discovery frontend
docker run --rm -p 8080:80 writespace-discovery
```

Change the host port as needed. The two-stage image builds static assets using `npm ci`, then serves `dist` with nginx on container port 80. nginx provides SPA history fallback and no backend proxy. Environment variables configure local Vite/test tooling only; there is no runtime server-side application configuration. Container execution is left to parent verification.
