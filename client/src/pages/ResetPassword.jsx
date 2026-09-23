import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            Set a new password
          </h1>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl shadow-black/40">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-lg mb-5 text-sm">
              {error}
            </div>
          )}
          {success ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-lg text-sm text-center">
              Password reset! Redirecting to login…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1.5 font-medium">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 text-white border border-white/10 focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:brightness-110 hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98] text-white py-2.5 rounded-lg font-medium disabled:opacity-50 transition-all duration-200"
              >
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}
          <p className="text-slate-400 text-sm mt-6 text-center">
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;