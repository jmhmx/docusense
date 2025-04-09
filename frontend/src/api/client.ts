// frontend/src/api/client.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejo de errores de autenticación (401)
    if (error.response && error.response.status === 401) {
      // Opcionalmente, puedes limpiar el token si ya no es válido
      localStorage.removeItem('token');

      // Redireccionar a login si no estamos ya en la página de login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Función útil para descargar archivos directamente
export const downloadFile = async (url: string, filename: string) => {
  try {
    const response = await api.get(url, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Limpiar URL
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
    }, 100);

    return true;
  } catch (error) {
    console.error('Error downloading file:', error);
    return false;
  }
};
