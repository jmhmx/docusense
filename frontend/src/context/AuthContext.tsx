import { createContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithBiometrics: (
    userId: string,
    biometricData: string,
    additionalData?: Record<string, any>,
  ) => Promise<void>;
  setupBiometrics: () => Promise<void>;
  hasBiometrics: boolean;
  isBiometricsVerifying: boolean;
  updateUserBiometrics: (status: boolean) => void;
  authMessage: string | null;
  setAuthMessage: (message: string | null) => void;
  handleAuthError: (error: any) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => {},
  logout: async () => {},
  loginWithBiometrics: async () => {},
  setupBiometrics: async () => {},
  hasBiometrics: false,
  isBiometricsVerifying: false,
  updateUserBiometrics: () => {},
  authMessage: null,
  setAuthMessage: () => {},
  handleAuthError: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);
  const [isBiometricsVerifying, setIsBiometricsVerifying] =
    useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    // Verificar la autenticación actual al cargar el componente
    const checkAuthStatus = async () => {
      try {
        // Verificar si hubo un cambio de contraseña que requiere logout
        const passwordChanged =
          localStorage.getItem('password_changed') === 'true';
        if (passwordChanged) {
          // Limpiar el marcador y hacer logout
          localStorage.removeItem('password_changed');
          localStorage.setItem(
            'auth_message',
            'Su contraseña ha sido cambiada. Por favor inicie sesión nuevamente.',
          );
          await logout();
          return;
        }

        // Verificar la URL actual
        const isSetupRoute = window.location.pathname.includes('/setup');
        const isLoginRoute = window.location.pathname.includes('/login');

        // Si estamos en la ruta /setup o /login, no intentamos verificar el perfil
        if (isSetupRoute || isLoginRoute) {
          setIsLoading(false);
          return;
        }

        // Para otras rutas, intentar obtener el perfil
        const response = await api.get('/api/auth/profile');
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch (error: any) {
        // Si la razón del error es un cambio de contraseña, mostrar mensaje
        if (error.response?.data?.message?.includes('contraseña ha cambiado')) {
          // Mostrar notificación al usuario
          setAuthMessage(
            'La contraseña ha sido cambiada. Por favor inicie sesión nuevamente.',
          );
          localStorage.setItem(
            'auth_message',
            'La contraseña ha sido cambiada. Por favor inicie sesión nuevamente.',
          );
        }

        // Si falla, el usuario no está autenticado
        localStorage.removeItem('user');
        setUser(null);

        // Verificamos la ruta actual para evitar redirecciones cíclicas
        const currentPath = window.location.pathname;
        const isSetupRoute = currentPath.includes('/setup');
        const isLoginRoute = currentPath.includes('/login');

        // Redirigir al login si no está en una ruta pública
        if (!isSetupRoute && !isLoginRoute) {
          window.location.href = '/login';
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();

    // Verificar si hay un mensaje de autenticación guardado
    const savedMessage = localStorage.getItem('auth_message');
    if (savedMessage) {
      setAuthMessage(savedMessage);
      // Limpiar después de mostrar
      setTimeout(() => {
        localStorage.removeItem('auth_message');
      }, 100);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setAuthMessage(null);

    try {
      const response = await api.post('/api/auth/login', { email, password });

      // La cookie se establece automáticamente en el navegador
      // Solo necesitamos guardar los datos del usuario
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Limpiar cualquier mensaje de autenticación previo
      localStorage.removeItem('auth_message');

      return { success: true };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Error al iniciar sesión';
      setAuthMessage(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/register', {
        name,
        email,
        password,
      });

      // La cookie se establece automáticamente en el navegador
      // Solo necesitamos guardar los datos del usuario
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      setIsLoading(false);

      // Redireccionar a la página de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  // Método para manejar errores de autenticación desde cualquier componente
  const handleAuthError = (error: any) => {
    if (error.response?.status === 401) {
      // Si el error indica cambio de contraseña
      if (error.response.data?.message?.includes('contraseña ha cambiado')) {
        localStorage.setItem(
          'auth_message',
          'La contraseña ha sido cambiada. Por favor inicie sesión nuevamente.',
        );
      } else {
        localStorage.setItem(
          'auth_message',
          'Su sesión ha expirado. Por favor inicie sesión nuevamente.',
        );
      }
      logout();
    }
  };

  useEffect(() => {
    // Verificar si el usuario tiene biometría registrada
    const checkBiometrics = async () => {
      if (user) {
        try {
          const response = await api.get('/api/biometry/status');
          setHasBiometrics(response.data.registered);

          // Guardar en localStorage para acceso rápido
          localStorage.setItem(
            'hasBiometrics',
            response.data.registered ? 'true' : 'false',
          );
        } catch (error) {
          console.error('Error verificando estado biométrico:', error);
          setHasBiometrics(false);
        }
      } else {
        setHasBiometrics(false);
        localStorage.removeItem('hasBiometrics');
      }
    };

    checkBiometrics();
  }, [user]);

  const loginWithBiometrics = async (
    userId: string,
    biometricData: string,
    additionalData?: Record<string, any>,
  ) => {
    setIsBiometricsVerifying(true);

    try {
      // Paso 1: Verificar biometría con datos adicionales
      const bioResponse = await api.post('/api/biometry/verify', {
        userId,
        descriptorData: biometricData,
        livenessProof: {
          challenge: additionalData?.challenge || 'blink',
          timestamp: additionalData?.timestamp || Date.now(),
          motionData: additionalData?.motionData,
          textureData: additionalData?.textureData,
          deviceInfo: additionalData?.deviceInfo,
        },
      });

      if (!bioResponse.data.verified) {
        throw new Error('Verificación biométrica fallida');
      }

      // Paso 2: Obtener token de sesión con score de confianza
      const authResponse = await api.post('/api/auth/login/biometric', {
        userId,
        verificationScore: bioResponse.data.score,
        verificationMethod: bioResponse.data.method,
        deviceInfo: additionalData?.deviceInfo,
      });

      const { token, user } = authResponse.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      console.error('Error en autenticación biométrica:', error);
      throw error;
    } finally {
      setIsBiometricsVerifying(false);
    }
  };

  const setupBiometrics = async () => {
    if (!user) throw new Error('Usuario no autenticado');

    // Redireccionar a página de registro biométrico
    window.location.href = '/biometric-registration';
  };

  const updateUserBiometrics = (status: boolean) => {
    setHasBiometrics(status);
    localStorage.setItem('hasBiometrics', status ? 'true' : 'false');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        loginWithBiometrics,
        setupBiometrics,
        hasBiometrics,
        isBiometricsVerifying,
        updateUserBiometrics,
        authMessage,
        setAuthMessage,
        handleAuthError,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
