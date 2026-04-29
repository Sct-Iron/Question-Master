import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ADMIN_EMAIL } from '../config/admin';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'student' | null
  const [status, setStatus] = useState(null); // 'approved' | 'pending' | 'rejected' | null
  const [userName, setUserName] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userEmail = firebaseUser.email?.trim().toLowerCase() || '';
        const isSuper = userEmail === ADMIN_EMAIL.toLowerCase();
        setIsSuperAdmin(isSuper);

        // Always treat the super admin as approved admin
        if (isSuper) {
          setUser(firebaseUser);
          setRole('admin');
          setStatus('approved');

          // Try to get the name from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              setUserName(userDoc.data().name || '');
            }
          } catch (e) {
            console.warn('Could not fetch super admin profile:', e.message);
          }
        } else {
          // For all other users, read role + status from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              setRole(data.role || 'student');
              // Backward compatibility: old docs without status get 'approved'
              setStatus(data.status || 'approved');
              setUserName(data.name || '');
            } else {
              // No Firestore doc — fallback to student
              setRole('student');
              setStatus('approved');
              setUserName('');
            }
          } catch (e) {
            console.warn('Could not fetch user profile:', e.message);
            // Fallback to student on error
            setRole('student');
            setStatus('approved');
            setUserName('');
          }
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
        setRole(null);
        setStatus(null);
        setUserName('');
        setIsSuperAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Allow re-fetching status (used by PendingApproval page)
  async function refreshStatus() {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setRole(data.role || 'student');
        setStatus(data.status || 'approved');
        setUserName(data.name || '');
      }
    } catch (e) {
      console.warn('Could not refresh user status:', e.message);
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, status, userName, loading, isSuperAdmin, refreshStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
