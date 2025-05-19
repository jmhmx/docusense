// frontend/src/api/client.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  // Importante: enviar cookies con las solicitudes
  withCredentials: true,
});

// Añade un interceptor para depuración
api.interceptors.request.use(
  (config) => {
    // Si hay un token en localStorage, enviarlo como header
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
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
    // Si el error ya fue manejado por otro código, no hacer nada
    if (error.handled) {
      return Promise.reject(error);
    }
    // Manejo de errores de autenticación (401)
    if (error.response && error.response.status === 401) {
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
  // Nuevo método para firma autógrafa
  signDocumentWithAutografa: (
    documentId: string,
    firmaAutografaSvg: string,
    position?: {
      page: number;
      x: number;
      y: number;
      width?: number;
      height?: number;
    },
    reason?: string,
  ) => {
    return api.post(`/api/signatures/${documentId}/autografa`, {
      firmaAutografaSvg,
      position,
      reason,
    });
  },

  // Método para verificar firma autógrafa
  verifyAutografaSignature: (signatureId: string) => {
    return api.get(`/api/signatures/${signatureId}/verify-autografa`);
  },

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

// Nuevo módulo para verificación 2FA
export const twoFactor = {
  // Generar código de verificación
  generateVerificationCode: (action: string = 'firma') => {
    return api.post('/api/auth/2fa/generate', { action });
  },

  // Verificar código
  verifyCode: (code: string, action: string = 'firma') => {
    return api.post('/api/auth/2fa/verify', {
      code,
      action,
    });
  },
};
