import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const History = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [items, setItems] = useState(null);

  useEffect(() => {
    axios.get(`${API}/history`).then((r) => setItems(r.data.items)).catch(() => setItems([]));
  }, []);

  const open = (item, resume) => {
    sessionStorage.setItem('currentSessionId', item.session_id);
    sessionStorage.setItem('currentResumeId', resume.resume_id);
    navigate(`/results/${item.session_id}/${resume.resume_id}`);
  };

  return (
    <div className="bg-page-bg text-text-main font-display h-screen flex overflow-hidden p-4 lg:p-6 gap-6">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 rounded-[2.5rem] bg-page-bg overflow-y-auto border border-white/40 shadow-inner-light">
        <main className="px-6 md:px-10 py-8 max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">History</h1>
          <p className="text-text-muted text-lg mb-8">Your previous job-to-resume comparisons.</p>

          {items === null && <p className="text-text-muted">Loading…</p>}
          {items?.length === 0 && (
            <div className="bg-card-bg rounded-3xl p-8 text-center border border-white/60" data-testid="history-empty">
              <p className="text-text-muted mb-4">No comparisons yet.</p>
              <button onClick={() => navigate('/')} className="bg-dark-accent text-white px-6 py-3 rounded-full font-bold">Screen a resume</button>
            </div>
          )}

          <div className="space-y-4" data-testid="history-list">
            {items?.map((item) => (
              <div key={item.session_id} className="bg-card-bg rounded-3xl shadow-soft border border-white/60 p-5">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg truncate">{item.job_title || 'Untitled role'}</h3>
                    <p className="text-sm text-text-muted line-clamp-2">{item.job_snippet}</p>
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <div className="space-y-2">
                  {item.resumes.map((r) => (
                    <button key={r.resume_id} onClick={() => open(item, r)}
                      className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-black/5 hover:border-primary/40 transition-colors text-left">
                      <span className="text-sm font-semibold truncate">{r.filename}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className={`text-sm font-bold ${r.verdict === 'apply' ? 'text-success' : 'text-danger'}`}>
                          {r.fit_score != null ? `${r.fit_score.toFixed(1)} / 5` : '–'}
                        </span>
                        <span className="text-xs font-bold">{r.decision || (r.verdict === 'apply' ? 'Apply' : 'Skip')}</span>
                        <span className="material-symbols-outlined text-text-muted/50">chevron_right</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default History;
