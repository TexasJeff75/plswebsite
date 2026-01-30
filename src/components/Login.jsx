import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { signInWithMicrosoft, signInWithPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  console.log('Login component rendering');

  const handleMicrosoftSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await signInWithMicrosoft();

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const { error } = await signInWithPassword(email, password);

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Deployment Tracker
            </h1>
            <p className="text-slate-400">
              Sign in to access the facility deployment management system
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!showEmailLogin ? (
            <>
              <button
                onClick={handleMicrosoftSignIn}
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-600 text-slate-900 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 group"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                    </svg>
                    <span>Sign in with Microsoft</span>
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center">
                <div className="border-t border-slate-700 flex-1"></div>
                <span className="px-4 text-slate-500 text-sm">or</span>
                <div className="border-t border-slate-700 flex-1"></div>
              </div>

              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Sign in with Email
              </button>

              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-slate-400 text-sm text-center">
                  Use your Microsoft 365 or Azure AD credentials to sign in.
                </p>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="your.email@proximitylabservices.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-600 text-slate-900 font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <button
                onClick={() => setShowEmailLogin(false)}
                className="w-full mt-4 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Back to Microsoft Sign In
              </button>
            </>
          )}

          <div className="mt-6 p-4 bg-slate-900/50 rounded-lg">
            <h3 className="text-white font-semibold text-sm mb-2">System Features:</h3>
            <ul className="space-y-1 text-slate-400 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-teal-500">•</span> Facility deployment tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="text-teal-500">•</span> Milestone management
              </li>
              <li className="flex items-center gap-2">
                <span className="text-teal-500">•</span> Equipment monitoring
              </li>
              <li className="flex items-center gap-2">
                <span className="text-teal-500">•</span> Team collaboration tools
              </li>
            </ul>
          </div>
        </div>

        <p className="text-slate-500 text-xs text-center mt-6">
          Protected by enterprise-grade security and authentication
        </p>
      </div>
    </div>
  );
}
