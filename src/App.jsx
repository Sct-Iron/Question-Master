import './App.css';
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/protectedRoutes';
import Auth from './components/auth';
import AdminLayout from './components/AdminLayout';
import StudentLayout from './components/StudentLayout';
import Dashboard from './pages/admin/Dashboard';
import QuizBuilder from './pages/admin/QuizBuilder';
import Quizzes from './pages/admin/quizzes';
import Marking from './pages/admin/Marking';
import AdminApproval from './pages/admin/AdminApproval';
import TakeQuiz from './pages/student/TakeQuiz';
import ViewResults from './pages/student/ViewResults';
import PendingApproval from './pages/PendingApproval';

function NewQuizBuilder() {
  const location = useLocation();
  return <QuizBuilder key={location.key} />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public: auth screen */}
          <Route path="/auth" element={<Auth />} />

          {/* Pending approval screen (for unapproved admins) */}
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* Admin-only routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="quizzes" element={<Quizzes />} />
            <Route path="quiz-builder" element={<NewQuizBuilder />} />
            <Route path="quiz-builder/:quizId" element={<QuizBuilder />} />
            <Route path="marking" element={<Marking />} />
            <Route path="admin-approvals" element={<AdminApproval />} />
          </Route>

          {/* Student-only routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="take-quiz" replace />} />
            <Route path="take-quiz" element={<TakeQuiz />} />
            <Route path="view-results" element={<ViewResults />} />
          </Route>

          {/* Catch-all: send to auth */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
