import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const Sidebar = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, wipeData, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState(null); // null | 'data' | 'account'
  const [wipeMsg, setWipeMsg] = useState(() => {
    const m = sessionStorage.getItem('kairo_notice') || '';
    if (m) sessionStorage.removeItem('kairo_notice');
    return m;
  });
  const [busy, setBusy] = useState(false);

  const doWipe = async () => {
    setBusy(true);
    try {
      const d = await wipeData();
      const msg = `Wiped ${d.resumes} resume(s), ${d.analyses} analysis(es), ${d.chat_messages} chat message(s).`;
      sessionStorage.setItem('kairo_notice', msg);
      setWipeMsg(msg);
      setConfirm(null);
      navigate('/');
    } catch { setWipeMsg('Could not wipe data. Please try again.'); }
    setBusy(false);
  };
  const doDelete = async () => {
    setBusy(true);
    try { await deleteAccount(); } catch { setWipeMsg('Could not delete account. Please try again.'); setBusy(false); }
  };
  
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { id: 'screening', label: 'Resume Screening', icon: 'dashboard', path: '/' },
    { id: 'coach', label: 'CV Coach', icon: 'psychology', path: '/coach' },
    { id: 'history', label: 'History', icon: 'history', path: '/history' },
  ];

  return (
    <aside 
      data-testid="sidebar"
      className={`hidden lg:flex ${
        collapsed ? 'w-20' : 'w-72'
      } bg-card-bg rounded-[2.5rem] shadow-sidebar flex-col shrink-0 z-50 h-[calc(100vh-3rem)] overflow-hidden transition-all duration-300`}
    >
      {/* Logo Section */}
      <div className={`pt-10 ${collapsed ? 'px-4' : 'px-8'} pb-8`}>
        <div className="flex items-center gap-4">
          <div 
            className="size-12 flex items-center justify-center bg-dark-accent text-white rounded-full shadow-lg shrink-0 cursor-pointer hover:scale-105 transition-transform"
            onClick={onToggle}
            data-testid="sidebar-toggle"
          >
            <img 
              src="/assets/kairo-logo.png" 
              alt="Kairo" 
              className="w-6 h-6 invert"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<span class="material-symbols-outlined text-2xl">bubble_chart</span>';
              }}
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold tracking-tight text-text-main leading-none">Kairo</h2>
              <span className="text-xs font-medium text-text-muted mt-1">Resume Screener</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'px-3' : 'px-6'} space-y-1 overflow-y-auto`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.path === '/coach') {
                // CV Coach needs session and resume ID
                const sessionId = sessionStorage.getItem('currentSessionId');
                const resumeId = sessionStorage.getItem('currentResumeId');
                if (sessionId && resumeId) {
                  navigate(`/coach/${sessionId}/${resumeId}`);
                } else {
                  navigate('/');
                }
              } else {
                navigate(item.path);
              }
            }}
            data-testid={`nav-${item.id}`}
            className={`w-full nav-item ${
              isActive(item.path) || (item.path === '/coach' && location.pathname.includes('/coach'))
                ? 'active'
                : ''
            } ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Account */}
      {user && (
        <div className={`${collapsed ? 'px-3' : 'px-6'} pb-6 pt-3 border-t border-black/5`} data-testid="account-box">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            {user.picture ? (
              <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full shrink-0" />
            ) : (
              <div className="size-9 rounded-full bg-dark-accent text-white flex items-center justify-center text-sm font-bold shrink-0">
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text-main truncate">{user.name || 'Account'}</p>
                <p className="text-xs text-text-muted truncate">{user.email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="mt-3 flex flex-col gap-1 text-xs font-semibold">
              <button onClick={signOut} className="text-left text-text-muted hover:text-text-main" data-testid="sign-out">Sign out</button>
              {confirm === null && (
                <>
                  <button onClick={() => { setWipeMsg(''); setConfirm('data'); }} className="text-left text-text-muted hover:text-danger" data-testid="wipe-data">
                    Wipe my data (keep account)
                  </button>
                  <button onClick={() => { setWipeMsg(''); setConfirm('account'); }} className="text-left text-text-muted hover:text-danger" data-testid="delete-account">
                    Delete account + all data
                  </button>
                </>
              )}
              {confirm === 'data' && (
                <span className="text-danger leading-snug">
                  Permanently delete all your resumes, analyses, history and chats? This can't be undone.{' '}
                  <button disabled={busy} onClick={doWipe} className="underline font-bold" data-testid="confirm-wipe">Yes, wipe</button>{' '}
                  <button onClick={() => setConfirm(null)} className="underline">Cancel</button>
                </span>
              )}
              {confirm === 'account' && (
                <span className="text-danger leading-snug">
                  Permanently delete your account and everything stored for it, and clear this browser? This can't be undone.{' '}
                  <button disabled={busy} onClick={doDelete} className="underline font-bold" data-testid="confirm-delete">Yes, delete all</button>{' '}
                  <button onClick={() => setConfirm(null)} className="underline">Cancel</button>
                </span>
              )}
              {wipeMsg && <span className="text-success leading-snug" data-testid="wipe-result">{wipeMsg}</span>}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
