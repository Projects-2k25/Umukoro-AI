import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('umukoro_ai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('umukoro_ai_token');
      localStorage.removeItem('umukoro_ai_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

// Auth
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Jobs
export const jobsApi = {
  list: (params?: any) => api.get('/jobs', { params }),
  get: (id: string) => api.get(`/jobs/${id}`),
  create: (data: any) => api.post('/jobs', data),
  update: (id: string, data: any) => api.patch(`/jobs/${id}`, data),
  delete: (id: string) => api.delete(`/jobs/${id}`),
  stats: (id: string) => api.get(`/jobs/${id}/stats`),
};

// Applicants
export const applicantsApi = {
  list: (params?: any) => api.get('/applicants', { params }),
  get: (id: string) => api.get(`/applicants/${id}`),
  importProfiles: (jobId: string, profiles: any[]) =>
    api.post(`/applicants/import/${jobId}`, { profiles }),
  upload: (jobId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/applicants/upload/${jobId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: string) => api.delete(`/applicants/${id}`),
};

// Screenings
export const screeningsApi = {
  create: (data: any) => api.post('/screenings', data),
  list: (params?: any) => api.get('/screenings', { params }),
  get: (id: string) => api.get(`/screenings/${id}`),
  results: (id: string, limit?: number) =>
    api.get(`/screenings/${id}/results`, { params: { limit } }),
};

// Dashboard
export const dashboardApi = {
  overview: () => api.get('/dashboard/overview'),
};
