import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from '../components/Button';

// Componentes para pestañas
import UserManagement from './admin/UserManagement';
import SystemSettings from './admin/SystemSettings';
import TenantManagement from './admin/TenantManagement';
import SecuritySettings from './admin/SecuritySettings';
import ActivityMonitor from './admin/ActivityMonitor';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStats, setSystemStats] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [redirect, setRedirect] = useState(false);

  // Verificar si el usuario es administrador
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (!userData) {
          setRedirect(true);
          return;
        }
        
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Verificar si es administrador
        const response = await api.get(`/api/users/${parsedUser.id}/role`);
        setIsAdmin(response.data.isAdmin);
        
        if (!response.data.isAdmin) {
          setRedirect(true);
        }
      } catch (err) {
        console.error("Error verificando rol de administrador:", err);
        setRedirect(true);
      }
    };
    
    checkAdmin();
  }, []);

  // Cargar estadísticas generales del sistema
  useEffect(() => {
    const fetchSystemStats = async () => {
      if (!isAdmin) return;
      
      setIsLoading(true);
      try {
        const response = await api.get('/api/admin/system-stats');
        setSystemStats(response.data);
      } catch (err) {
        setError('Error al cargar estadísticas del sistema');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchSystemStats();
    }
  }, [isAdmin]);

  // Renderizado condicional según la pestaña activa
  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'tenants':
        return <TenantManagement />;
      case 'settings':
        return <SystemSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'activity':
        return <ActivityMonitor />;
      default:
        return <UserManagement />;
    }
  };

  if (redirect) {
    // En lugar de usar Navigate, simplemente redirigimos con window.location
    window.location.href = '/dashboard';
    return null;
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-6 bg-white rounded-lg shadow-lg">
          <h1 className="mb-4 text-xl font-bold text-red-600">Acceso Restringido</h1>
          <p className="mb-4">Esta sección está restringida para administradores del sistema.</p>
          <Button 
            onClick={() => window.location.href = '/dashboard'} 
            variant="primary"
          >
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600">Gestión centralizada del sistema DocuSense</p>
      </div>

      {/* Mostrar estadísticas generales */}
      {isLoading ? (
        <div className="p-4 mb-6 bg-white rounded-lg shadow">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 rounded-full border-t-blue-500 border-b-blue-500 animate-spin"></div>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      ) : systemStats && (
        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Usuarios Totales</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{systemStats.totalUsers}</p>
            <div className="mt-2 text-sm text-green-600">+{systemStats.newUsersLastWeek} esta semana</div>
          </div>
          
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Documentos</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{systemStats.totalDocuments}</p>
            <div className="mt-2 text-sm text-green-600">+{systemStats.newDocumentsLastWeek} esta semana</div>
          </div>
          
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Tenants Activos</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{systemStats.activeTenants}</p>
            <div className="mt-2 text-sm text-gray-600">{systemStats.inactiveTenants} inactivos</div>
          </div>
          
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Uso de Almacenamiento</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{systemStats.storageUsed}</p>
            <div className="mt-2 text-sm text-gray-600">{systemStats.storagePercentage}% del total</div>
          </div>
        </div>
      )}

      {/* Pestañas de navegación */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'tenants'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tenants
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configuración
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Seguridad
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-4 text-sm font-medium border-b-2 ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Actividad
          </button>
        </nav>
      </div>

      {/* Contenido de la pestaña activa */}
      <div className="bg-white rounded-lg shadow">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;