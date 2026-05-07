import React, { useState } from 'react';
import { CLIENT_DATABASE, LOGO_URL } from '../constants';
import { Client } from '../types';
import { Mail, Lock, ArrowRight, AlertCircle, UserPlus, LogIn } from 'lucide-react';

interface LoginProps {
  onLogin: (client: Client) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignup) {
      // Mock signup logic
      const newClient: Client = {
        name,
        email,
        company,
        companyCode: Math.floor(100000 + Math.random() * 900000).toString(),
        password
      };
      CLIENT_DATABASE.push(newClient);
      onLogin(newClient);
      return;
    }

    const foundClient = CLIENT_DATABASE.find(
      (c) => c.email.toLowerCase() === email.toLowerCase().trim()
    );

    if (foundClient) {
      if (foundClient.password === password) {
        onLogin(foundClient);
      } else {
        setError('Incorrect password. Please try again.');
      }
    } else {
      setError('Email not found. Please create an account.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-duracell-black p-4">
      <div className="mb-12">
        {/* White logo using CSS filter */}
        <img 
          src={LOGO_URL} 
          alt="Duracell" 
          className="h-20 object-contain" 
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      </div>
      
      <div className="max-w-md w-full bg-duracell-white rounded-lg shadow-2xl overflow-hidden border border-duracell-darkGray">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-center text-duracell-black mb-2">
            {isSignup ? 'Create Account' : 'Price Updater Portal'}
          </h2>
          <p className="text-center text-duracell-darkGray text-sm mb-8">
            {isSignup ? 'Join the Duracell supplier network.' : 'Please sign in with your credentials to continue.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-duracell-darkGray mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 rounded border border-duracell-mediumGray focus:ring-2 focus:ring-duracell-copper focus:border-duracell-copper transition-colors text-duracell-black"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-duracell-darkGray mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-2 rounded border border-duracell-mediumGray focus:ring-2 focus:ring-duracell-copper focus:border-duracell-copper transition-colors text-duracell-black"
                    placeholder="Supplier Inc."
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-semibold text-duracell-darkGray mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-duracell-mediumGray" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-duracell-mediumGray focus:ring-2 focus:ring-duracell-copper focus:border-duracell-copper transition-colors text-duracell-black"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-duracell-darkGray mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-duracell-mediumGray" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-duracell-mediumGray focus:ring-2 focus:ring-duracell-copper focus:border-duracell-copper transition-colors text-duracell-black"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center text-duracell-error text-xs bg-red-50 p-3 rounded border border-red-200">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded shadow-sm text-duracell-white bg-duracell-copper hover:bg-[#904B0B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-duracell-copper transition-colors font-bold text-[15px]"
            >
              {isSignup ? 'Create Account' : 'Sign In'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              className="inline-flex items-center text-sm text-duracell-copper hover:text-[#904B0B] font-semibold transition-colors"
            >
              {isSignup ? (
                <>
                  <LogIn className="w-4 h-4 mr-1.5" />
                  Already have an account? Sign in
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Need an account? Create one
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
