import { useEffect, useState } from 'react';
import { clearSession, loadSession, saveSession, setUnauthorizedHandler } from './api';
import type { Session } from './api';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';

export default function App() {
  // Start from a saved session, so a page refresh keeps you logged in
  const [session, setSession] = useState<Session | null>(loadSession);

  // If the API ever says the token is invalid or expired, go back to the login screen
  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
  }, []);

  function handleLogin(next: Session) {
    saveSession(next);
    setSession(next);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return session ? (
    <Dashboard session={session} onLogout={handleLogout} />
  ) : (
    <AuthForm onLogin={handleLogin} />
  );
}
