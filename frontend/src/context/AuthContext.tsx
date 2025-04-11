import { createContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithBiometrics: (userId: string, biometricData: string) => Promise<void>;
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
  updateUserBiometrics: async () => {}
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);
  const [isBiometricsVerifying, setIsBiometricsVerifying] = useState<boolean>(false);

  useEffect(() => {
    // Verificar si hay un token y cargar datos del usuario
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Error al cargar datos del usuario:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      
      setIsLoading(false);
    };
    
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await api.post('/api/auth/login', { email, password });
      console.log('Respuesta de login:', response.data);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await api.post('/api/auth/register', { name, email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  useEffect(() => {
    // Verificar si el usuario tiene biometría registrada
    const checkBiometrics = async () => {
      if (user) {
        try {
          const response = await api.get('/api/biometry/status');
          setHasBiometrics(response.data.registered);
          
          // Guardar en localStorage para acceso rápido
          localStorage.setItem('hasBiometrics', response.data.registered ? 'true' : 'false');
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

const loginWithBiometrics = async (userId: string, biometricData: string) => {
  setIsBiometricsVerifying(true);
  
  try {
    // Paso 1: Verificar biometría
    const bioResponse = await api.post('/api/biometry/verify', {
      userId,
      descriptorData: biometricData,
      livenessProof: {
        challenge: 'blink',
        timestamp: Date.now()
      }
    });
    
    if (!bioResponse.data.verified) {
      throw new Error('Verificación biométrica fallida');
    }
    
    // Paso 2: Obtener token de sesión
    const authResponse = await api.post('/api/auth/login/biometric', { userId });
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
  updateUserBiometrics
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;