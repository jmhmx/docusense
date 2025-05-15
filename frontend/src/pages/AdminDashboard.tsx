import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import { api } from '../api/client';
import Button from '../components/Button';

// Tipos para estadísticas del dashboard
interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalDocuments: number;
  documentsToday: number;
  processingQueue: number;
  storageUsed: number;
  userChange: number;
  documentChange: number;
}

// Tipos para actividades recientes
interface RecentActivity {
  id: string;
  action: string;
  userId: string;
  userName: string;
  resourceId?: string;
  resourceType?: string;
  timestamp: string;
  details?: any;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados para datos del panel
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  
  // Estado para la pestaña activa
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'config' | 'logs'>('overview');

  // Cargar datos al iniciar
  useEffect(() => {
    // Verificar si el usuario es administrador
    if (!user?.isAdmin) {
      navigate('/dashboard');
      return;
    }
    
    fetchDashboardData();
  }, [user, navigate]);

  // Función para obtener datos del panel
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Obtener estadísticas
      const statsResponse = await api.get('/api/admin/stats');
      setStats(statsResponse.data);
      
      // Obtener actividad reciente
      const activityResponse = await api.get('/api/admin/activity');
      setRecentActivity(activityResponse.data);
    } catch (err: any) {
      console.error('Error al cargar datos del panel de administración:', err);
      setError('No se pudieron cargar los datos. Verifica tu conexión y permisos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Navegación entre pestañas
  const handleTabChange = (tab: 'overview' | 'users' | 'config' | 'logs') => {
    // Para pestañas que son páginas separadas, redirigir
    switch (tab) {
      case 'users':
        navigate('/admin/users');
        return;
      case 'config':
        navigate('/admin/configuration');
        return;
      case 'logs':
        navigate('/admin/logs');
        return;
      default:
        setActiveTab(tab);
    }
  };

  // Formatear bytes a unidades legibles
  const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatear fecha
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Componente para las tarjetas de estadísticas
  const StatCard = ({ title, value, icon, change }: { title: string, value: string | number, icon: JSX.Element, change?: number }) => (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center">
        <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full">
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change !== undefined && (
              <p className={`ml-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change > 0 && '+'}{change}%
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
          <p>{error}</p>
        </div>
        <Button onClick={fetchDashboardData}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={() => fetchDashboardData()} 
              variant="secondary"
              size="small"
            >
              Actualizar
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Administración general del sistema DocuSense
        </p>
      </div>
      
      {/* Navegación de pestañas */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => handleTabChange('overview')}
            className={`pb-4 text-sm font-medium border-b-2 ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Vista General
          </button>
          <button
            onClick={() => handleTabChange('users')}
            className="pb-4 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300"
          >
            Usuarios
          </button>
          <button
            onClick={() => handleTabChange('config')}
            className="pb-4 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300"
          >
            Configuración
          </button>
          <button
            onClick={() => handleTabChange('logs')}
            className="pb-4 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300"
          >
            Registros
          </button>
        </nav>
      </div>
      
      {/* Contenido principal */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tarjetas de estadísticas */}
        {stats && (
          <>
            <StatCard 
              title="Usuarios Totales" 
              value={stats.totalUsers}
              change={stats.userChange}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
            <StatCard 
              title="Documentos Totales" 
              value={stats.totalDocuments}
              change={stats.documentChange}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
            />
            <StatCard 
              title="Documentos Hoy" 
              value={stats.documentsToday}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <StatCard 
              title="Almacenamiento" 
              value={formatStorageSize(stats.storageUsed)}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              }
            />
          </>
        )}
      </div>
      
      {/* Actividad Reciente */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Actividad Reciente</h2>
        <div className="mt-3 overflow-hidden bg-white shadow sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <li key={activity.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-blue-600 truncate">
                        {activity.action}
                      </p>
                      <div className="flex-shrink-0 ml-2">
                        <span className="inline-flex px-2 text-xs font-semibold text-gray-800 bg-gray-100 rounded-full">
                          {formatDate(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {activity.userName}
                        </p>
                        {activity.resourceId && (
                          <p className="flex items-center mt-2 text-sm text-gray-500 sm:mt-0 sm:ml-6">
                            <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {activity.resourceType || 'Recurso'}
                          </p>
                        )}
                      </div>
                      {activity.details && (
                        <div className="flex items-center mt-2 text-sm text-gray-500 sm:mt-0">
                          <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span>
                            {typeof activity.details === 'string' 
                              ? activity.details 
                              : 'Detalles disponibles'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-4 py-5 sm:px-6">
                <p className="text-sm text-gray-500">No hay actividad reciente para mostrar.</p>
              </li>
            )}
          </ul>
        </div>
      </div>
      
      {/* Enlaces rápidos */}
      <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="overflow-hidden transition-shadow duration-200 bg-white rounded-lg shadow hover:shadow-md">
          <div className="px-6 py-4">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="ml-3 text-lg font-medium text-gray-900">Gestión de Usuarios</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Administrar usuarios, permisos y roles en el sistema.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/admin/users')}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ir a Usuarios
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-hidden transition-shadow duration-200 bg-white rounded-lg shadow hover:shadow-md">
          <div className="px-6 py-4">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="ml-3 text-lg font-medium text-gray-900">Configuración</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Ajustes globales, opciones de seguridad y parámetros del sistema.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/admin/configuration')}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ir a Configuración
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-hidden transition-shadow duration-200 bg-white rounded-lg shadow hover:shadow-md">
          <div className="px-6 py-4">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="ml-3 text-lg font-medium text-gray-900">Registros</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Ver registros de auditoría, eventos del sistema y actividad de usuarios.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/admin/logs')}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ver Registros
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;