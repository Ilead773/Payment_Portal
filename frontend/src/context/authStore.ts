import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COUNSELOR';
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Read initial state from localStorage
  const savedToken = localStorage.getItem('erp_token');
  const savedUserStr = localStorage.getItem('erp_user');
  let savedUser: User | null = null;
  try {
    if (savedUserStr) savedUser = JSON.parse(savedUserStr);
  } catch (_) {}

  return {
    token: savedToken,
    user: savedUser,
    isAuthenticated: !!savedToken && !!savedUser,
    login: (token, user) => {
      localStorage.setItem('erp_token', token);
      localStorage.setItem('erp_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});
