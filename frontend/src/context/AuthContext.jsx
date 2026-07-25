import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { watchAuthState, logout as firebaseLogout } from '../services/firebase.js';
import api from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(false);

  const exchangeSession = useCallback(async (fbUser) => {
    if (!fbUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const idToken = await fbUser.getIdToken();
      const { data } = await api.post('/auth/firebase-session', {
        idToken,
        name: fbUser.displayName,
      });

      if (data.requiresVerification) {
        setNeedsVerification(true);
        setUser(null);
      } else {
        localStorage.setItem('devtrack_access_token', data.accessToken);
        localStorage.setItem('devtrack_refresh_token', data.refreshToken);
        setUser(data.user);
        setNeedsVerification(false);
        connectSocket();
      }
    } catch (err) {
      console.error('Session exchange failed:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = watchAuthState((fbUser) => {
      setFirebaseUser(fbUser);
      setLoading(true);
      exchangeSession(fbUser);
    });
    return unsubscribe;
  }, [exchangeSession]);

  const refreshSession = () => firebaseUser && exchangeSession(firebaseUser);

  const logout = async () => {
    await firebaseLogout();
    localStorage.removeItem('devtrack_access_token');
    localStorage.removeItem('devtrack_refresh_token');
    disconnectSocket();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsVerification, refreshSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
