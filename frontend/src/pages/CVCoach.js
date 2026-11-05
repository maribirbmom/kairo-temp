import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import RequirementGaps from '../components/RequirementGaps';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CVCoach = () => {
  const { sessionId, resumeId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState(null);
  const [resume, setResume] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [initialAnalysis, setInitialAnalysis] = useState(null);

  // Removed filter buttons as per user request

  const fetchData = useCallback(async () => {
    try {
      const [sessionRes, resumeRes, historyRes] = await Promise.all([
        axios.get(`${API}/sessions/${sessionId}`),
        axios.get(`${API}/resumes/${resumeId}`),
        axios.get(`${API}/coach/history/${resumeId}`),
      ]);
      
      setSession(sessionRes.data);
      setResume(resumeRes.data);
      
      if (historyRes.data.messages && historyRes.data.messages.length > 0) {
        setMessages(historyRes.data.messages);
      } else {
        // Get initial analysis
        const formData = new FormData();
        formData.append('resume_id', resumeId);
        formData.append('session_id', sessionId);
        
        const initialRes = await axios.post(`${API}/coach/initial-analysis`, formData);
        setInitialAnalysis(initialRes.data);
        
        // Create initial message
        const initialMessage = {
          id: 'initial',
          role: 'assistant',
          content: `I've analyzed your resume against the '${initialRes.data.job_title || 'Position'}' role. ${resumeRes.data.screening?.score != null ? `You score **${resumeRes.data.screening.score.toFixed(1)} / 5** (${resumeRes.data.screening.label.toLowerCase()}). The gap list above shows exactly what is holding you back. Ask me to help close any of them.` : `You're a **${Math.round(initialRes.data.match_score || 0)}% match!** Let's close that gap with a few quick fixes.`}`,
          suggestion_type: 'overview',
        };
        setMessages([initialMessage]);
        
        // Add missing keywords message if available
        if (initialRes.data.missing_keywords && initialRes.data.missing_keywords.length > 0) {
          const keywordsMessage = {
            id: 'keywords-initial',
            role: 'assistant',
            content: `Your resume already hints at **${initialRes.data.missing_keywords.slice(0, 2).join('** and **')}**, but it isn't clear or explicit. Reword or surface your real related experience so a recruiter (or ATS) can see it. Only add what you've genuinely done.`,
            suggestion_type: 'keywords',
            missing_keywords: initialRes.data.missing_keywords.slice(0, 5),
          };
          setMessages(prev => [...prev, keywordsMessage]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [sessionId, resumeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/coach/chat`, {
        session_id: sessionId,
        resume_id: resumeId,
        message: inputMessage,
        filter_type: activeFilter,
      });

      const assistantMessage = {
        id: response.data.message_id,
        role: 'assistant',
        content: response.data.content,
        suggestion_type: response.data.suggestion_type,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        suggestion_type: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleBack = () => {
    navigate(`/results/${sessionId}/${resumeId}`);
  };

  const extractJobTitle = () => {
    if (session?.job_title) return session.job_title;
    if (initialAnalysis?.job_title) return initialAnalysis.job_title;
    return 'Position';
  };

  // Enhanced markdown formatter for LLM responses
  const formatMessage = (content) => {
    if (!content) return '';
    
    let formatted = content;
    
    // Remove ### markdown headers and style them
    formatted = formatted.replace(/^###\s*(\d+\.?\s*)?(.+)$/gm, '<h4 class="text-lg font-bold text-text-main mt-4 mb-2 flex items-center gap-2"><span class="text-primary">$1</span>$2</h4>');
    formatted = formatted.replace(/^##\s*(.+)$/gm, '<h3 class="text-xl font-bold text-text-main mt-4 mb-2">$1</h3>');
    formatted = formatted.replace(/^#\s*(.+)$/gm, '<h2 class="text-2xl font-bold text-text-main mt-4 mb-2">$1</h2>');
    
    // Convert **text** to bold with primary color
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-primary font-bold">$1</strong>');
    
    // Convert *text* to italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    
    // Convert `code` to code styling
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-primary px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Convert --- to horizontal rule
    formatted = formatted.replace(/^---$/gm, '<hr class="my-4 border-gray-200" />');
    formatted = formatted.replace(/^--$/gm, '<hr class="my-3 border-gray-100" />');
    
    // Style "Issue:", "Original:", "Suggested improvement:" labels
    formatted = formatted.replace(/\b(Issue):/gi, '<span class="inline-flex items-center gap-1 text-red-600 font-bold"><span class="material-symbols-outlined text-sm">error</span>$1:</span>');
    formatted = formatted.replace(/\b(Original):/gi, '<span class="inline-flex items-center gap-1 text-text-muted font-semibold"><span class="material-symbols-outlined text-sm">history</span>$1:</span>');
    formatted = formatted.replace(/\b(Suggested improvement|Suggestion|Improved):/gi, '<span class="inline-flex items-center gap-1 text-success font-bold"><span class="material-symbols-outlined text-sm">lightbulb</span>$1:</span>');
    
    // Convert bullet points
    formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<li class="flex items-start gap-2 ml-2"><span class="text-primary mt-1.5">•</span><span>$1</span></li>');
    
    // Wrap consecutive li elements in ul
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (match) => {
      return `<ul class="space-y-2 my-3">${match}</ul>`;
    });
    
    // Convert line breaks to proper spacing
    formatted = formatted.replace(/\n\n/g, '</p><p class="mt-3">');
    formatted = formatted.replace(/\n/g, '<br />');
    
    return formatted;
  };

  const renderMessage = (message) => {
    if (message.role === 'user') {
      return (
        <div key={message.id} className="flex gap-4 items-end justify-end animate-fade-in-up">
          <div className="bg-dark-accent text-white p-4 rounded-[2rem] rounded-br-none max-w-2xl">
            <p className="text-[15px] leading-relaxed">{message.content}</p>
          </div>
        </div>
      );
    }

    // Assistant message
    return (
      <div key={message.id} className="flex gap-4 items-start animate-fade-in-up">
        <div className="size-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 mt-1">
          <span className="material-symbols-outlined text-text-main text-xl">smart_toy</span>
        </div>
        <div className="flex flex-col gap-1 max-w-2xl flex-1">
          {message.suggestion_type === 'keywords' && message.missing_keywords ? (
            <div className="bg-white p-2 rounded-[2rem] rounded-bl-none shadow-soft border border-gray-100/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Surface existing experience</span>
              </div>
              <div className="p-6 pt-4">
                <div 
                  className="text-text-main mb-4 text-[15px] leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                />
                <div className="bg-page-bg/30 p-5 rounded-2xl mb-5">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-muted mb-3 uppercase tracking-wide">
                    <span className="material-symbols-outlined text-sm text-primary">lightbulb</span>
                    Make these clearer on your CV
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.missing_keywords.map((kw, idx) => (
                      <span 
                        key={idx}
                        className="bg-success/10 text-success border border-success/20 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-[2rem] rounded-bl-none shadow-soft border border-gray-100/50">
              {message.suggestion_type && message.suggestion_type !== 'overview' && message.suggestion_type !== 'general' && (
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    message.suggestion_type === 'keywords' ? 'bg-red-100 text-red-700' :
                    message.suggestion_type === 'impact' ? 'bg-yellow-100 text-yellow-700' :
                    message.suggestion_type === 'tone' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {message.suggestion_type === 'impact' ? 'Impact & Metrics' : message.suggestion_type}
                  </span>
                </div>
              )}
              <div 
                className="text-text-main text-[15px] leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
              />
            </div>
          )}
          <span className="text-[10px] font-bold text-text-muted ml-2">AI Coach • Just now</span>
        </div>
      </div>
    );
  };

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
      <div className="flex flex-1 overflow-hidden gap-4">
        {/* Chat Area */}
        <main className="flex-1 flex flex-col relative min-w-0 bg-card-bg rounded-[2.5rem] shadow-sm overflow-hidden border border-white/40">
          {/* Header */}
          <div className="flex-none px-8 pt-8 pb-4 w-full">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-4">
              <div>
                <button 
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-text-muted hover:text-text-main mb-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back to Results
                </button>
                <h1 className="text-3xl md:text-4xl font-extrabold text-text-main leading-tight mb-2 tracking-tight" data-testid="coach-title">
                  Hi there,<br />
                  <span className="text-text-muted font-medium">let's polish your CV.</span>
                </h1>
              </div>
              <div className="flex items-center gap-5 bg-dark-accent p-1 pr-6 rounded-full shadow-lg text-white">
                <div className="size-14 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold" data-testid="coach-fit-score">
                  {resume?.screening?.score != null ? resume.screening.score.toFixed(1) : `${Math.round(resume?.match_score || 0)}%`}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {resume?.screening?.score != null ? `Fit score / 5 · ${resume.decision || (resume.verdict === 'apply' ? 'Apply' : 'Skip')}` : 'Match Score'}
                  </span>
                  <span className="text-sm font-medium text-gray-200">{extractJobTitle()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-2 w-full space-y-6 pb-28">
            {resume?.screening?.requirements?.length > 0 && (
              <div className="bg-page-bg rounded-3xl p-5 border border-white/60" data-testid="coach-gaps">
                <h3 className="font-bold text-text-main mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-danger">priority_high</span>
                  Where you're lacking for this role
                </h3>
                <p className="text-xs text-text-muted mb-3">
                  Based on your resume vs the job description. Fixes only use real experience, never invent any.
                </p>
                <RequirementGaps requirements={resume.screening.requirements} />
              </div>
            )}
            {messages.map(renderMessage)}
            
            {isLoading && (
              <div className="flex gap-4 items-start animate-fade-in-up">
                <div className="size-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 mt-1">
                  <span className="material-symbols-outlined text-text-main text-xl animate-pulse">smart_toy</span>
                </div>
                <div className="bg-white p-6 rounded-[2rem] rounded-bl-none shadow-soft border border-gray-100/50">
                  <div className="flex gap-1">
                    <span className="size-2 bg-text-muted/40 rounded-full animate-bounce"></span>
                    <span className="size-2 bg-text-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="size-2 bg-text-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="absolute bottom-6 left-0 right-0 px-8 pointer-events-none">
            <div className="max-w-4xl mx-auto relative group pointer-events-auto">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your CV..."
                className="w-full bg-white/90 backdrop-blur-xl border-0 shadow-lg ring-1 ring-white rounded-full py-4 pl-14 pr-14 text-text-main placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                data-testid="chat-input"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className={`absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full transition-colors shadow-md flex items-center justify-center ${
                  inputMessage.trim() && !isLoading
                    ? 'bg-text-main hover:bg-black text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                data-testid="send-btn"
              >
                <span className="material-symbols-outlined text-lg">arrow_upward</span>
              </button>
            </div>
          </div>
        </main>

        {/* Resume Preview Sidebar */}
        <aside className="hidden xl:flex w-[420px] flex-col rounded-[2.5rem] bg-white shadow-sm border border-white/40 overflow-hidden relative">
          <div className="p-6 pb-2 flex justify-between items-center z-10 bg-white border-b border-gray-50">
            <h3 className="font-bold text-lg text-text-main">Resume Preview</h3>
            <span className="text-xs font-medium text-text-muted bg-page-bg px-2 py-1 rounded">
              {resume?.filename || 'Resume.pdf'}
            </span>
          </div>

          {/* Actual Resume Content - Full Text */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              {resume?.extracted_text ? (
                <div className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap font-mono">
                  {resume.extracted_text}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Placeholder when no resume text */}
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-text-muted/30 mb-2">description</span>
                    <p className="text-sm text-text-muted">Resume preview will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Match Info Box */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-center gap-3 p-4 bg-page-bg rounded-2xl">
              <div className="size-10 rounded-full bg-success/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-success">trending_up</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-text-main">{resume?.screening?.score != null ? 'Fit score' : 'Match Score'}</p>
                <p className="text-lg font-bold text-success">
                  {resume?.screening?.score != null ? `${resume.screening.score.toFixed(1)} / 5` : `${Math.round(resume?.match_score || 0)}%`}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CVCoach;
