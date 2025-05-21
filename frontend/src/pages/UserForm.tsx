// frontend/src/pages/UserForm.tsx
// Eliminar importación no utilizada de api

import { useState, useEffect } from 'react';
import Button from '../components/Button';
import Input from '../components/Input';
import useAuth from '../hooks/UseAuth';

interface User {
  id?: string;
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  biometricAuthEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

interface UserFormProps {
  initialData: User | null;
  onSave: (
    userData: Partial<User>,
  ) => Promise<{ error?: string; success?: boolean }>;
  onCancel: () => void;
  isNew: boolean;
}

const UserForm = ({ initialData, onSave, onCancel, isNew }: UserFormProps) => {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  // Inicializar formulario con datos existentes si hay
  useEffect(() => {
    if (initialData) {
      // No incluimos la contraseña en la edición
      const { password, ...rest } = initialData;
      setFormData(rest);
    } else {
      // Resetear formulario para nuevo usuario
      setFormData({
        name: '',
        email: '',
        password: '',
        isAdmin: false,
      });
    }
  }, [initialData]);

  // Manejar cambios en los campos
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;

    // Manejar checkbox específicamente
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    // Limpiar error del campo cuando cambia
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (isNew && !formData.password?.trim()) {
      newErrors.password = 'La contraseña es obligatoria para nuevos usuarios';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Mostrar advertencia antes de cambiar contraseña
  const handleSubmitWithConfirmation = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Si se está cambiando la contraseña y no es un usuario nuevo, mostrar confirmación
    if (!isNew && formData.password && initialData?.id) {
      // Si es el usuario actual, mostrar advertencia específica
      if (initialData.id === currentUser?.id) {
        setConfirmMessage(
          'Estás cambiando tu propia contraseña. Necesitarás iniciar sesión nuevamente con la nueva contraseña. ¿Deseas continuar?',
        );
      } else {
        setConfirmMessage(
          `Estás cambiando la contraseña de ${initialData.name}. Esta acción obligará al usuario a iniciar sesión nuevamente. ¿Deseas continuar?`,
        );
      }
      setShowConfirmation(true);
    } else {
      // Si no se está cambiando contraseña o es un nuevo usuario, enviar directamente
      handleSubmit();
    }
  };

  // Enviar formulario
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmation(false);

    try {
      // Si no es un nuevo usuario y no cambió la contraseña, no la enviamos
      const dataToSend =
        !isNew && !formData.password
          ? { ...formData, password: undefined }
          : formData;

      // Si el usuario actual está cambiando su propia contraseña, almacenar una marca para hacer logout
      if (!isNew && formData.password && initialData?.id === currentUser?.id) {
        localStorage.setItem('password_changed', 'true');
      }

      const result = await onSave(dataToSend);

      if (result.error) {
        setErrors({ submit: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmitWithConfirmation}>
      {errors.submit && (
        <div className='p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md'>
          {errors.submit}
        </div>
      )}

      <div className='space-y-4'>
        <Input
          label='Nombre'
          id='name'
          name='name'
          value={formData.name || ''}
          onChange={handleChange}
          error={errors.name}
          required
          fullWidth
        />

        <Input
          label='Email'
          id='email'
          name='email'
          type='email'
          value={formData.email || ''}
          onChange={handleChange}
          error={errors.email}
          required
          fullWidth
        />

        <div className='relative'>
          <Input
            label={
              isNew
                ? 'Contraseña'
                : 'Contraseña (dejar en blanco para no cambiar)'
            }
            id='password'
            name='password'
            type={showPassword ? 'text' : 'password'}
            value={formData.password || ''}
            onChange={handleChange}
            error={errors.password}
            required={isNew}
            fullWidth
          />
          <button
            type='button'
            className='absolute inset-y-0 right-0 flex items-center pr-3 mt-6 text-sm text-gray-400 cursor-pointer hover:text-gray-500'
            onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-5 h-5'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z'
                  clipRule='evenodd'
                />
                <path d='M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z' />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-5 h-5'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path d='M10 12a2 2 0 100-4 2 2 0 000 4z' />
                <path
                  fillRule='evenodd'
                  d='M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z'
                  clipRule='evenodd'
                />
              </svg>
            )}
          </button>
        </div>

        <div className='flex items-center'>
          <input
            id='isAdmin'
            name='isAdmin'
            type='checkbox'
            checked={formData.isAdmin || false}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, isAdmin: e.target.checked }))
            }
            className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
          />
          <label
            htmlFor='isAdmin'
            className='block ml-2 text-sm text-gray-900'>
            Conceder privilegios de administrador
          </label>
        </div>

        {!isNew && (
          <div className='p-4 mt-2 border border-gray-200 rounded-md'>
            <h4 className='font-medium text-gray-700'>
              Información de autenticación
            </h4>
            <div className='flex flex-col mt-2 space-y-2'>
              <div className='flex items-center'>
                <svg
                  className='w-5 h-5 mr-2 text-gray-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                    clipRule='evenodd'
                  />
                </svg>
                <span className='text-sm text-gray-600'>
                  Autenticación de doble factor:{' '}
                  {formData.twoFactorEnabled ? (
                    <span className='font-medium text-green-600'>Activado</span>
                  ) : (
                    <span className='font-medium text-gray-500'>
                      Desactivado
                    </span>
                  )}
                </span>
              </div>

              <div className='flex items-center'>
                <svg
                  className='w-5 h-5 mr-2 text-gray-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z'
                    clipRule='evenodd'
                  />
                </svg>
                <span className='text-sm text-gray-600'>
                  Autenticación biométrica:{' '}
                  {formData.biometricAuthEnabled ? (
                    <span className='font-medium text-green-600'>Activado</span>
                  ) : (
                    <span className='font-medium text-gray-500'>
                      Desactivado
                    </span>
                  )}
                </span>
              </div>
            </div>
            <p className='mt-2 text-xs text-gray-500'>
              Estos ajustes solo pueden ser modificados por el usuario desde su
              perfil.
            </p>
          </div>
        )}
      </div>

      <div className='flex justify-end mt-6 space-x-3'>
        <Button
          type='button'
          variant='secondary'
          onClick={onCancel}
          disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type='submit'
          variant='primary'
          disabled={isSubmitting}>
          {isSubmitting ? (
            <span className='flex items-center'>
              <svg
                className='w-4 h-4 mr-2 animate-spin'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'>
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
              </svg>
              Guardando...
            </span>
          ) : (
            'Guardar'
          )}
        </Button>
      </div>

      {/* Modal de confirmación para cambio de contraseña */}
      {showConfirmation && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='max-w-md p-6 bg-white rounded-lg shadow-xl'>
            <h3 className='mb-4 text-lg font-medium text-gray-900'>
              Confirmar cambio de contraseña
            </h3>
            <p className='mb-6 text-sm text-gray-500'>{confirmMessage}</p>
            <div className='flex justify-end space-x-3'>
              <Button
                variant='secondary'
                onClick={() => setShowConfirmation(false)}>
                Cancelar
              </Button>
              <Button
                variant='primary'
                onClick={handleSubmit}>
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default UserForm;
