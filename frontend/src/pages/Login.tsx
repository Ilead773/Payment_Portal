import React, { useState } from 'react';
import { useAuthStore } from '../context/authStore';
import { apiRequest } from '../utils/api';
import { School, Mail, Lock, Loader2, Shield, UserCheck, Check, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen w-full flex bg-[#fafbfe] relative overflow-hidden font-sans">
      
      {/* LEFT SIDE PANEL: Hero Visual & Analytics Showcase (Desktop only) */}
      <div className="hidden lg:flex lg:w-[48%] bg-slate-950 relative overflow-hidden flex-col justify-between p-12 border-r border-slate-900">
        
        {/* Animated glowing mesh gradients */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-600/25 blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[130px] mix-blend-screen" />
        
        {/* Decorative Grid Overlays */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] -z-0" />
        
        {/* Branding header in the left panel */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-brand-500 p-2.5 rounded-xl text-white shadow-lg shadow-brand-500/20">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm leading-tight tracking-tight">iLead Payment Portal</h2>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Enterprise Suite v2.0</span>
          </div>
        </div>

        {/* Floating Mockup Showcase */}
        <div className="relative z-10 my-auto py-12 flex flex-col gap-6">
          <div className="max-w-md">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              LEDGER SYSTEMS
            </span>
            <h1 className="text-2xl font-bold text-white mt-4 tracking-tight leading-snug">
              Secure Ledger Tracking & Call Workspaces.
            </h1>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Track student payment plans, reconcile due statements, and run counselor calling CRM sheets in real-time.
            </p>
          </div>

          {/* Interactive Graphic Widgets */}
          <div className="relative w-full max-w-sm mt-4">
            
            {/* Ledger statistics card */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="dark-glass-card p-4 relative z-10 animate-float"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Payments Collected</p>
                  <p className="text-lg font-mono font-bold text-white mt-1">₹4,82,500 <span className="text-[9px] text-emerald-400 font-bold font-sans">94.2%</span></p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-400 h-full w-[94.2%]" />
              </div>
            </motion.div>

            {/* Counselor calls widget */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className="dark-glass-card p-4 mt-4 ml-8 relative z-25 border border-slate-700/50 bg-slate-900/60 shadow-xl shadow-slate-950/40 animate-float-delayed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Counselor Call Log</p>
                    <span className="text-[8px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.5 rounded">Active</span>
                  </div>
                  <p className="text-xxs text-slate-300 font-semibold mt-1">12 Call Schedules Pending</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Footer info in the left panel */}
        <div className="relative z-10 text-slate-500 text-[10px] font-medium tracking-wide">
          © {new Date().getFullYear()} iLead. All rights reserved. Cloud Ledger Hub.
        </div>
      </div>

      {/* RIGHT SIDE PANEL: Sign-in Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative">
        
        {/* Decorative Grid for Form panel */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(37,99,235,0.015)_1.2px,transparent_1.2px)] [background-size:24px_24px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 25 }}
          className="w-full max-w-[390px] flex flex-col"
        >
          {/* Logo with breathing effect (Only visible on mobile/tablets where left panel is hidden) */}
          <div className="lg:hidden flex items-center gap-3 mb-6 self-center">
            <div className="bg-brand-500 p-2 rounded-xl text-white">
              <School className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight font-display">iLead Portal</h1>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight font-display">
              Welcome back
            </h2>
            <p className="text-gray-400 text-xs mt-1 font-semibold">
              Please sign in to access your ledger workspace.
            </p>
          </div>

          {/* Sliding Error Notification */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className="p-3 mb-5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xxs font-bold flex items-center gap-2.5 shadow-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span className="flex-1 leading-normal">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
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
              className="w-full py-2.5 mt-2 rounded-lg bg-brand-500 hover:bg-brand-600 font-bold text-xs text-white shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </motion.button>
          </form>

          {/* Quick-Fill Demo Cards */}
          <div className="mt-8 pt-6 border-t border-gray-100 w-full">
            <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest text-center mb-4">
              Quick-Fill demo accounts
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

    </div>
  );
};

export default Login;
