import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// requiredRole: 'admin' | 'student' | undefined (any authenticated user)
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, role, status, loading } = useAuth();
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Pending admins get sent to the pending approval page
  if (normalizedRole === 'admin' && normalizedStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Rejected admins treated as students
  if (normalizedRole === 'admin' && normalizedStatus === 'rejected') {
    return <Navigate to="/student/take-quiz" replace />;
  }

  if (requiredRole && normalizedRole !== requiredRole) {
    return <Navigate to={normalizedRole === 'admin' ? '/admin/dashboard' : '/student/take-quiz'} replace />;
  }

  return children;
};

export default ProtectedRoute;