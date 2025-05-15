import React from 'react';

const DeleteConfirmationModal = ({ user, isOpen, onConfirm, onCancel }) => {
  if (!isOpen || !user) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='w-full max-w-md p-6 bg-white rounded-lg shadow-xl'>
        <div className='sm:flex sm:items-start'>
          <div className='flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-red-100 rounded-full sm:mx-0 sm:h-10 sm:w-10'>
            <svg
              className='w-6 h-6 text-red-600'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
          </div>
          <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
            <h3 className='text-lg font-medium leading-6 text-gray-900'>
              Eliminar usuario
            </h3>
            <div className='mt-2'>
              <p className='text-sm text-gray-500'>
                ¿Estás seguro de que deseas eliminar a{' '}
                <span className='font-medium text-gray-700'>{user.name}</span>?
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
        </div>
        <div className='mt-5 sm:mt-4 sm:flex sm:flex-row-reverse'>
          <button
            type='button'
            onClick={onConfirm}
            className='inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm'>
            Eliminar
          </button>
          <button
            type='button'
            onClick={onCancel}
            className='inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm'>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
