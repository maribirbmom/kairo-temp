import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import History from "./pages/History";
import ScreeningSession from "./pages/ScreeningSession";
import ScreeningResults from "./pages/ScreeningResults";
import CVCoach from "./pages/CVCoach";

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="bg-page-bg h-screen flex items-center justify-center text-text-muted">Loading…</div>
    );
  }
  if (!user) return <Login />;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScreeningSession />} />
        <Route path="/history" element={<History />} />
        <Route path="/results/:sessionId" element={<ScreeningResults />} />
        <Route path="/results/:sessionId/:resumeId" element={<ScreeningResults />} />
        <Route path="/coach/:sessionId/:resumeId" element={<CVCoach />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </div>
  );
}

export default App;
