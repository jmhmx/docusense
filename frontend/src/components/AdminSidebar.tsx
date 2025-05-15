interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const AdminSidebar = ({
  activeSection,
  onSectionChange,
}: AdminSidebarProps) => {
  return (
    <aside className='fixed left-0 z-20 w-64 h-screen pt-16 bg-white border-r border-gray-200 shadow-sm'>
      <div className='p-4'>
        <h2 className='text-lg font-semibold text-gray-900'>
          Panel de Administración
        </h2>
        <p className='mt-1 text-sm text-gray-600'>
          Gestiona usuarios y sistema
        </p>
      </div>
      <nav className='mt-2 space-y-1'>
        <button
          onClick={() => onSectionChange('users')}
          className={`w-full flex items-center px-4 py-2.5 text-left text-sm font-medium ${
            activeSection === 'users'
              ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className={`mr-3 w-5 h-5 ${
              activeSection === 'users' ? 'text-blue-600' : 'text-gray-500'
            }`}
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
          Usuarios
        </button>

        <button
          onClick={() => onSectionChange('config')}
          className={`w-full flex items-center px-4 py-2.5 text-left text-sm font-medium ${
            activeSection === 'config'
              ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className={`mr-3 w-5 h-5 ${
              activeSection === 'config' ? 'text-blue-600' : 'text-gray-500'
            }`}
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
          Configuración
        </button>

        <button
          onClick={() => onSectionChange('analytics')}
          className={`w-full flex items-center px-4 py-2.5 text-left text-sm font-medium ${
            activeSection === 'analytics'
              ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className={`mr-3 w-5 h-5 ${
              activeSection === 'analytics' ? 'text-blue-600' : 'text-gray-500'
            }`}
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
          Analíticas
        </button>

        <button
          onClick={() => onSectionChange('logs')}
          className={`w-full flex items-center px-4 py-2.5 text-left text-sm font-medium ${
            activeSection === 'logs'
              ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className={`mr-3 w-5 h-5 ${
              activeSection === 'logs' ? 'text-blue-600' : 'text-gray-500'
            }`}
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
            />
          </svg>
          Logs de Auditoría
        </button>

        <button
          onClick={() => onSectionChange('security')}
          className={`w-full flex items-center px-4 py-2.5 text-left text-sm font-medium ${
            activeSection === 'security'
              ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className={`mr-3 w-5 h-5 ${
              activeSection === 'security' ? 'text-blue-600' : 'text-gray-500'
            }`}
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
          Seguridad
        </button>
      </nav>
    </aside>
  );
};

export default AdminSidebar;
