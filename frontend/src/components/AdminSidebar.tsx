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
      </nav>
    </aside>
  );
};

export default AdminSidebar;
