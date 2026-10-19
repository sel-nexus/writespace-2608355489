# WriteSpace

A browser-local blogging demo built with React 18, JavaScript JSX, Vite 5, React Router 6 and Tailwind 3. No backend, API, server database, external identity provider or synchronization.

## Features
- Public landing with latest-three previews and guest login redirects.
- Local registration/login, persistent sessions, responsive role navigation and logout.
- Newest-first feed, plain-text reader, writing/editing, ownership checks and confirmed deletion.
- Administrator overview, newest-five content controls, account creation in either role and protected account deletion.
- Graceful corrupted-storage reads and explicit failed-save messages.

The fourth dashboard statistic intentionally repeats the registered-user count; the original requirement was unresolved and this choice is labelled in the UI.

## Demo safety
**Use only non-sensitive demo data and dummy passwords.** Passwords are plaintext in localStorage. Built-in `admin` / `admin` is intentionally public. Client-side guards are application behavior, not security enforcement. Browser data can be inspected or changed, clearing storage loses data, and records do not synchronize across browsers/devices. Modern secure-context browsers supporting `crypto.randomUUID()` are required.

Keys: `writespace_posts`, `writespace_users`, `writespace_session`. Session records never contain passwords. Post edits preserve original author and timestamp. Account deletion does not erase historical posts.

## Run
Use Node 20 and npm. From `frontend/`:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Optional `.env` can be copied from `.env.example`; do not commit it. DEV_HOST/DEV_PORT default to 127.0.0.1/5173; PREVIEW_HOST/PREVIEW_PORT default to 127.0.0.1/4173. TEST_BASE_URL defaults to preview origin. These configure tooling only; static assets contain no runtime secrets or API URLs.

## Browser tests
From `frontend/`, after building:

```sh
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test
```

Playwright starts Vite preview, one worker, desktop and mobile projects. Specs cover discovery, identity, role guards, post lifecycle and administration with real localStorage, confirmation paths and console-error assertions. Browser captures attach screenshots, accessibility trees, rendered HTML and computed styles. Vitest uses jsdom and Testing Library; it collects only src test files. The pipeline test report records actual verified results; API/database integration layers are not applicable.

## Deployment
Vercel: set **Root Directory to frontend**, use Vite preset, build `npm run build`, output `dist`. `frontend/vercel.json` contains only the SPA rewrite. Actual hosted Vercel deployment is not performed by Developer.

Docker: from repository root, `docker build -t writespace frontend`, then `docker run --rm -p 8080:80 writespace`. nginx serves `/` on port 80 with SPA fallback, no backend proxy. Host port is an operator choice. Source Docker configuration is supplied; container execution is reported separately when verified.

## Dependency limitations
Compatible patches update Router to 6.30.6, Vite to 5.4.21 and PostCSS to 8.5.31. The required Vite5/Tailwind3 stack and retained Vitest2/Playwright1.49 tooling have npm audit advisories. Never expose dev/test servers to untrusted networks or enable Vitest UI. These tools do not run in the static nginx production image. Further major-version/tooling remediation should be reviewed before using this outside its non-sensitive demo scope.

## Visual decisions
Publication-style slate/white surfaces, Georgia display headings and indigo actions; explicit crown/book role avatars. Higher-priority UI rules replaced the requested whole-page purple/pink gradient and transition-all with restrained surfaces and explicit transitions. Tailwind config and directive-only CSS preserve the specified styling constraints.
