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

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el error ya fue manejado por otro código, no hacer nada
    if (error.handled) {
      return Promise.reject(error);
    }

    // Obtener la ruta actual
    const currentPath = window.location.pathname;

    // Manejo de errores de autenticación (401)
    if (error.response && error.response.status === 401) {
      // Si el error indica que la contraseña ha cambiado
      if (error.response.data?.message?.includes('contraseña ha cambiado')) {
        // Guardar el mensaje para mostrar en la página de login
        localStorage.setItem(
          'auth_message',
          'Su contraseña ha sido cambiada. Por favor inicie sesión nuevamente.',
        );

        // Si hay una función de manejo de errores de autenticación disponible globalmente
        if (window.handleAuthError) {
          window.handleAuthError(error);
        } else {
          // Limpiar datos de usuario
          localStorage.removeItem('user');
          localStorage.removeItem('token');

          // No redirigir si estamos en la página de login o setup
          if (
            !currentPath.includes('/login') &&
            !currentPath.includes('/setup')
          ) {
            window.location.href = '/login';
          }
        }
      } else {
        // Otros errores 401 (sesión expirada, etc.)
        // No redirigir si estamos en la página de login o setup
        if (
          !currentPath.includes('/login') &&
          !currentPath.includes('/setup')
        ) {
          // Si es un error de autenticación común, guardar un mensaje genérico
          localStorage.setItem(
            'auth_message',
            'Su sesión ha expirado. Por favor inicie sesión nuevamente.',
          );
          window.location.href = '/login';
        }
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

// Declarar el tipo global para la función de manejo de errores
declare global {
  interface Window {
    handleAuthError?: (error: any) => void;
  }
}

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
