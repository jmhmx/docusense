import { UserFormModalProps } from '../types/user';

const UserFormModal = ({
  isOpen,
  onClose,
  title,
  formData,
  onChange,
  onSubmit,
  isEdit = false,
  isLoading = false,
  error = '',
}: UserFormModalProps) => {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='w-full max-w-md p-6 bg-white rounded-lg shadow-xl'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-xl font-medium text-gray-900'>{title}</h2>
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

        {error && (
          <div className='p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700'>
              Nombre
            </label>
            <input
              type='text'
              name='name'
              value={formData.name}
              onChange={onChange}
              required
              className='block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
            />
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700'>
              Email
            </label>
            <input
              type='email'
              name='email'
              value={formData.email}
              onChange={onChange}
              required
              className='block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
            />
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700'>
              {isEdit
                ? 'Contraseña (dejar en blanco para no cambiar)'
                : 'Contraseña'}
            </label>
            <input
              type='password'
              name='password'
              value={formData.password}
              onChange={onChange}
              required={!isEdit}
              className='block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
            />
          </div>

          <div className='flex items-center mb-4'>
            <input
              type='checkbox'
              id='isAdmin'
              name='isAdmin'
              checked={formData.isAdmin}
              onChange={onChange}
              className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
            />
            <label
              htmlFor='isAdmin'
              className='block ml-2 text-sm text-gray-900'>
              Administrador
            </label>
          </div>

          <div className='flex justify-end mt-6 space-x-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={isLoading}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'>
              Cancelar
            </button>
            <button
              type='submit'
              disabled={isLoading}
              className='flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'>
              {isLoading ? (
                <>
                  <svg
                    className='w-4 h-4 mr-2 -ml-1 text-white animate-spin'
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
                  {isEdit ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                <>{isEdit ? 'Actualizar' : 'Crear'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
