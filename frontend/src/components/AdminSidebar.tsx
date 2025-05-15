//import { useState } from 'react';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface NavItem {
  id: string;
  name: string;
  icon: string;
}

const AdminSidebar = ({
  activeSection,
  onSectionChange,
}: AdminSidebarProps) => {
  // Lista de elementos de navegación
  const navItems: NavItem[] = [
    {
      id: 'users',
      name: 'Gestión de Usuarios',
      icon: 'users',
    },
    {
      id: 'config',
      name: 'Configuración',
      icon: 'config',
    },
    {
      id: 'analytics',
      name: 'Analíticas',
      icon: 'analytics',
    },
    {
      id: 'logs',
      name: 'Logs de Auditoría',
      icon: 'logs',
    },
    {
      id: 'security',
      name: 'Seguridad',
      icon: 'security',
    },
  ];

  // Función para renderizar el icono adecuado
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'users':
        return (
          <svg
            className={`mr-3 h-6 w-6 ${
              activeSection === 'users'
                ? 'text-blue-500'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
            />
          </svg>
        );
      case 'config':
        return (
          <svg
            className={`mr-3 h-6 w-6 ${
              activeSection === 'config'
                ? 'text-blue-500'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
            />
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
            />
          </svg>
        );
      case 'analytics':
        return (
          <svg
            className={`mr-3 h-6 w-6 ${
              activeSection === 'analytics'
                ? 'text-blue-500'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
            />
          </svg>
        );
      case 'logs':
        return (
          <svg
            className={`mr-3 h-6 w-6 ${
              activeSection === 'logs'
                ? 'text-blue-500'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
        );
      case 'security':
        return (
          <svg
            className={`mr-3 h-6 w-6 ${
              activeSection === 'security'
                ? 'text-blue-500'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className='fixed bottom-0 left-0 z-10 w-64 overflow-y-auto bg-white shadow-md top-16'>
      <div className='py-6'>
        <div className='px-4 mb-6'>
          <h2 className='text-lg font-semibold text-gray-900'>
            Panel de Administración
          </h2>
        </div>
        <nav className='px-2 space-y-1'>
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => onSectionChange(item.id)}
              className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                activeSection === item.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              {renderIcon(item.icon)}
              {item.name}
            </a>
          ))}
        </nav>
      </div>

      {/* Información y Versión del Sistema */}
      <div className='absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200'>
        <div className='flex items-center'>
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
          <div className='ml-3'>
            <p className='text-sm font-medium text-gray-700'>DocuSense</p>
            <p className='text-xs text-gray-500'>v1.2.0</p>
          </div>
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
    </aside>
  );
};

export default AdminSidebar;
