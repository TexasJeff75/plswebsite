import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
  const { signInWithMicrosoft } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithMicrosoft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-teal-400/10 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-teal-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Deployment Tracker</h1>
            <p className="text-slate-400 text-center">
              Healthcare facility deployment management system
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-teal-400 hover:bg-teal-500 text-slate-950 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              'Signing in...'
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
                  <path d="M0 0h10.7v10.7H0V0zm12.3 0H23v10.7H12.3V0zM0 12.3h10.7V23H0V12.3zm12.3 0H23V23H12.3V12.3z" />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            Use your Microsoft 365 credentials to access the dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
