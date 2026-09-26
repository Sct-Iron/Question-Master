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
- ESLint
- Vercel-ready deployment configuration
