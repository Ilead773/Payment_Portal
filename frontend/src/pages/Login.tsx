import React, { useState } from 'react';
import { useAuthStore } from '../context/authStore';
import { apiRequest } from '../utils/api';
import { School, Mail, Lock, Loader2, Shield, UserCheck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<'admin' | 'counselor' | null>(null);
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

  const handleQuickFill = (role: 'admin' | 'counselor') => {
    setError(null);
    setSelectedDemoRole(role);
    if (role === 'admin') {
      setEmail('admin@erp.com');
      setPassword('admin123');
    } else {
      setEmail('counselor@erp.com');
      setPassword('counselor123');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] font-sans p-4">
      

      {/* Main Centered Sign-in Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 25 }}
        className="w-full max-w-md bg-white border border-gray-200/80 rounded-2xl p-8 sm:p-10 shadow-xl shadow-slate-100/50 flex flex-col relative z-10"
      >
        
        {/* School Logo Indicator */}
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-brand-500 p-3 rounded-2xl text-white shadow-lg shadow-brand-500/20 mb-4"
          >
            <School className="w-6 h-6" />
          </motion.div>
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight font-display">
            iLead Payment Portal
          </h2>
          <p className="text-gray-400 text-xxs mt-1 font-bold uppercase tracking-widest">
            Student Ledger & Counselor Workspace
          </p>
        </div>

        {/* Sliding Error Notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="p-3 mb-5 rounded-xl bg-rose-50 border border-rose-100 text-rose-605 text-xxs font-bold flex items-center gap-2.5 shadow-xs"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="flex-1 leading-normal">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4.5">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-[11px] w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedDemoRole(null);
                }}
                className="w-full pl-10.5 glass-input text-xs"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-[11px] w-4 h-4 text-gray-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSelectedDemoRole(null);
                }}
                className="w-full pl-10.5 glass-input text-xs"
                disabled={isLoading}
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 mt-2 rounded-xl bg-brand-500 hover:bg-brand-600 font-bold text-xs text-white shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Quick-Fill Demo Credentials Selector */}
        <div className="mt-8 pt-6 border-t border-gray-100 w-full">
          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest text-center mb-4">
            Quick-Fill Demo Credentials
          </p>
          <div className="grid grid-cols-2 gap-3.5">
            
            {/* Admin Selector */}
            <button
              type="button"
              onClick={() => handleQuickFill('admin')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[85px] relative ${
                selectedDemoRole === 'admin'
                  ? 'border-brand-500 bg-brand-50/40 shadow-xs shadow-brand-500/5'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`p-1.5 rounded-lg ${selectedDemoRole === 'admin' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Shield className="w-3.5 h-3.5" />
                </div>
                {selectedDemoRole === 'admin' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center"
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </motion.div>
                )}
              </div>
              <div>
                <p className="text-xxs font-extrabold text-gray-800">Admin</p>
                <p className="text-[8px] text-gray-450 mt-0.5 truncate font-medium">admin@erp.com</p>
              </div>
            </button>

            {/* Counselor Selector */}
            <button
              type="button"
              onClick={() => handleQuickFill('counselor')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[85px] relative ${
                selectedDemoRole === 'counselor'
                  ? 'border-brand-500 bg-brand-50/40 shadow-xs shadow-brand-500/5'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`p-1.5 rounded-lg ${selectedDemoRole === 'counselor' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                {selectedDemoRole === 'counselor' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center"
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </motion.div>
                )}
              </div>
              <div>
                <p className="text-xxs font-extrabold text-gray-800">Counselor</p>
                <p className="text-[8px] text-gray-450 mt-0.5 truncate font-medium">counselor@erp.com</p>
              </div>
            </button>

          </div>
        </div>

      </motion.div>

    </div>
  );
};

export default Login;
