import { useState } from 'react';
import AdminUserManagement from '../components/AdminUserManagement';
import AdminSidebar from '../components/AdminSidebar';

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<string>('users');

  // Función para cambiar entre secciones
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  // Renderizar el contenido adecuado según la sección activa
  const renderContent = () => {
    switch (activeSection) {
      case 'users':
        return <AdminUserManagement />;
      case 'config':
        return (
          <div className='p-8'>
            <h1 className='mb-4 text-2xl font-bold'>
              Configuración del Sistema
            </h1>
            <p>Esta sección está en desarrollo.</p>
          </div>
        );
      case 'analytics':
        return (
          <div className='p-8'>
            <h1 className='mb-4 text-2xl font-bold'>Analíticas</h1>
            <p>Esta sección está en desarrollo.</p>
          </div>
        );
      case 'logs':
        return (
          <div className='p-8'>
            <h1 className='mb-4 text-2xl font-bold'>Logs de Auditoría</h1>
            <p>Esta sección está en desarrollo.</p>
          </div>
        );
      case 'security':
        return (
          <div className='p-8'>
            <h1 className='mb-4 text-2xl font-bold'>Seguridad</h1>
            <p>Esta sección está en desarrollo.</p>
          </div>
        );
      default:
        return <AdminUserManagement />;
    }
  };

  return (
    <div className='flex min-h-screen bg-gray-100'>
      {/* Header - Barra superior */}
      <header className='fixed top-0 left-0 right-0 z-20 flex items-center justify-between h-16 px-4 bg-white shadow-sm'>
        <div className='flex items-center'>
          <img
            src='/logo.svg'
            alt='DocuSense Logo'
            className='w-auto h-8'
          />
          <span className='ml-3 text-xl font-semibold text-gray-900'>
            DocuSense
          </span>
        </div>
        <div className='flex items-center space-x-4'>
          <div className='relative'>
            <button className='text-gray-500 hover:text-gray-700'>
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
                  d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                />
              </svg>
            </button>
            <span className='absolute top-0 right-0 block w-2 h-2 bg-red-500 rounded-full'></span>
          </div>
          <div className='flex items-center'>
            <div className='flex items-center justify-center w-8 h-8 font-medium text-white bg-blue-500 rounded-full'>
              AD
            </div>
            <span className='ml-2 text-sm font-medium text-gray-700'>
              Admin
            </span>
          </div>
        </div>
      </header>

      {/* Barra lateral */}
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

      {/* Contenido principal */}
      <main className='flex-1 pt-16 ml-64'>{renderContent()}</main>
    </div>
  );
};

export default AdminDashboard;
