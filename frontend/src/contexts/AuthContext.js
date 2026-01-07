import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProfile, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    // #region agent log
    fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.js:11',message:'checkAuth called',data:{timestamp:new Date().toISOString()},sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    try {
      // #region agent log
      fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.js:15',message:'calling getProfile',data:{},sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      const response = await getProfile();

      // #region agent log
      fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.js:17',message:'getProfile response',data:{success:response.success,hasData:!!response.data},sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (response.success) {
        setUser(response.data);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      // #region agent log
      fetch('http://localhost:7249/ingest/5ea09056-5083-454b-b85a-cdd71ab76e49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.js:22',message:'checkAuth error',data:{error:error.message},sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    checkAuth,
    isProfileComplete: user?.is_profile_complete || false,
    userRole: user?.role || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;


