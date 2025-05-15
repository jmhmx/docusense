import React from 'react';

const UserFormModal = ({
  isOpen,
  onClose,
  user = null,
  formData,
  onChange,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const isEditMode = !!user;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='w-full max-w-md p-6 bg-white rounded-lg shadow-xl'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-xl font-semibold text-gray-900'>
            {isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-500'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-6 h-6'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700'>
              Nombre
            </label>
            <input
              type='text'
              name='name'
              value={formData.name}
              onChange={onChange}
              className='block w-full p-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='Nombre completo'
              required
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700'>
              Email
            </label>
            <input
              type='email'
              name='email'
              value={formData.email}
              onChange={onChange}
              className='block w-full p-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='correo@ejemplo.com'
              required
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700'>
              {isEditMode
                ? 'Contraseña (dejar en blanco para no cambiar)'
                : 'Contraseña'}
            </label>
            <div className='relative'>
              <input
                type='password'
                name='password'
                value={formData.password}
                onChange={onChange}
                className='block w-full p-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                placeholder='••••••••'
                required={!isEditMode}
              />
              <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-500'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path d='M10 12a2 2 0 100-4 2 2 0 000 4z' />
                  <path
                    fillRule='evenodd'
                    d='M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
            </div>
            {isEditMode && (
              <p className='mt-1 text-xs text-gray-500'>
                Deja este campo en blanco si no deseas cambiar la contraseña
                actual.
              </p>
            )}
          </div>

          <div className='flex items-center'>
            <input
              id='isAdmin'
              name='isAdmin'
              type='checkbox'
              checked={formData.isAdmin}
              onChange={(e) =>
                onChange({
                  target: {
                    name: 'isAdmin',
                    value: e.target.checked,
                    type: 'checkbox',
                    checked: e.target.checked,
                  },
                })
              }
              className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
            />
            <label
              htmlFor='isAdmin'
              className='block ml-2 text-sm text-gray-900'>
              Administrador
            </label>
          </div>

          {isEditMode && (
            <div className='p-4 mt-4 rounded-md bg-gray-50'>
              <h3 className='mb-2 text-sm font-medium text-gray-700'>
                Información de seguridad
              </h3>
              <div className='space-y-2'>
                <div className='flex items-center'>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      user.twoFactorEnabled ? 'bg-green-500' : 'bg-gray-300'
                    } mr-2`}></div>
                  <span className='text-sm text-gray-600'>
                    Autenticación de dos factores:{' '}
                    {user.twoFactorEnabled ? 'Activada' : 'Desactivada'}
                  </span>
                </div>
                <div className='flex items-center'>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      user.biometricAuthEnabled ? 'bg-green-500' : 'bg-gray-300'
                    } mr-2`}></div>
                  <span className='text-sm text-gray-600'>
                    Autenticación biométrica:{' '}
                    {user.biometricAuthEnabled ? 'Activada' : 'Desactivada'}
                  </span>
                </div>
                <p className='mt-1 text-xs text-gray-500'>
                  Estos ajustes solo pueden ser cambiados por el usuario desde
                  su perfil.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end mt-6 space-x-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
            {isEditMode ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserFormModal;
