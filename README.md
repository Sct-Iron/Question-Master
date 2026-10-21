# Question Master

Question Master is a Firebase-powered quiz and assessment platform for creating, delivering, marking, and reviewing quizzes.

It provides separate experiences for administrators and students:

- Administrators create quizzes with multiple-choice and essay questions.
- Students discover published quizzes, complete timed assessments, and submit answers.
- Administrators manually mark essay responses and release results.
- Students can review released results from their dashboard.

## Features

### Administrator portal

- Dashboard with quiz, submission, and student activity summaries.
- Quiz builder with title, optional time limit, MCQ questions, and essay questions.
- Draft saving while building a quiz.
- Quiz editing, publishing, and deletion.
- Submission marking with essay scoring.
- Result release workflow.
- Admin approval management for the super administrator.

### Student portal

- Browse and search published quizzes.
- See question counts, question types, and time limits before starting.
- Complete multiple-choice and essay questions.
- Live countdown timer for timed quizzes.
- Automatic submission when time expires.
- One-submission-per-quiz tracking.
- View released results and answer details.

### Platform foundations

- Email/password authentication with Firebase Authentication.
- Role-aware routing for students, admins, and pending administrators.
- Firestore-backed quizzes, drafts, submissions, and user profiles.
- Responsive admin and student layouts.
- Vercel-ready deployment configuration.

## Tech stack

- React 19
- Vite 8
- React Router 7
- Firebase Authentication
- Cloud Firestore
- Cloudflare Workers
- ESLint
- Vercel-ready deployment configuration

**Live application:** [question-master01.vercel.app](https://question-master01.vercel.app)

## Portfolio highlights

Question Master is a full-stack assessment platform designed around a clear trust boundary between the browser and the backend.

- React application with separate student and administrator workflows.
- Firebase Authentication with custom role claims for administrator authorization.
- Firestore Security Rules that restrict direct database access.
- Cloudflare Worker API for trusted quiz operations and server-side business logic.
- Server-side scoring so students cannot alter objective scores or access answer keys.
- Essay marking with administrator-defined maximum points and validated awarded scores.
- Time-limited attempts with automatic expiry processing through a scheduled Worker trigger.
- Admin approval and result-release workflows.
- Deployment across Vercel, Cloudflare Workers, Firebase Authentication, and Firestore.

The Cloudflare migration is an intentional cost-conscious architecture choice. Firebase Authentication and Firestore remain the identity and data layers, while Cloudflare Workers provide the trusted API layer without requiring Firebase Cloud Functions billing.

## Security model

The browser sends a Firebase ID token to the Cloudflare Worker. The Worker verifies the token, checks the user's role, and performs privileged Firestore operations through the Firestore REST API. Answer keys are stored separately from student-facing quiz data, and client-side writes to sensitive collections are denied by Firestore Rules.

Service-account credentials are stored as Cloudflare Worker Secrets and must never be committed to the repository or exposed to the frontend. Custom-claim changes are performed through controlled administrative tooling rather than client code.

## Production-readiness notes

Before treating the project as production-ready:

- Run end-to-end tests for login, quiz creation, quiz attempts, expiry, essay marking, result release, and admin approval.
- Configure `VITE_API_BASE_URL` in the production Vercel environment and redeploy the frontend.
- Verify the Cloudflare scheduled expiry trigger with a real expired attempt.
- Enable monitoring, error reporting, and basic API abuse protection.
- Rotate the Firebase service-account key after testing or if it has been exposed.
- Keep the old `functions/` implementation only as a migration reference until the Worker has been fully verified.

## Firebase Rules and admin claims

The configured super administrator is initialized through controlled administrative tooling. Claims are not inferred from a client-side email address, and existing admin claims can be repaired with the one-time migration script below.

Timed-out attempts are finalized by the scheduled expireQuizAttempts function. They become submissions with timeExpired set to true; unanswered essay questions remain unmarked and results cannot be released until those essays are scored.

The production backend now uses the `question-master-api` Cloudflare Worker for quiz creation, quiz attempts, trusted scoring, marking, result release, admin approval, and scheduled expiry. Students receive sanitized quiz data; answer keys are stored separately in `quizAnswerKeys`.

1. Deploy Firestore Rules with `firebase deploy --only firestore:rules`.
2. Install Wrangler and authenticate with the Cloudflare account that owns the Worker.
3. From `cloudflare-worker`, configure the Firebase service-account JSON as a Worker Secret:

   `wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON`

4. Deploy the Worker:

   `wrangler deploy`

5. Configure the frontend environment variable:

   `VITE_API_BASE_URL=https://question-master-api.<your-workers-subdomain>.workers.dev`

6. For an existing approved admin whose claim is missing, get the user's Firebase Authentication UID from **Authentication > Users**, verify that `users/{uid}` has `role: "admin"` and `status: "approved"`, then run a dry run followed by the one-time migration:

   `node functions/scripts/migrate-admin-claims.js --uid <MR_OKOLO_UID>`

   `node functions/scripts/migrate-admin-claims.js --uid <MR_OKOLO_UID> --apply`

   To explicitly promote that verified, approved account to super administrator, use the UID-targeted command below. This is intentionally not available for bulk migration:

   `node functions/scripts/migrate-admin-claims.js --uid <MR_OKOLO_UID> --super-admin --apply`

   The migration uses the Admin SDK, preserves unrelated claims, and changes only an already-approved admin profile. The user must sign out and sign in again, or force an ID-token refresh, before the new claim reaches the browser.

Do not restore the old client-side email check. Authorization is enforced by Firebase custom claims, Cloudflare Worker checks, and Firestore Rules. The Worker source and configuration are in `cloudflare-worker/`.
