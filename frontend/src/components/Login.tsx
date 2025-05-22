import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import Button from './Button';
import Input from './Input';

interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setErrors({ general: authMessage });
      if (setAuthMessage) {
        setAuthMessage(null);
      }
    }

    const savedMessage = localStorage.getItem('auth_message');
    if (savedMessage) {
      setErrors({ general: savedMessage });
      localStorage.removeItem('auth_message');
    }
  }, [authMessage, setAuthMessage]);

  // Validaciones en tiempo real
  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'El correo electrónico es requerido';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'El formato del correo electrónico no es válido';
    }

    if (email.length > 255) {
      return 'El correo electrónico es demasiado largo';
    }

    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return 'La contraseña es requerida';
    }

    if (password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }

    if (password.length > 128) {
      return 'La contraseña es demasiado larga';
    }

    return undefined;
  };

  const validateForm = (): boolean => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    const newErrors: LoginFormErrors = {};
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validación en tiempo real para email
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    if (errors.email) {
      const emailError = validateEmail(value);
      setErrors((prev) => ({ ...prev, email: emailError }));
    }
  };

  // Validación en tiempo real para password
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    if (errors.password) {
      const passwordError = validatePassword(value);
      setErrors((prev) => ({ ...prev, password: passwordError }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ general: undefined });

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (!result.success) {
        setErrors({ general: result.error || 'Error al iniciar sesión' });
      }
    } catch (err: any) {
      console.error('Error de inicio de sesión:', err);

      // Manejar diferentes tipos de errores
      if (err.response?.status === 401) {
        setErrors({
          general: 'Credenciales incorrectas. Verifique su email y contraseña.',
        });
      } else if (err.response?.status === 429) {
        setErrors({
          general:
            'Demasiados intentos de inicio de sesión. Intente más tarde.',
        });
      } else if (err.response?.status >= 500) {
        setErrors({ general: 'Error del servidor. Intente más tarde.' });
      } else {
        setErrors({ general: err.message || 'Error al iniciar sesión' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = !errors.email && !errors.password && email && password;

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

        {errors.general && (
          <div className='p-4 mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md'>
            <div className='flex items-center'>
              <svg
                className='w-5 h-5 mr-2 text-red-500'
                fill='currentColor'
                viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
              {errors.general}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className='space-y-6'
          noValidate>
          <Input
            label='Correo Electrónico'
            id='email'
            name='email'
            type='email'
            value={email}
            onChange={handleEmailChange}
            error={errors.email}
            required
            fullWidth
            autoComplete='email'
            placeholder='ejemplo@correo.com'
          />

          <Input
            label='Contraseña'
            id='password'
            name='password'
            type='password'
            value={password}
            onChange={handlePasswordChange}
            error={errors.password}
            required
            fullWidth
            autoComplete='current-password'
            placeholder='Ingrese su contraseña'
          />

          <div>
            <Button
              type='submit'
              variant='primary'
              fullWidth
              disabled={isLoading || isSubmitting || !isFormValid}>
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </div>
        </form>

        <div className='mt-6 text-center'>
          <p className='text-sm text-gray-600'>
            ¿No tiene una cuenta?{' '}
            <a
              href='/register'
              className='font-medium text-blue-600 transition-colors hover:text-blue-500 focus:outline-none focus:underline'>
              Registrarse
            </a>
          </p>
        </div>

        <div className='mt-4 text-center'>
          <a
            href='#'
            className='text-sm text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus:underline'>
            ¿Olvidó su contraseña?
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
