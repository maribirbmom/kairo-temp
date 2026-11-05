import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = 'kairo_token';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const setAuthHeader = (token) => {
  if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axios.defaults.headers.common.Authorization;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.clear();
    setAuthHeader(null);
    setUser(null);
  }, []);

  const completeLogin = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setAuthHeader(data.token);
    setUser(data.user);
  }, []);

  // Restore session on page load.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    setAuthHeader(token);
    axios.get(`${API}/me`)
      .then((r) => setUser(r.data))
      .catch(() => signOut())
      .finally(() => setLoading(false));
  }, [signOut]);

  // Any 401 from the API means the session is gone: send the user back to sign in.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err.response?.status === 401 && !String(err.config?.url || '').includes('/auth/')) signOut();
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [signOut]);

  // Wipe every resume, analysis and chat on the server but keep the account.
  const wipeData = useCallback(async () => {
    const r = await axios.delete(`${API}/me/data`);
    sessionStorage.clear();
    return r.data.deleted;
  }, []);

  // Delete the account and all data, then clear everything stored in this browser too.
  const deleteAccount = useCallback(async () => {
    const r = await axios.delete(`${API}/me`);
    localStorage.clear();
    signOut();
    return r.data.deleted;
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ user, loading, completeLogin, signOut, wipeData, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};
