import React, { useState } from 'react';
import { useAuthStore } from '../context/authStore';
import { apiRequest } from '../utils/api';
import { School, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loginStore = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        bodyData: { email, password },
      });
      loginStore(res.accessToken, res.user);
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/20 font-sans p-4 relative overflow-hidden">
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 shadow-xl shadow-slate-200/30 flex flex-col relative z-10"
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-brand-500 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/25 mb-4">
            <School className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            iLead Payment Portal
          </h2>
          <p className="text-slate-500 text-xs mt-1.5 font-medium max-w-[280px]">
            Access student ledger management and counselor workspaces
          </p>
        </div>

        {/* Sliding Error Notification */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3.5 mb-5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2.5 shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="leading-tight">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10.5 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-150 focus:ring-4 focus:ring-brand-500/10"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10.5 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-150 focus:ring-4 focus:ring-brand-500/10"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 mt-2 rounded-xl bg-brand-500 hover:bg-brand-600 font-bold text-sm text-white shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
