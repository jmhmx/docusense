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
      {/* Sidebar de administración */}
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
