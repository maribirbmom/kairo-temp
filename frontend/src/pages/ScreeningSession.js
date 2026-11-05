import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import FileUpload from '../components/FileUpload';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ScreeningSession = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [consented, setConsented] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const isJDValid = jobDescription.length >= 100;
  const hasResumes = uploadedFiles.length > 0;

  const handleFilesSelected = useCallback(async (files) => {
    // Create session if not exists
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const formData = new FormData();
        formData.append('job_description', jobDescription || 'Job description pending...');
        formData.append('job_title', '');
        
        const response = await axios.post(`${API}/sessions`, formData);
        currentSessionId = response.data.session_id;
        setSessionId(currentSessionId);
        sessionStorage.setItem('currentSessionId', currentSessionId);
      } catch (error) {
        console.error('Error creating session:', error);
        return;
      }
    }

    // Upload each file
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(
          `${API}/sessions/${currentSessionId}/upload`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        
        setUploadedFiles((prev) => [
          ...prev,
          {
            id: response.data.resume_id,
            resume_id: response.data.resume_id,
            name: file.name,
            size: file.size,
            status: response.data.status,
            redaction_summary: response.data.redaction_summary,
          },
        ]);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  }, [sessionId, jobDescription]);

  const handleRemoveFile = useCallback(async (fileId) => {
    const file = uploadedFiles.find(f => f.id === fileId || f.resume_id === fileId);
    if (file && file.resume_id) {
      try {
        await axios.delete(`${API}/resumes/${file.resume_id}`);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId && f.resume_id !== fileId));
  }, [uploadedFiles]);

  const handleAnalyze = async () => {
    if (!isJDValid || !hasResumes) return;
    
    setIsAnalyzing(true);
    
    try {
      // Update session with job description if needed
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const formData = new FormData();
        formData.append('job_description', jobDescription);
        formData.append('job_title', extractJobTitle(jobDescription));
        
        const response = await axios.post(`${API}/sessions`, formData);
        currentSessionId = response.data.session_id;
        setSessionId(currentSessionId);
      }
      
      // Analyze the session
      await axios.post(`${API}/sessions/${currentSessionId}/analyze`);
      
      sessionStorage.setItem('currentSessionId', currentSessionId);
      if (uploadedFiles.length > 0) {
        sessionStorage.setItem('currentResumeId', uploadedFiles[0].resume_id);
      }
      
      // Navigate to results
      navigate(`/results/${currentSessionId}`);
    } catch (error) {
      console.error('Error analyzing:', error);
      setIsAnalyzing(false);
    }
  };

  const extractJobTitle = (text) => {
    const patterns = [
      /looking for (?:a |an )?([^.]+?)(?:\s+with|\s+who|\s*\.)/i,
      /hiring (?:a |an )?([^.]+?)(?:\s+with|\s+who|\s*\.)/i,
      /position:?\s*([^.\n]+)/i,
      /role:?\s*([^.\n]+)/i,
      /job title:?\s*([^.\n]+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return 'Position';
  };

  const sampleJDs = [
    `We are looking for a Senior Product Designer with 5+ years of experience in SaaS. You will be responsible for leading design initiatives, mentoring junior designers, and collaborating with Product Managers.

Required Skills:
- Proficiency in Figma and Prototyping
- Experience with Design Systems
- Strong understanding of user research and usability testing
- Ability to work in Agile environments
- Excellent communication and leadership skills

Nice to Have:
- Experience with motion design
- Knowledge of front-end development (HTML, CSS, JavaScript)
- Previous experience in B2B SaaS products`,

    `We are hiring a Full Stack Developer to join our growing engineering team. The ideal candidate has 3+ years of experience building scalable web applications.

Required Skills:
- Strong proficiency in React.js and Node.js
- Experience with PostgreSQL or MongoDB
- Familiarity with RESTful APIs and GraphQL
- Understanding of CI/CD pipelines
- Version control with Git

Nice to Have:
- Experience with AWS or Google Cloud
- Knowledge of Docker and Kubernetes
- Background in TypeScript`,

    `Looking for a Senior Data Scientist to drive insights and build ML models for our analytics platform. You'll work closely with product and engineering teams.

Required Skills:
- 4+ years experience in data science or machine learning
- Proficiency in Python, pandas, and scikit-learn
- Experience with deep learning frameworks (TensorFlow, PyTorch)
- Strong SQL skills and experience with big data tools
- Ability to communicate findings to non-technical stakeholders

Nice to Have:
- Experience with NLP or computer vision
- Knowledge of MLOps and model deployment
- PhD in a quantitative field`,

    `We're seeking a DevOps Engineer to help scale our infrastructure and improve deployment processes. Join a team passionate about automation and reliability.

Required Skills:
- 3+ years experience in DevOps or SRE roles
- Strong knowledge of AWS services (EC2, S3, Lambda, EKS)
- Experience with Infrastructure as Code (Terraform, CloudFormation)
- Proficiency in scripting (Python, Bash)
- Understanding of monitoring tools (Prometheus, Grafana, DataDog)

Nice to Have:
- Kubernetes certification
- Experience with serverless architectures
- Background in security best practices`,

    `Hiring a UX Researcher to help us understand our users and inform product decisions. You'll conduct research studies and present actionable insights.

Required Skills:
- 3+ years of UX research experience
- Expertise in qualitative and quantitative research methods
- Experience with user interviews, surveys, and usability testing
- Proficiency with research tools (UserTesting, Maze, Dovetail)
- Strong presentation and storytelling skills

Nice to Have:
- Experience in B2B or enterprise software
- Background in psychology or human-computer interaction
- Knowledge of accessibility standards`
  ];

  const handleAutoFill = () => {
    const randomIndex = Math.floor(Math.random() * sampleJDs.length);
    setJobDescription(sampleJDs[randomIndex]);
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
      <div className="flex-1 flex flex-col h-full relative rounded-[2.5rem] bg-page-bg overflow-hidden border border-white/40 shadow-inner-light">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth rounded-[2.5rem]">
          {/* Header */}
          <header className="sticky top-0 z-40 flex items-center justify-between whitespace-nowrap px-6 py-4 md:px-10 lg:py-6 bg-page-bg/95 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <span className="hover:text-text-main cursor-pointer transition-colors">Kairo</span>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-text-main">Input & Upload</span>
            </div>
            <div></div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 sm:px-6 lg:px-12 py-4 md:py-6 max-w-7xl pb-32">
            {/* Hero Section */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-3xl">
                <h1 className="text-text-main text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-4" data-testid="page-title">
                  Screening Session
                </h1>
                <p className="text-text-muted text-lg md:text-xl font-medium leading-relaxed">
                  Paste the job description and upload candidate resumes to get AI-powered insights and ranking.
                </p>
              </div>
            </div>

            {/* Two Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Job Description Card */}
              <div className="flex flex-col h-full">
                <div className="bg-card-bg rounded-3xl shadow-soft border border-white/60 p-1 flex flex-col h-full relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  
                  <div className="px-6 py-5 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl shadow-sm text-primary">
                        <span className="material-symbols-outlined text-2xl">description</span>
                      </div>
                      <h3 className="text-xl font-bold text-text-main">Job Description</h3>
                    </div>
                    <button
                      onClick={handleAutoFill}
                      className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-full transition-colors flex items-center gap-1.5"
                      data-testid="auto-fill-btn"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_paste</span>
                      Auto-fill
                    </button>
                  </div>

                  <div className="px-6 pb-6 flex-grow flex flex-col relative z-10">
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full h-80 lg:h-[400px] resize-none input-field text-base leading-relaxed p-6"
                      placeholder={`Paste job requirements, responsibilities, and qualifications here...
Example:
We are looking for a Senior Product Designer with 5+ years of experience in SaaS...`}
                      data-testid="job-description-input"
                    />
                    <div className="mt-4 flex justify-between items-center text-xs text-text-muted font-medium px-2">
                      <div className="flex items-center gap-1">
                        <span className={`size-1.5 rounded-full ${isJDValid ? 'bg-success' : 'bg-text-muted/50'}`}></span>
                        <span>Min. 100 characters</span>
                      </div>
                      <span className="bg-ui-element/50 px-2 py-1 rounded-md">
                        {jobDescription.length} chars
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resume Upload Card */}
              <div className="flex flex-col h-full">
                <div className="bg-card-bg rounded-3xl shadow-soft border border-white/60 p-1 flex flex-col h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  
                  <div className="px-6 py-5 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl shadow-sm text-yellow-600">
                        <span className="material-symbols-outlined text-2xl">folder_open</span>
                      </div>
                      <h3 className="text-xl font-bold text-text-main">Candidate Resumes</h3>
                    </div>
                    <span className="text-xs font-bold text-text-muted bg-ui-element/50 px-3 py-1.5 rounded-full">PDF only</span>
                  </div>

                  <div className="px-6 pb-6 flex flex-col gap-6 flex-grow relative z-10">
                    <FileUpload
                      files={uploadedFiles}
                      onFilesSelected={handleFilesSelected}
                      onRemoveFile={handleRemoveFile}
                    />

                    {uploadedFiles.some((f) => f.redaction_summary) && (
                      <ul className="text-xs text-text-muted space-y-1" data-testid="redaction-report">
                        {uploadedFiles.map((f) => (
                          <li key={f.id} className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-success text-sm">shield</span>
                            <span><span className="font-semibold text-text-main">{f.name}</span>: {f.redaction_summary}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <label className="flex items-start gap-3 bg-white/70 border border-black/5 rounded-2xl p-4 text-xs text-text-muted leading-relaxed cursor-pointer" data-testid="consent-box">
                      <input
                        type="checkbox"
                        checked={consented}
                        onChange={(e) => setConsented(e.target.checked)}
                        className="mt-0.5 size-4 accent-primary"
                        data-testid="consent-checkbox"
                      />
                      <span>
                        <span className="font-bold text-text-main">Your privacy. </span>
                        Your name, contact details, links, address, ID numbers and age/gender details are removed
                        on our server before anything is stored or analysed (best effort, so please check your file).
                        The redacted text is then sent to a third-party AI provider (Groq) to score and coach your
                        resume. Free AI tiers may retain inputs, so don't upload anything you wouldn't share.
                        You can delete your data at any time.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Bottom Action Bar */}
        <div className="absolute bottom-6 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
          <div className="bg-dark-accent/95 backdrop-blur-xl text-white rounded-full p-2 pl-6 pr-2 shadow-floating border border-white/10 flex items-center gap-6 pointer-events-auto max-w-2xl w-full mx-auto transform transition-all hover:scale-[1.01]">
            <div className="hidden sm:flex items-center gap-6 flex-1">
              <div className="flex items-center gap-2.5 text-sm font-medium text-white/80">
                <span className={`flex size-2 rounded-full ${isJDValid ? 'bg-success shadow-[0_0_8px_rgba(74,124,89,0.8)]' : 'bg-white/30'}`}></span>
                <span>Job Description {isJDValid ? 'valid' : 'required'}</span>
              </div>
              <span className="w-1 h-1 bg-white/20 rounded-full"></span>
              <div className="flex items-center gap-2.5 text-sm font-medium text-white/80">
                <span className={`flex size-2 rounded-full ${hasResumes ? 'bg-success shadow-[0_0_8px_rgba(74,124,89,0.8)]' : 'bg-white/30'}`}></span>
                <span>{uploadedFiles.length} Resume{uploadedFiles.length !== 1 ? 's' : ''} {hasResumes ? (consented ? 'ready' : 'ready · consent needed') : 'required'}</span>
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!isJDValid || !hasResumes || !consented || isAnalyzing}
              className={`font-bold text-base px-8 py-3.5 rounded-full shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ml-auto sm:ml-0 w-full sm:w-auto ${
                isJDValid && hasResumes && consented && !isAnalyzing
                  ? 'bg-white text-dark-accent hover:bg-primary hover:text-white'
                  : 'bg-white/20 text-white/50 cursor-not-allowed'
              }`}
              data-testid="analyze-btn"
            >
              {isAnalyzing ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  Analyzing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreeningSession;
