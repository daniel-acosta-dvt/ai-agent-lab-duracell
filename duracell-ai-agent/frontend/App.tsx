import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Report from './components/Report';
import { Client } from './types';

export type AppView = 'submit' | 'report';

const SESSION_COOKIE = 'duracell_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const readSession = (): Client | null => {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find(c => c.startsWith(`${SESSION_COOKIE}=`));
  if (!entry) return null;
  try {
    return JSON.parse(decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1)));
  } catch {
    return null;
  }
};

const writeSession = (client: Client) => {
  const safe = {
    name: client.name,
    email: client.email,
    company: client.company,
    companyCode: client.companyCode,
  };
  const value = encodeURIComponent(JSON.stringify(safe));
  document.cookie = `${SESSION_COOKIE}=${value}; path=/; max-age=${SESSION_MAX_AGE}; samesite=strict`;
};

const clearSession = () => {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=strict`;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Client | null>(() => readSession());
  const [view, setView] = useState<AppView>('submit');

  const handleLogin = (client: Client) => {
    writeSession(client);
    setCurrentUser(client);
    setView('submit');
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setView('submit');
  };

  if (!currentUser) return <Login onLogin={handleLogin} />;
  if (view === 'report') {
    return <Report client={currentUser} onLogout={handleLogout} onNavigate={setView} />;
  }
  return <Dashboard client={currentUser} onLogout={handleLogout} onNavigate={setView} />;
};

export default App;
