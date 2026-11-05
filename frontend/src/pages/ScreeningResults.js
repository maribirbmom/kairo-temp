import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import FitScore from '../components/FitScore';
import RequirementGaps from '../components/RequirementGaps';
import SectionAnalysis from '../components/SectionAnalysis';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ScreeningResults = () => {
  const { sessionId, resumeId } = useParams();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState(null);
  const [selectedResume, setSelectedResume] = useState(null);
  const [otherResumes, setOtherResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sessionResponse = await axios.get(`${API}/sessions/${sessionId}`);
      setSession(sessionResponse.data);
      
      const resumes = sessionResponse.data.resumes_data || [];
      
      if (resumeId) {
        const resume = resumes.find(r => r.id === resumeId);
        if (resume) {
          setSelectedResume(resume);
          setOtherResumes(resumes.filter(r => r.id !== resumeId));
          sessionStorage.setItem('currentResumeId', resumeId);
        }
      } else if (resumes.length > 0) {
        // Sort by match score and select the first one
        const sorted = [...resumes].sort((a, b) => (b.fit_score || b.match_score / 20 || 0) - (a.fit_score || a.match_score / 20 || 0));
        setSelectedResume(sorted[0]);
        setOtherResumes(sorted.slice(1));
        sessionStorage.setItem('currentResumeId', sorted[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, resumeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectResume = (resume) => {
    navigate(`/results/${sessionId}/${resume.id}`);
  };

  const handleGoToCoach = () => {
    if (selectedResume) {
      navigate(`/coach/${sessionId}/${selectedResume.id}`);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const extractJobTitle = () => {
    if (session?.job_title) return session.job_title;
    const text = session?.job_description || '';
    const patterns = [
      /looking for (?:a |an )?([^.]+?)(?:\s+with|\s+who|\s*\.)/i,
      /hiring (?:a |an )?([^.]+?)(?:\s+with|\s+who|\s*\.)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return 'Position';
  };

  if (loading) {
    return (
      <div className="bg-page-bg h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
          <p className="text-text-muted font-medium">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-page-bg text-text-main font-display h-screen flex overflow-hidden selection:bg-primary/20 selection:text-primary p-4 lg:p-6 gap-6">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Mobile Menu Button */}
      <div className="lg:hidden absolute top-4 left-4 z-50">
        <button className="bg-white p-2 rounded-xl shadow-sm text-text-main">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative rounded-[2.5rem] bg-page-bg overflow-hidden border border-white/40 shadow-inner-light">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth rounded-[2.5rem] relative">
          {/* Header */}
          <header className="sticky top-0 z-40 flex items-center justify-between whitespace-nowrap px-6 py-4 md:px-10 lg:py-6 bg-page-bg/95 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <button onClick={handleBack} className="hover:text-text-main cursor-pointer transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Kairo</span>
              </button>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-text-main">Dashboard Analysis</span>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 max-w-[1600px] pb-32">
            {/* Title */}
            <div className="mb-8">
              <h1 className="text-text-main text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-2" data-testid="results-title">
                Screening Results
              </h1>
              <p className="text-text-muted text-lg font-medium">
                Analysis complete for <span className="text-text-main font-semibold">{extractJobTitle()}</span>
              </p>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column */}
              <div className="xl:col-span-5 flex flex-col gap-6">
                {/* Job Context Card */}
                <div className="bg-card-bg rounded-3xl shadow-soft border border-white/60 p-1 flex flex-col relative overflow-hidden group">
                  <div className="px-6 py-4 flex justify-between items-center bg-white/50 rounded-t-[1.3rem]">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-1.5 rounded-lg shadow-sm text-primary">
                        <span className="material-symbols-outlined text-xl">description</span>
                      </div>
                      <h3 className="text-lg font-bold text-text-main">Job Context</h3>
                    </div>
                    <button 
                      onClick={handleBack}
                      className="text-xs font-semibold text-text-muted hover:text-primary transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="px-6 py-4">
                    <div className="text-sm text-text-muted line-clamp-4 leading-relaxed">
                      {session?.job_description?.substring(0, 300)}...
                    </div>
                  </div>
                </div>

                {/* Selected Resume Card */}
                {selectedResume && (
                  <div className="bg-card-bg rounded-3xl shadow-soft border border-white/60 p-1 flex flex-col relative overflow-hidden">
                    <div className="px-6 py-4 flex justify-between items-center bg-white/50 rounded-t-[1.3rem]">
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-1.5 rounded-lg shadow-sm text-yellow-600">
                          <span className="material-symbols-outlined text-xl">person</span>
                        </div>
                        <h3 className="text-lg font-bold text-text-main truncate max-w-[200px]">
                          {selectedResume.filename}
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/10">
                        Analyzed
                      </span>
                    </div>
                    <div className="p-2">
                      <div className="bg-white rounded-2xl border border-black/5 h-64 flex items-center justify-center relative overflow-hidden group cursor-pointer">
                        <div className="absolute inset-0 bg-slate-50 opacity-50 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[length:100%_2rem] p-8"></div>
                        <div className="absolute inset-0 p-8 space-y-3 opacity-30">
                          <div className="w-1/3 h-4 bg-slate-300 rounded mb-4"></div>
                          <div className="w-full h-2 bg-slate-300 rounded"></div>
                          <div className="w-full h-2 bg-slate-300 rounded"></div>
                          <div className="w-2/3 h-2 bg-slate-300 rounded mb-8"></div>
                          <div className="w-1/4 h-4 bg-slate-300 rounded mb-4"></div>
                          <div className="w-full h-2 bg-slate-300 rounded"></div>
                        </div>
                        <button className="relative z-10 bg-white/90 backdrop-blur text-text-main px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                          <span className="material-symbols-outlined text-lg">visibility</span> View PDF
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other Candidates */}
                {otherResumes.length > 0 && (
                  <div className="flex flex-col gap-3 px-2">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Other Candidates</h4>
                    {otherResumes.map((resume) => (
                      <div
                        key={resume.id}
                        onClick={() => handleSelectResume(resume)}
                        className="bg-white/60 p-3 rounded-2xl border border-white/50 flex items-center justify-between hover:bg-white transition-colors cursor-pointer group"
                        data-testid={`other-candidate-${resume.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-xl shadow-sm text-text-muted group-hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-lg">description</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-main truncate max-w-[150px]">{resume.filename}</p>
                            <p className="text-xs text-text-muted">
                              {resume.screening?.score != null
                                ? `${resume.screening.score.toFixed(1)} / 5 • ${resume.verdict === 'apply' ? 'Apply' : 'Skip'}`
                                : `${Math.round(resume.match_score || 0)}% Match`}
                            </p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-text-muted/50">chevron_right</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column - Analysis Panel */}
              <div className="xl:col-span-7 h-full">
                <div className="bg-card-bg rounded-[2rem] shadow-lg shadow-black/5 border border-white/60 relative overflow-hidden flex flex-col h-full">
                  {/* Score and AI Insight */}
                  <div className="p-6 pb-0 relative z-10">
                    <div className="flex flex-col md:flex-row gap-6 items-stretch">
                      {/* Match Score */}
                      <FitScore screening={selectedResume?.screening} fallbackPercent={selectedResume?.match_score || 0} />

                      {/* AI Insight */}
                      <div className="flex-[1.5] bg-dark-accent text-white rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                          <span className="material-symbols-outlined text-6xl">psychology</span>
                        </div>
                        <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                          <span className="material-symbols-outlined text-xl text-primary">auto_awesome</span>
                          AI Insight
                        </h4>
                        <p className="text-sm text-white/80 leading-relaxed">
                          {selectedResume?.ai_insight || 'Analyzing resume...'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {selectedResume?.screening?.hard_stops?.length > 0 && (
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100" data-testid="hard-stops">
                        <h6 className="text-sm font-bold text-danger mb-1 flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">block</span>Hard stops
                        </h6>
                        <ul className="text-xs text-danger/90 list-disc ml-5 space-y-0.5">
                          {selectedResume.screening.hard_stops.map((h, i) => <li key={i}>{h}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedResume?.screening?.checklist?.length > 0 && (
                      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100" data-testid="before-you-apply">
                        <h6 className="text-sm font-bold text-yellow-800 mb-1 flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">checklist</span>Before you apply
                        </h6>
                        <ul className="text-xs text-yellow-900/80 list-disc ml-5 space-y-1 leading-relaxed">
                          {selectedResume.screening.checklist.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Strengths and Gaps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Key Strengths */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-text-main flex items-center gap-2">
                          <div className="bg-success/10 text-success p-1 rounded-md">
                            <span className="material-symbols-outlined text-lg">check</span>
                          </div>
                          Key Strengths
                        </h5>
                        <ul className="space-y-2">
                          {(selectedResume?.key_strengths || []).map((strength, idx) => (
                            <li key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-transparent hover:border-success/20 shadow-sm">
                              <span className="material-symbols-outlined text-success text-base mt-0.5">check_circle</span>
                              <span className="text-sm text-text-main font-medium">{strength}</span>
                            </li>
                          ))}
                          {(!selectedResume?.key_strengths || selectedResume.key_strengths.length === 0) && (
                            <li className="text-sm text-text-muted">No strengths detected yet</li>
                          )}
                        </ul>
                      </div>

                      {/* Gaps / Missing */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-text-main flex items-center gap-2">
                          <div className="bg-danger/10 text-danger p-1 rounded-md">
                            <span className="material-symbols-outlined text-lg">priority_high</span>
                          </div>
                          Where you're lacking
                        </h5>
                        {selectedResume?.screening?.requirements?.length > 0 ? (
                          <RequirementGaps requirements={selectedResume.screening.requirements} limit={6} />
                        ) : (
                          <ul className="space-y-2">
                            {(selectedResume?.gaps_missing || []).slice(0, 5).map((gap, idx) => (
                              <li key={idx} className="bg-white p-3 rounded-xl shadow-sm text-sm font-medium text-text-main">
                                Missing keyword: "{gap}"
                              </li>
                            ))}
                            {(!selectedResume?.gaps_missing || selectedResume.gaps_missing.length === 0) && (
                              <li className="text-sm text-text-muted">No gaps detected</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>

                    {selectedResume?.screening?.requirements?.length > 0 && (
                      <details className="bg-white/60 rounded-xl border border-black/5 p-4" data-testid="full-requirements">
                        <summary className="cursor-pointer text-sm font-bold text-text-main">
                          Full requirement match ({selectedResume.screening.requirements.length})
                        </summary>
                        <div className="mt-3">
                          <RequirementGaps requirements={selectedResume.screening.requirements} showMet />
                        </div>
                      </details>
                    )}

                    {/* Section Analysis */}
                    <SectionAnalysis sections={selectedResume?.section_analysis} />

                    {/* ATS Risk Alert */}
                    {selectedResume?.ats_risks && selectedResume.ats_risks.length > 0 && (
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                        <span className="material-symbols-outlined text-danger mt-0.5">warning</span>
                        <div>
                          <h6 className="text-sm font-bold text-danger mb-1">ATS Risk Alert</h6>
                          <p className="text-xs text-danger/80 leading-relaxed">
                            {selectedResume.ats_risks[0]}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="h-16"></div>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-card-bg via-card-bg to-transparent pointer-events-none flex justify-center">
                    <button
                      onClick={handleGoToCoach}
                      className="pointer-events-auto bg-dark-accent text-white hover:bg-black hover:scale-105 transition-all shadow-xl shadow-dark-accent/20 px-6 py-3.5 rounded-full font-bold flex items-center gap-2 w-full md:w-auto justify-center"
                      data-testid="improve-resume-btn"
                    >
                      <span className="material-symbols-outlined text-xl text-primary">magic_button</span>
                      Improve My Resume with AI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ScreeningResults;
