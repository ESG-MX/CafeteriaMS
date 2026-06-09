import axios from 'axios';

// En desarrollo usa VITE_API_URL (.env.development)
// En producción usa /api (mismo servidor Express)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// Adjunta el JWT en cada petición automáticamente
api.interceptors.request.use(config => {
  try {
    const session = JSON.parse(localStorage.getItem('cafeteria_ms_session') || '{}');
    if (session.token) {
      config.headers.Authorization = `Bearer ${session.token}`;
    }
  } catch {}
  return config;
});

// Si el token expira, cierra sesión automáticamente
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cafeteria_ms_session');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
