import React, { useState } from 'react';
import { useAuthStore } from '../context/authStore';
import { useNavigationStore } from '../context/navigationStore';
import { 
  LogOut, User, School, BarChart3, Users, Upload, Layers, Settings, Phone, ChevronLeft, ChevronRight, Menu, X, Calendar, Activity, UserPlus, Mail, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { activeTab, setActiveTab } = useNavigationStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    setActiveTab('dashboard');
    logout();
  };

  // Grouped Navigation
  const adminNav = [
    {
      group: 'Analytics',
      items: [
        { id: 'dashboard', label: 'Overview', icon: BarChart3 },
        { id: 'reports', label: 'Executive Reports', icon: Activity },
      ]
    },
    {
      group: 'Operations',
      items: [
        { id: 'students', label: 'Student Directory', icon: Users },
        { id: 'imports', label: 'CSV Bulk Import', icon: Upload },
        { id: 'manual-bulk-add', label: 'Manual Bulk Add', icon: UserPlus },
        { id: 'bulk-email', label: 'Email Blast', icon: Mail },
        { id: 'bulk-counselor-assign', label: 'Bulk Counselor Assign', icon: UserCheck },
      ]
    },
    {
      group: 'Management',
      items: [
        { id: 'schools', label: 'Schools & Courses', icon: Layers },
        { id: 'users', label: 'Staff Directory', icon: Settings },
      ]
    }
  ];

  const counselorNav = [
    {
      group: 'Analytics',
      items: [
        { id: 'dashboard', label: 'Overview', icon: BarChart3 },
        { id: 'performance', label: 'My Performance', icon: Activity },
      ]
    },
    {
      group: 'CRM Workspace',
      items: [
        { id: 'crm', label: 'Calling CRM', icon: Phone },
        { id: 'schedule', label: 'Call Schedule', icon: Calendar },
      ]
    },
    {
      group: 'Reference',
      items: [
        { id: 'students', label: 'Student Directory', icon: Users },
      ]
    }
  ];

  const navigationGroups = user?.role === 'ADMIN' ? adminNav : counselorNav;

  const SidebarContent = ({ isMobile = false }) => (
    <>
      <div className="space-y-6">
        {/* Logo / Header */}
        <div className="flex items-center justify-between px-1.5 overflow-hidden">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand-500 p-2 rounded-lg text-white shadow-xs shrink-0">
              <School className="w-4 h-4" />
            </div>
            {(!collapsed || isMobile) && (
              <div className="overflow-hidden whitespace-nowrap text-left">
                <h1 className="font-semibold text-sm leading-tight text-gray-900 tracking-tight font-display">
                  iLead Payment Portal
                </h1>
                <span className="text-[8px] text-gray-400 font-bold tracking-wider uppercase block mt-0.5">
                  {user?.role === 'ADMIN' ? 'Admin Workspace' : 'Counselor Portal'}
                </span>
              </div>
            )}
          </div>
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-450 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Grouped Links */}
        <div className="space-y-4">
          {navigationGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {(!collapsed || isMobile) && (
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2.5 mb-1.5 text-left">
                  {group.group}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (isMobile) setMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer relative ${
                        isActive 
                          ? 'text-brand-600 font-semibold' 
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/70'
                      }`}
                    >
                      {/* Sliding background pill */}
                      {isActive && (
                        <motion.div
                          layoutId={isMobile ? "mobile-sidebar-active" : "sidebar-active-pill"}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          className="absolute inset-0 bg-brand-50/50 border border-brand-100/50 rounded-lg -z-10"
                        />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-500' : 'text-gray-400'}`} />
                      {(!collapsed || isMobile) && (
                        <span className="whitespace-nowrap">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile Card & Logout */}
      <div className="space-y-3 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 px-1.5 py-1 rounded-lg bg-gray-50 border border-gray-150 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-brand-600" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="overflow-hidden whitespace-nowrap text-left">
              <p className="font-semibold text-xxs truncate text-gray-800 leading-tight">{user?.name}</p>
              <p className="text-[8px] text-gray-400 truncate font-semibold leading-tight mt-0.5">{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-550 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition-all cursor-pointer shadow-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-gray-800 bg-[#f8f9fa] font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200 z-30">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-500 p-2 rounded-lg text-white shadow-xs">
            <School className="w-4 h-4" />
          </div>
          <h1 className="font-semibold text-sm leading-tight text-gray-900 tracking-tight font-display">
            iLead Payment Portal
          </h1>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Overlay Sidebar Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 35 }}
              className="w-64 bg-white h-full p-5 flex flex-col justify-between relative shadow-2xl z-10 border-r border-gray-200"
            >
              <SidebarContent isMobile={true} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Floating Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? '72px' : '240px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col justify-between m-4 mr-0 p-4 floating-sidebar bg-white relative shrink-0 z-40"
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center cursor-pointer shadow-xs z-50 text-gray-450 hover:text-gray-800"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <SidebarContent isMobile={false} />
      </motion.aside>

      {/* Main Panel Viewport */}
      <main className="flex-1 overflow-x-hidden p-4 md:p-8 flex flex-col min-h-screen">
        <div className="flex-1 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
export default DashboardLayout;
