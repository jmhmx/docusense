import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import Button from './Button';
import Input from './Input';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated, isLoading, authMessage, setAuthMessage } =
    useAuth();
  const navigate = useNavigate();

  // Redireccionar si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Verificar si hay un mensaje de autenticación
  useEffect(() => {
    if (authMessage) {
      setError(authMessage);
      // Limpiar el mensaje después de mostrarlo
      if (setAuthMessage) {
        setAuthMessage(null);
      }
    }

    // También verificar si hay un mensaje en localStorage (para persistencia entre recargas)
    const savedMessage = localStorage.getItem('auth_message');
    if (savedMessage) {
      setError(savedMessage);
      localStorage.removeItem('auth_message');
    }
  }, [authMessage, setAuthMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Por favor ingrese email y contraseña');
      return;
    }

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Error al iniciar sesión');
      }
    } catch (err: any) {
      console.error('Error de inicio de sesión:', err);
      setError(err.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='w-full max-w-md p-8 bg-white rounded-lg shadow-md'>
        <div className='mb-8 text-center'>
          <h2 className='text-3xl font-extrabold text-gray-900'>
            Iniciar Sesión
          </h2>
          <p className='mt-2 text-sm text-gray-600'>
            Ingrese sus credenciales para acceder al sistema
          </p>
        </div>

        {error && (
          <div className='p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className='space-y-6'>
          <Input
            label='Email'
            id='email'
            name='email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />

          <Input
            label='Contraseña'
            id='password'
            name='password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />

          <div>
            <Button
              type='submit'
              variant='primary'
              fullWidth
              disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </div>
        </form>

        <div className='mt-6 text-center'>
          <p className='text-sm text-gray-600'>
            ¿No tiene una cuenta?{' '}
            <a
              href='/register'
              className='font-medium text-blue-600 hover:text-blue-500'>
              Registrarse
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
