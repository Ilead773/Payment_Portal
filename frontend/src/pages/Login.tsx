import React, { useState } from 'react';
import { useAuthStore } from '../context/authStore';
import { apiRequest } from '../utils/api';
import { School, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loginStore = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
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
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8f9fa] relative overflow-hidden font-sans">
      {/* Editorial geometric grid details */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(15,23,42,0.02)_1.2px,transparent_1.2px)] [background-size:24px_24px] -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 25 }}
        className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-8 shadow-xs flex flex-col items-center"
      >
        {/* App Logo */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-brand-500 p-2.5 rounded-lg text-white shadow-xs mb-4 cursor-pointer"
        >
          <School className="w-5 h-5" />
        </motion.div>

        <h2 className="text-base font-bold text-gray-900 tracking-tight font-display">
          Sign in to iLead Payment Portal
        </h2>
        <p className="text-gray-400 text-[10px] mt-1 mb-8 text-center font-bold uppercase tracking-wider">
          Student Ledger & Counselor Workspace
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full p-2.5 mb-4 rounded-lg bg-red-50 border border-red-100 text-red-650 text-xxs font-semibold"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-0.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="email"
                placeholder="admin@erp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 premium-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-0.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 premium-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full py-2 mt-4 rounded-lg bg-brand-500 hover:bg-brand-600 font-bold text-xs text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </motion.button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-8 pt-5 border-t border-gray-100 w-full text-center space-y-1.5">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Demo Credentials</p>
          <div className="space-y-0.5 text-xxs text-gray-500 font-medium">
            <p>Admin: <span className="text-gray-700 font-bold">admin@erp.com</span> / <span className="text-gray-700 font-bold">admin123</span></p>
            <p>Counselor: <span className="text-gray-700 font-bold">counselor@erp.com</span> / <span className="text-gray-700 font-bold font-mono">counselor123</span></p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
export default Login;
