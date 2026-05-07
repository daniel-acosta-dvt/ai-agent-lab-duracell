import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Client } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Client | null>(null);

  const handleLogin = (client: Client) => {
    setCurrentUser(client);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <>
      {!currentUser ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard client={currentUser} onLogout={handleLogout} />
      )}
    </>
  );
};

export default App;
