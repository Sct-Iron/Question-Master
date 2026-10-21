# Question Master Maintenance Guide

## Architecture

The app has four layers:

```text
React/Vite -> Cloudflare Worker -> Firestore
     |              |                |
 Firebase Auth   token checks       Rules
```

The frontend renders the UI and sends Firebase ID tokens. Firebase Authentication identifies users. The Cloudflare Worker is the trusted backend: it verifies tokens, checks claims, scores quizzes, marks essays, approves admins, and accesses Firestore. Firestore Rules protect direct client access.

The frontend must never be trusted for scores, admin approval, custom claims, answer keys, or result release.

## Roles and profiles

Firebase custom claims provide trusted authorization:

```js
{ role: "admin", isSuperAdmin: true }
```

Firestore stores workflow data at `users/{firebaseUid}`:

```js
{ name, email, role: "admin" | "student", status: "pending" | "approved" | "rejected" }
```

Claims authorize privileged operations. Profile fields describe account state. A client may create a pending admin profile, but cannot safely grant itself admin claims.

## Super-admin recovery

Mr. Okolo’s UID is:

```text
85CaNw1FemX0zfoSclyKlMzqOmI3
```

The claim migration script is `functions/scripts/migrate-admin-claims.js`. It requires an explicit UID and an already-approved admin profile.

Use the JSON file path, not its folder:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\full\path\to\service-account.json"
Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS
```

Then run:

```powershell
npm.cmd --prefix functions run migrate-admin-claims -- --uid 85CaNw1FemX0zfoSclyKlMzqOmI3 --super-admin --apply
```

The user must sign out and sign in again because claims are carried in the ID token. `src/context/AuthContext.jsx` also forces a refresh during authentication.

Never commit or share a service-account JSON file. Move it outside the repository or delete it after use, and rotate it if it was exposed.

## Main frontend files

- `src/components/auth.jsx`: sign-in, sign-up, and role selection.
- `src/context/AuthContext.jsx`: user, claims, role, status, and super-admin state.
- `src/components/protectedRoutes.jsx`: admin/student route protection.
- `src/components/AdminLayout.jsx`: admin navigation and super-admin panel visibility.
- `src/api/backend.js`: sends Firebase tokens to the Worker.
- `src/pages/admin/AdminApproval.jsx`: loads and manages admin approvals.

Login refreshes the ID token, reads claims, then reads the profile for pending/student state. UI visibility is not the security boundary; the Worker and Rules enforce access.

## Firestore Rules

Rules are in `firestore.rules` and deploy with:

```text
firebase deploy --only firestore:rules
```

They allow users to read their own profile, allow super admins to manage profiles, allow only valid initial profiles, and block direct client writes to quizzes, answer keys, attempts, and submissions. Students can read submissions only after release.

If a rule denies access, check the ID-token claims first. Updating a profile does not update claims.

## Cloudflare Worker files

- `cloudflare-worker/src/index.js`: routes, CORS, errors, and cron.
- `src/auth.js`: Firebase token verification and claim updates.
- `src/firestore.js`: Firestore REST helpers.
- `src/handlers.js`: quiz CRUD and publishing.
- `src/attempts.js`: start, submit, and expiry.
- `src/grading.js`: essay marking and result release.
- `src/admin.js`: admin listing, approval, and rejection.

The Worker verifies the token signature, issuer, and Firebase project audience. It does not trust role values in request data.

## Admin approval flow

1. An applicant creates `role: admin`, `status: pending`.
2. A super admin opens Admin Approvals.
3. The page calls Worker `listAdmins`.
4. Approve calls Worker `approveAdmin`.
5. The Worker checks `isSuperAdmin: true`.
6. It updates Firebase claims and changes the profile to `approved`.
7. The approved user signs in again.

The page uses the Worker for both listing and approval so the UI and trusted backend read the same state.

## Quiz scoring and essays

Public quiz questions are stored separately from `quizAnswerKeys`. Correct answers never go to students. Objective scoring happens in the Worker. Admins set essay `maxPoints` while building a quiz; markers assign awarded points later. Results use awarded points divided by total attainable points.

## Timeout behavior

The Worker cron in `cloudflare-worker/wrangler.toml` runs every five minutes. Expired attempts become submissions with `timeExpired: true`. Objective answers can be scored, but essay answers remain unmarked until an admin assigns points; results cannot be released while required marking is incomplete.

## CORS and failed requests

Allowed origins are configured in `wrangler.toml`:

```text
https://question-master01.vercel.app
http://localhost:5173
http://127.0.0.1:5173
```

Add new exact origins before deploying. Avoid `*` for an authenticated API.

Health check:

```text
https://question-master-api.favoure1231.workers.dev/health
```

Use DevTools → Network for failures:

- `401`: missing/expired/invalid token.
- `403`: insufficient role or super-admin claim.
- `404`: route or record missing; approval requires admin + pending.
- `409`: duplicate/conflicting operation.
- `500`: Worker or service-account error.
- `blocked:cors` or `(failed)`: origin, extension, or network problem.

Worker logs can be viewed with Wrangler tail while reproducing the action. Never share Authorization headers or tokens.

## Deployment checklist

Frontend environment:

```text
VITE_API_BASE_URL=https://question-master-api.favoure1231.workers.dev
```

Vite variables are compiled into the bundle, so Vercel changes require a new deployment.

Validate frontend with `npm.cmd run lint` and `npm.cmd run build`. From `cloudflare-worker`, run `npm.cmd run lint` and `npm.cmd run deploy`. The Worker secret `FIREBASE_SERVICE_ACCOUNT_JSON` must exist in Cloudflare and must never be in source code.

The `functions/` folder is now legacy/reference code except for the claim migration script. Production API operations use the Worker.

## Safe debugging order

1. Run lint and build.
2. Confirm the deployed API URL.
3. Open Worker `/health`.
4. Inspect the browser status code.
5. Check UID and Firebase claims.
6. Check the Firestore profile.
7. Check Worker logs.
8. Check Firebase project and deployed Rules.
9. Redeploy only the changed layer.

Do not replace server authorization with client-side email checks or request-body roles.

## Current considerations

- The production bundle is above Vite’s 500 kB advisory threshold; code splitting can improve it.
- A scheduled expiry run previously logged a Firestore REST query `400`; inspect that query before relying on automatic expiry.
- Claim changes require an ID-token refresh.
- Remove and rotate exposed service-account keys.

