import React from 'react';
import { useAuthStore } from './context/authStore';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { CounselorDashboard } from './pages/CounselorDashboard';
import { DashboardLayout } from './layouts/DashboardLayout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return (
      <QueryClientProvider client={queryClient}>
        <Login />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        {user.role === 'ADMIN' ? (
          <AdminDashboard />
        ) : (
          <CounselorDashboard />
        )}
      </DashboardLayout>
    </QueryClientProvider>
  );
};
export default App;
