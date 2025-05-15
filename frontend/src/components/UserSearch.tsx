import React from 'react';

const UserSearch = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className='relative'>
      <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
        <svg
          className='w-5 h-5 text-gray-400'
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 20 20'
          fill='currentColor'>
          <path
            fillRule='evenodd'
            d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
            clipRule='evenodd'
          />
        </svg>
      </div>
      <input
        type='text'
        placeholder='Buscar usuarios por nombre o email...'
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className='w-full py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
      />
      {searchQuery && (
        <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
          <button
            onClick={() => setSearchQuery('')}
            className='text-gray-400 hover:text-gray-500 focus:outline-none'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserSearch;
