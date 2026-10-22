# Automated Testing Status

## Runnable now

Run the frontend tests from the project root:

```powershell
npm.cmd test
```

Run the Worker tests:

```powershell
cd cloudflare-worker
npm.cmd test
```

The current suites cover:

- Score and essay-point calculations.
- Time-limit parsing.
- Admin and super-admin guards.
- Missing-token behavior.
- Worker health endpoint.
- Production and local CORS behavior.
- Protection against unconfigured origins.
- `/listAdmins` and `/api/listAdmins` route normalization.
- Firestore REST timestamp serialization and composite expiry-query structure.
- Firestore timestamp deadline comparisons and exact deadline expiry behavior.
- Firestore Rules Emulator coverage is defined in `test/rules.test.js` and runs with `npm.cmd run test:rules`.
- Local Playwright smoke coverage is defined in `e2e/auth-shell.spec.js` and runs with `npm.cmd run test:e2e`.

## Still requires an external test environment

These tests can now be added with the installed tools:

- Real Firestore integration tests.
- Browser end-to-end tests with Playwright.
- Cloudflare scheduled-trigger tests.
- Vercel deployment smoke tests.

Installed tooling:

- Firebase CLI `15.34.1`.
- `@firebase/rules-unit-testing` `5.0.2`.
- Playwright `1.64.1` with Chromium installed.

The Rules Emulator suite requires Java on `PATH`; it cannot run in the current shell until a JDK/JRE is available. The current browser suite covers the unauthenticated application shell only; authenticated flows still require safe test credentials/data and should not run against production data.

Do not run destructive integration tests against production Firebase data. Use a dedicated Firebase test project or the Emulator Suite.
