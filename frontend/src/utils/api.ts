import { useAuthStore } from '../context/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface RequestOptions extends RequestInit {
  bodyData?: any;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {};

  // Copy existing headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([k, v]) => {
      headers[k] = v;
    });
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.bodyData) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.bodyData);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let errMsg = 'An error occurred';
    try {
      const data = await response.json();
      errMsg = data.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return response.text() as any;
  }

  if (response.status === 204) {
    return null as any;
  }

  return response.json();
}
export default apiRequest;
