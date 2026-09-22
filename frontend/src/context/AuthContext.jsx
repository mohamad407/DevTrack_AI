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

  const exchangeSession = useCallback(async (fbUser, forceRefresh = false) => {
    if (!fbUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const idToken = await fbUser.getIdToken(forceRefresh);
      const { data } = await api.post('/auth/firebase-session', {
        idToken,
        name: fbUser.displayName,
      });

      if (data.requiresVerification) {
        setNeedsVerification(true);
        setUser(null);
      } else {
        // withCredentials on the api client means the httpOnly refreshToken
        // cookie is set by the server automatically — nothing to store here.
        localStorage.setItem('devtrack_access_token', data.accessToken);
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

  const refreshSession = () => firebaseUser && exchangeSession(firebaseUser, true);

  const logout = async () => {
    await firebaseLogout();
    try {
      await api.post('/auth/logout'); // clears the httpOnly refreshToken cookie server-side
    } catch {
      // best-effort; still clear local state below
    }
    localStorage.removeItem('devtrack_access_token');
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
