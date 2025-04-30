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
    console.log('Token enviado:', token); // Añade este log
    console.log('URL de solicitud:', config.url);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Encabezado de autorización:', config.headers.Authorization);
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

// Funciones para gestión de firmas múltiples
export const signatures = {
  // Iniciar proceso de firmas múltiples
  startMultiSignatureProcess: (
    documentId: string,
    signerIds: string[],
    requiredSigners?: number,
  ) => {
    return api.post(`/api/signatures/${documentId}/multi-init`, {
      signerIds,
      requiredSigners,
    });
  },

  // Cancelar proceso de firmas múltiples
  cancelMultiSignatureProcess: (documentId: string) => {
    return api.post(`/api/signatures/${documentId}/multi-cancel`);
  },

  // Verificar todas las firmas
  verifyAllSignatures: (documentId: string) => {
    return api.post(`/api/signatures/${documentId}/verify-all`);
  },

  // Obtener estado de firmas
  getDocumentSignatureStatus: (documentId: string) => {
    return api.get(`/api/documents/${documentId}/signature-status`);
  },
};
