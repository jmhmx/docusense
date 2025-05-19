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
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithBiometrics: (
    userId: string,
    biometricData: string,
    additionalData?: Record<string, any>,
  ) => Promise<void>;
  setupBiometrics: () => Promise<void>;
  hasBiometrics: boolean;
  isBiometricsVerifying: boolean;
  updateUserBiometrics: (status: boolean) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  loginWithBiometrics: async () => {},
  setupBiometrics: async () => {},
  hasBiometrics: false,
  isBiometricsVerifying: false,
  updateUserBiometrics: async () => {},
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

  useEffect(() => {
    // Verificar la autenticación actual al cargar el componente
    const checkAuthStatus = async () => {
      try {
        // Verificar la URL actual
        const isSetupRoute = window.location.pathname.includes('/setup');

        // Si estamos en la ruta /setup, no intentamos verificar el perfil
        if (isSetupRoute) {
          setIsLoading(false);
          return;
        }

        // Para otras rutas, intentar obtener el perfil
        const response = await api.get('/api/auth/profile');
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch (error) {
        // Si falla, el usuario no está autenticado
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', { email, password });

      // La cookie se establece automáticamente en el navegador
      // Solo necesitamos guardar los datos del usuario
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
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
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('user');
      setUser(null);
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
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
