import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// requiredRole: 'admin' | 'student' | undefined (any authenticated user)
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, role, status, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Pending admins get sent to the pending approval page
  if (role === 'admin' && status === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Rejected admins treated as students
  if (role === 'admin' && status === 'rejected') {
    // They chose admin but got rejected — redirect to student area
    return <Navigate to="/student/take-quiz" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Redirect to the correct dashboard for their actual role
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/student/take-quiz'} replace />;
  }

  return children;
};

export default ProtectedRoute;