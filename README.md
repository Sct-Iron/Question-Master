# Question Master

Question Master is a Firebase-powered quiz and assessment platform for creating, delivering, marking, and reviewing quizzes.

**Live application:** [question-master01.vercel.app](https://question-master01.vercel.app)

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
- ESLint
- Vercel-ready deployment configuration

## Getting started

### Prerequisites

- Node.js 18 or newer
- npm
- A Firebase project with Authentication and Cloud Firestore enabled

### Installation

```bash
git clone https://github.com/<your-username>/question-master.git
cd question-master
npm install
```

Create a local `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

The `.env` file is ignored by Git. Never commit private service-account credentials or other secrets.

### Firebase setup

1. Create or select a project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a web application and copy its configuration values into `.env`.
3. Enable Email/Password under **Authentication → Sign-in method**.
4. Create a Cloud Firestore database.
5. Configure Firestore security rules before using the application in production.
6. Update the administrator email in `src/config/admin.js` if the project uses a different super administrator.

The application uses these Firestore collections:

| Collection | Purpose |
| --- | --- |
| `users` | User names, roles, and administrator approval status |
| `quizzes` | Quiz metadata, questions, publication state, and time limits |
| `drafts` | Per-user quiz-builder drafts |
| `submissions` | Student answers, scores, marking state, and released results |

## Available commands

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run ESLint:

```bash
npm run lint
```

## Application routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/auth` | Public | Sign in and create an account |
| `/pending-approval` | Authenticated | Pending administrator approval |
| `/admin/dashboard` | Admin | Activity overview |
| `/admin/quizzes` | Admin | Quiz library |
| `/admin/quiz-builder` | Admin | Create a quiz |
| `/admin/quiz-builder/:quizId` | Admin | Edit an existing quiz |
| `/admin/marking` | Admin | Mark submissions and release results |
| `/admin/admin-approvals` | Super admin | Manage administrator access |
| `/student/take-quiz` | Student | Browse and complete quizzes |
| `/student/view-results` | Student | View released results |

## Project structure

```text
src/
├── components/       Shared layouts, authentication, icons, and route guards
├── config/            Application configuration such as the super admin email
├── context/           Authentication state and user role management
├── pages/admin/       Administrator dashboard, quiz builder, library, and marking
├── pages/student/     Quiz-taking and result views
├── utils/             Scoring and time-limit helpers
├── App.jsx            Application routes
├── App.css            Shared application styles
└── firebase.js        Firebase initialization
```

## Deployment

The included `vercel.json` rewrites all requests to `index.html`, allowing React Router routes to work correctly on Vercel.

To deploy with Vercel:

1. Import the repository into Vercel.
2. Add all `VITE_FIREBASE_*` values as project environment variables.
3. Use the default Vite build settings, or set the build command to `npm run build`.
4. Deploy and verify Firebase Authentication and Firestore rules in the production environment.

## Security notes

Firebase client configuration values are intended for browser use, but access control must be enforced with Firestore Security Rules and Firebase Authentication. Do not rely on hidden navigation or client-side role checks alone to protect data.

Before production use, verify that:

- Students can read only published quizzes.
- Students can create submissions only for themselves.
- Students cannot edit submissions after submission.
- Administrators can manage only the resources allowed by their role.
- Only authorized administrators can mark or release results.
- Drafts are readable and writable only by their owner.

## Contributing

1. Create a feature branch.
2. Make focused changes and keep user-facing behavior documented.
3. Run `npm run build` and `npm run lint` before opening a pull request.
4. Include screenshots or a short screen recording for visual changes.
5. Describe any required Firebase indexes, rules, or environment variables.

## License

No license has been specified yet. Add a `LICENSE` file before distributing this project publicly.
