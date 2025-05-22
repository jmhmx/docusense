import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import Button from './Button';
import Input from './Input';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const Register = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redireccionar si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Validaciones
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'El nombre es requerido';
    }

    if (name.trim().length < 2) {
      return 'El nombre debe tener al menos 2 caracteres';
    }

    if (name.length > 100) {
      return 'El nombre es demasiado largo (máximo 100 caracteres)';
    }

    // Validar caracteres permitidos (letras, espacios, acentos, números)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9]+$/;
    if (!nameRegex.test(name)) {
      return 'El nombre solo puede contener letras, números y espacios';
    }

    return undefined;
  };

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
      return 'La contraseña es demasiado larga (máximo 128 caracteres)';
    }

    // Validación de seguridad básica
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase) {
      return 'La contraseña debe contener al menos una letra mayúscula';
    }

    if (!hasLowerCase) {
      return 'La contraseña debe contener al menos una letra minúscula';
    }

    if (!hasNumbers) {
      return 'La contraseña debe contener al menos un número';
    }

    if (!hasSpecialChar) {
      return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)';
    }

    return undefined;
  };

  const validateConfirmPassword = (
    password: string,
    confirmPassword: string,
  ): string | undefined => {
    if (!confirmPassword) {
      return 'Debe confirmar la contraseña';
    }

    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden';
    }

    return undefined;
  };

  const validateForm = (): boolean => {
    const nameError = validateName(formData.name);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(
      formData.password,
      formData.confirmPassword,
    );

    const newErrors: RegisterFormErrors = {};
    if (nameError) newErrors.name = nameError;
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejo de cambios en tiempo real
  const handleChange =
    (field: keyof RegisterFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Validación en tiempo real solo si ya hay un error
      if (errors[field]) {
        let fieldError: string | undefined;
        switch (field) {
          case 'name':
            fieldError = validateName(value);
            break;
          case 'email':
            fieldError = validateEmail(value);
            break;
          case 'password':
            fieldError = validatePassword(value);
            // También revalidar confirmPassword si existe
            if (formData.confirmPassword) {
              const confirmError = validateConfirmPassword(
                value,
                formData.confirmPassword,
              );
              setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
            }
            break;
          case 'confirmPassword':
            fieldError = validateConfirmPassword(formData.password, value);
            break;
        }
        setErrors((prev) => ({ ...prev, [field]: fieldError }));
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
      await register(
        formData.name.trim(),
        formData.email.trim().toLowerCase(),
        formData.password,
      );
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error de registro:', err);

      // Manejar diferentes tipos de errores del backend
      if (
        err.response?.status === 409 ||
        err.response?.data?.message?.includes('ya está en uso')
      ) {
        setErrors({ email: 'Este correo electrónico ya está registrado' });
      } else if (err.response?.status === 422) {
        // Errores de validación del backend
        const backendErrors = err.response?.data?.errors || [];
        const newErrors: RegisterFormErrors = {};

        backendErrors.forEach((error: any) => {
          if (error.field === 'name') newErrors.name = error.message;
          if (error.field === 'email') newErrors.email = error.message;
          if (error.field === 'password') newErrors.password = error.message;
        });

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
        } else {
          setErrors({
            general: 'Error de validación. Verifique los datos ingresados.',
          });
        }
      } else if (err.response?.status === 429) {
        setErrors({
          general: 'Demasiados intentos de registro. Intente más tarde.',
        });
      } else if (err.response?.status >= 500) {
        setErrors({ general: 'Error del servidor. Intente más tarde.' });
      } else {
        setErrors({
          general: err.message || 'Error en el registro. Inténtalo de nuevo.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = (
    password: string,
  ): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: '', color: '' };

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score <= 2)
      return {
        strength: score * 16.67,
        label: 'Muy débil',
        color: 'bg-red-500',
      };
    if (score <= 3)
      return {
        strength: score * 16.67,
        label: 'Débil',
        color: 'bg-orange-500',
      };
    if (score <= 4)
      return {
        strength: score * 16.67,
        label: 'Regular',
        color: 'bg-yellow-500',
      };
    if (score <= 5)
      return {
        strength: score * 16.67,
        label: 'Fuerte',
        color: 'bg-green-500',
      };
    return { strength: 100, label: 'Muy fuerte', color: 'bg-green-600' };
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const isFormValid =
    !Object.values(errors).some((error) => error) &&
    formData.name &&
    formData.email &&
    formData.password &&
    formData.confirmPassword;

  return (
    <div className='flex items-center justify-center min-h-screen px-4 py-12 bg-gray-100 sm:px-6 lg:px-8'>
      <div className='w-full max-w-md p-10 space-y-8 bg-white shadow-lg rounded-xl'>
        <div>
          <h2 className='mt-6 text-3xl font-extrabold text-center text-gray-900'>
            Crear cuenta nueva
          </h2>
          <p className='mt-2 text-sm text-center text-gray-600'>
            Complete el formulario para registrarse en el sistema
          </p>
        </div>

        {errors.general && (
          <div className='p-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md'>
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
          className='mt-8 space-y-6'
          onSubmit={handleSubmit}
          noValidate>
          <div className='space-y-4'>
            <Input
              label='Nombre completo'
              id='name'
              name='name'
              type='text'
              value={formData.name}
              onChange={handleChange('name')}
              error={errors.name}
              required
              fullWidth
              autoComplete='name'
              placeholder='Juan Pérez'
            />

            <Input
              label='Correo electrónico'
              id='email'
              name='email'
              type='email'
              value={formData.email}
              onChange={handleChange('email')}
              error={errors.email}
              required
              fullWidth
              autoComplete='email'
              placeholder='ejemplo@correo.com'
            />

            <div>
              <Input
                label='Contraseña'
                id='password'
                name='password'
                type='password'
                value={formData.password}
                onChange={handleChange('password')}
                onFocus={() => setShowPasswordRequirements(true)}
                error={errors.password}
                required
                fullWidth
                autoComplete='new-password'
                placeholder='Ingrese una contraseña segura'
              />

              {formData.password && (
                <div className='mt-2'>
                  <div className='flex justify-between mb-1'>
                    <span className='text-xs text-gray-600'>
                      Seguridad de la contraseña:
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        passwordStrength.strength <= 33
                          ? 'text-red-600'
                          : passwordStrength.strength <= 66
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className='w-full h-2 bg-gray-200 rounded-full'>
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.strength}%` }}></div>
                  </div>
                </div>
              )}

              {showPasswordRequirements && (
                <div className='p-3 mt-3 border border-blue-200 rounded-md bg-blue-50'>
                  <p className='mb-2 text-xs font-medium text-blue-800'>
                    Requisitos de contraseña:
                  </p>
                  <ul className='space-y-1 text-xs text-blue-700'>
                    <li
                      className={`flex items-center ${
                        formData.password.length >= 6 ? 'text-green-600' : ''
                      }`}>
                      <span className='mr-2'>
                        {formData.password.length >= 6 ? '✓' : '○'}
                      </span>
                      Al menos 6 caracteres
                    </li>
                    <li
                      className={`flex items-center ${
                        /[A-Z]/.test(formData.password) ? 'text-green-600' : ''
                      }`}>
                      <span className='mr-2'>
                        {/[A-Z]/.test(formData.password) ? '✓' : '○'}
                      </span>
                      Una letra mayúscula
                    </li>
                    <li
                      className={`flex items-center ${
                        /[a-z]/.test(formData.password) ? 'text-green-600' : ''
                      }`}>
                      <span className='mr-2'>
                        {/[a-z]/.test(formData.password) ? '✓' : '○'}
                      </span>
                      Una letra minúscula
                    </li>
                    <li
                      className={`flex items-center ${
                        /\d/.test(formData.password) ? 'text-green-600' : ''
                      }`}>
                      <span className='mr-2'>
                        {/\d/.test(formData.password) ? '✓' : '○'}
                      </span>
                      Un número
                    </li>
                    <li
                      className={`flex items-center ${
                        /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
                          ? 'text-green-600'
                          : ''
                      }`}>
                      <span className='mr-2'>
                        {/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
                          ? '✓'
                          : '○'}
                      </span>
                      Un carácter especial
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <Input
              label='Confirmar contraseña'
              id='confirmPassword'
              name='confirmPassword'
              type='password'
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={errors.confirmPassword}
              required
              fullWidth
              autoComplete='new-password'
              placeholder='Repita su contraseña'
            />
          </div>

          <div>
            <Button
              type='submit'
              variant='primary'
              fullWidth
              disabled={isSubmitting || !isFormValid}>
              {isSubmitting ? 'Registrando...' : 'Registrarse'}
            </Button>
          </div>
        </form>

        <div className='text-sm text-center text-gray-600'>
          ¿Ya tienes una cuenta?{' '}
          <Link
            to='/login'
            className='font-medium text-blue-600 transition-colors hover:text-blue-500 focus:outline-none focus:underline'>
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
