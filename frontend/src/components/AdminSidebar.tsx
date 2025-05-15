import React from 'react';

const AdminSidebar = ({ activeSection = 'users' }) => {
  // Lista de secciones del panel de administración
  const sections = [
    { id: 'users', name: 'Gestión de usuarios', icon: 'user-group' },
    { id: 'config', name: 'Configuración del sistema', icon: 'cog' },
    { id: 'analytics', name: 'Analíticas', icon: 'chart-bar' },
    { id: 'logs', name: 'Logs de auditoría', icon: 'document-text' },
    { id: 'security', name: 'Seguridad', icon: 'shield-check' },
  ];

  // Renderizar el icono correspondiente
  const renderIcon = (iconName) => {
    switch (iconName) {
      case 'user-group':
        return (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-5 h-5'
            viewBox='0 0 20 20'
            fill='currentColor'>
            <path d='M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z' />
          </svg>
        );
      case 'cog':
        return (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-5 h-5'
            viewBox='0 0 20 20'
            fill='currentColor'>
            <path
              fillRule='evenodd'
              d='M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z'
              clipRule='evenodd'
            />
          </svg>
        );
      case 'chart-bar':
        return (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-5 h-5'
            viewBox='0 0 20 20'
            fill='currentColor'>
            <path d='M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z' />
          </svg>
        );
      case 'document-text':
        return (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-5 h-5'
            viewBox='0 0 20 20'
            fill='currentColor'>
            <path
              fillRule='evenodd'
              d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z'
              clipRule='evenodd'
            />
          </svg>
        );
      case 'shield-check':
        return (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-5 h-5'
            viewBox='0 0 20 20'
            fill='currentColor'>
            <path
              fillRule='evenodd'
              d='M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
              clipRule='evenodd'
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className='fixed top-0 left-0 w-64 h-screen pt-16 bg-white border-r border-gray-200 shadow-md'>
      <div className='px-4 py-6'>
        <h2 className='mb-6 text-lg font-semibold text-gray-900'>
          Panel de Administración
        </h2>
        <nav className='space-y-1'>
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`group flex items-center px-3 py-3 text-sm font-medium rounded-md ${
                activeSection === section.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}>
              <span className='mr-3'>{renderIcon(section.icon)}</span>
              {section.name}
            </a>
          ))}
        </nav>
      </div>

      {/* Información del sistema */}
      <div className='px-4 py-4 mt-6 border-t border-gray-200'>
        <div className='flex items-center'>
          <div className='flex-shrink-0'>
            <div className='flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-5 h-5 text-blue-600'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
          </div>
          <div className='ml-3'>
            <p className='text-sm font-medium text-gray-700'>DocuSense</p>
            <p className='text-xs text-gray-500'>v1.2.0</p>
          </div>
        </div>
        <div className='mt-4 text-xs text-gray-500'>
          <p>Último inicio de sesión:</p>
          <p className='font-medium text-gray-700'>
            15 de mayo de 2025, 10:30 AM
          </p>
        </div>
        <button className='flex items-center justify-center w-full px-4 py-2 mt-4 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-4 h-4 mr-2'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
            />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
