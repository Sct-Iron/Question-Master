import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// requiredRole: 'admin' | 'student' | undefined (any authenticated user)
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Redirect to the correct dashboard for their actual role
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/student/take-quiz'} replace />;
  }

  return children;
};

export default ProtectedRoute;