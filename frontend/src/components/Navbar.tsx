import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className='bg-white shadow'>
      <div className='px-4 mx-auto max-w-7xl sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between h-16'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <Link
                to='/'
                className='flex items-center'>
                <img
                  src='/logotipo.png'
                  alt='DocuSense'
                  className='w-auto h-8'
                />
              </Link>
            </div>
            <div className='hidden md:block'>
              <div className='flex items-baseline ml-10 space-x-4'>
                {isAuthenticated && (
                  <>
                    <Link
                      to='/dashboard'
                      className='px-3 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100'>
                      Dashboard
                    </Link>
                    {user?.isAdmin && (
                      <Link
                        to='/admin'
                        className='px-3 py-2 text-sm font-medium text-blue-600 rounded-md hover:bg-blue-50'>
                        Administración
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className='hidden md:block'>
            <div className='flex items-center ml-4 md:ml-6'>
              {isAuthenticated ? (
                <div className='relative ml-3'>
                  <div>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      type='button'
                      className='flex items-center max-w-xs text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      id='user-menu-button'
                      aria-expanded='false'
                      aria-haspopup='true'>
                      <span className='sr-only'>Abrir menú de usuario</span>
                      <div className='flex items-center justify-center w-8 h-8 text-blue-600 bg-blue-100 rounded-full'>
                        {user?.name?.substring(0, 1) || 'U'}
                      </div>
                      <span className='ml-2 text-sm font-medium text-gray-700'>
                        {user?.name}
                      </span>
                      <svg
                        className='w-5 h-5 ml-1 text-gray-400'
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 20 20'
                        fill='currentColor'
                        aria-hidden='true'>
                        <path
                          fillRule='evenodd'
                          d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                          clipRule='evenodd'
                        />
                      </svg>
                    </button>
                  </div>

                  {showDropdown && (
                    <div
                      className='absolute right-0 z-50 w-48 py-1 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                      role='menu'
                      aria-orientation='vertical'
                      aria-labelledby='user-menu-button'
                      tabIndex={-1}>
                      {/* <Link
                        to='/profile'
                        className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                        role='menuitem'
                        tabIndex={-1}
                        id='user-menu-item-0'
                        onClick={() => setShowDropdown(false)}>
                        Mi perfil
                      </Link> */}
                      {user?.isAdmin && (
                        <Link
                          to='/admin'
                          className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                          role='menuitem'
                          tabIndex={-1}
                          id='user-menu-item-1'
                          onClick={() => setShowDropdown(false)}>
                          Panel de Administración
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          handleLogout();
                        }}
                        className='block w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100'
                        role='menuitem'
                        tabIndex={-1}
                        id='user-menu-item-2'>
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex space-x-4'>
                  <Link
                    to='/login'
                    className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50'>
                    Iniciar sesión
                  </Link>
                  <Link
                    to='/register'
                    className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700'>
                    Registrarse
                  </Link>
                </div>
              )}
            </div>
          </div>
          <div className='flex -mr-2 md:hidden'>
            <button
              type='button'
              className='inline-flex items-center justify-center p-2 text-gray-400 bg-white rounded-md hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              aria-controls='mobile-menu'
              aria-expanded='false'
              onClick={() => setShowDropdown(!showDropdown)}>
              <span className='sr-only'>Abrir menú principal</span>
              <svg
                className={`${showDropdown ? 'hidden' : 'block'} w-6 h-6`}
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                aria-hidden='true'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 6h16M4 12h16M4 18h16'
                />
              </svg>
              <svg
                className={`${showDropdown ? 'block' : 'hidden'} w-6 h-6`}
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                aria-hidden='true'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${showDropdown ? 'block' : 'hidden'} md:hidden`}
        id='mobile-menu'>
        <div className='px-2 pt-2 pb-3 space-y-1 sm:px-3'>
          {isAuthenticated && (
            <>
              <Link
                to='/dashboard'
                className='block px-3 py-2 text-base font-medium text-gray-900 rounded-md hover:bg-gray-100'
                onClick={() => setShowDropdown(false)}>
                Dashboard
              </Link>
              {user?.isAdmin && (
                <Link
                  to='/admin'
                  className='block px-3 py-2 text-base font-medium text-blue-600 rounded-md hover:bg-blue-50'
                  onClick={() => setShowDropdown(false)}>
                  Administración
                </Link>
              )}
            </>
          )}
        </div>
        <div className='pt-4 pb-3 border-t border-gray-200'>
          {isAuthenticated ? (
            <>
              <div className='flex items-center px-5'>
                <div className='flex-shrink-0'>
                  <div className='flex items-center justify-center w-10 h-10 text-white bg-blue-600 rounded-full'>
                    {user?.name?.substring(0, 1) || 'U'}
                  </div>
                </div>
                <div className='ml-3'>
                  <div className='text-base font-medium text-gray-800'>
                    {user?.name}
                  </div>
                  <div className='text-sm font-medium text-gray-500'>
                    {user?.email}
                  </div>
                </div>
              </div>
              <div className='px-2 mt-3 space-y-1'>
                {/* <Link
                  to='/profile'
                  className='block px-3 py-2 text-base font-medium text-gray-900 rounded-md hover:bg-gray-100'
                  onClick={() => setShowDropdown(false)}>
                  Mi perfil
                </Link> */}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    handleLogout();
                  }}
                  className='block w-full px-3 py-2 text-base font-medium text-left text-gray-900 rounded-md hover:bg-gray-100'>
                  Cerrar sesión
                </button>
              </div>
            </>
          ) : (
            <div className='px-2 space-y-1'>
              <Link
                to='/login'
                className='block px-3 py-2 text-base font-medium text-gray-900 rounded-md hover:bg-gray-100'
                onClick={() => setShowDropdown(false)}>
                Iniciar sesión
              </Link>
              <Link
                to='/register'
                className='block px-3 py-2 text-base font-medium text-blue-600 rounded-md hover:bg-blue-50'
                onClick={() => setShowDropdown(false)}>
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
