import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../lib/auth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Login = () => {
  const { completeLogin } = useAuth();
  const btnRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/auth/config`).then((r) => setConfig(r.data)).catch(() => setError('Cannot reach the server.'));
  }, []);

  // Google Identity Services button
  useEffect(() => {
    if (!config?.google_client_id) return;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: config.google_client_id,
        callback: async ({ credential }) => {
          try {
            const r = await axios.post(`${API}/auth/google`, { credential });
            completeLogin(r.data);
          } catch {
            setError('Google sign-in failed. Please try again.');
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
    };
    if (window.google?.accounts?.id) { init(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [config, completeLogin]);

  const devLogin = async () => {
    try { completeLogin((await axios.post(`${API}/auth/dev`)).data); }
    catch { setError('Dev login failed.'); }
  };

  return (
    <div className="bg-page-bg text-text-main font-display min-h-screen flex items-center justify-center p-6">
      <div className="bg-card-bg rounded-[2.5rem] shadow-soft border border-white/60 p-10 max-w-md w-full text-center" data-testid="login-card">
        <div className="size-14 mx-auto mb-5 flex items-center justify-center bg-dark-accent text-white rounded-full shadow-lg">
          <img src="/assets/kairo-logo.png" alt="Kairo" className="w-8 h-8 invert" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Kairo</h1>
        <p className="text-text-muted mb-8">
          Score your resume against any job (1–5), see exactly where you're lacking, and keep your history.
        </p>

        {config?.google_client_id && <div ref={btnRef} className="flex justify-center" data-testid="google-btn" />}

        {config && !config.google_client_id && !config.dev_auth && (
          <p className="text-sm text-danger">Sign-in isn't configured on this server yet.</p>
        )}

        {config?.dev_auth && (
          <button onClick={devLogin} data-testid="dev-login"
            className="mt-4 text-sm font-semibold text-text-muted hover:text-text-main underline">
            Developer login (local only)
          </button>
        )}

        {error && <p className="text-sm text-danger mt-4">{error}</p>}

        <p className="text-xs text-text-muted/80 mt-8 leading-relaxed">
          We only store your name, email and the analyses you run. Personal details are stripped from resumes before
          anything is analysed, and you can delete everything from the app at any time.
        </p>
      </div>
    </div>
  );
};

export default Login;
