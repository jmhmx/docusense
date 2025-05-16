import { DeleteConfirmationModalProps } from '../types/user';

const DeleteConfirmationModal = ({
  user,
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteConfirmationModalProps) => {
  if (!isOpen || !user) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='w-full max-w-md p-6 bg-white rounded-lg shadow-xl'>
        <div className='flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-6 h-6 text-red-600'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>

        <div className='mt-3 text-center'>
          <h3 className='text-lg font-medium text-gray-900'>
            Eliminar Usuario
          </h3>
          <p className='mt-2 text-sm text-gray-500'>
            ¿Estás seguro de que deseas eliminar a{' '}
            <span className='font-medium'>{user.name}</span>? Esta acción no se
            puede deshacer.
          </p>
        </div>

        <div className='flex justify-end mt-6 space-x-3'>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className='flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50'>
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
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
