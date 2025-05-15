import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import { api } from '../api/client';
import Button from '../components/Button';

// Tipos para estadísticas
interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalDocuments: number;
  storageUsed: number;
  certificatesIssued: number;
  signedDocuments: number;
}

interface UserActivity {
  id: string;
  name: string;
  email: string;
  lastActivity: string;
  documentsCount: number;
}

interface AdminDashboardProps {
  onNavigate?: (route: string) => void;
}

const AdminDashboard = ({ onNavigate }: AdminDashboardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados para datos de administración
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserActivity[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Cargar datos del dashboard administrativo
  useEffect(() => {
    const fetchAdminData = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        // Cargar estadísticas del sistema
        const statsResponse = await api.get('/api/admin/stats');
        setStats(statsResponse.data);
        
        // Cargar usuarios recientes
        const usersResponse = await api.get('/api/admin/recent-users');
        setRecentUsers(usersResponse.data);
        
        // Cargar eventos de seguridad
        const securityResponse = await api.get('/api/admin/security-events');
        setSecurityEvents(securityResponse.data);
      } catch (err: any) {
        console.error('Error cargando datos administrativos:', err);
        setError('No se pudieron cargar los datos administrativos');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAdminData();
  }, []);

  // Función para navegar a diferentes secciones del panel admin
  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      navigate(`/admin/${route}`);
    }
  };

  // Función para formatear bytes a una unidad legible
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Componente para tarjeta de estadísticas
  const StatCard = ({ title, value, icon, color }: { title: string, value: string | number, icon: JSX.Element, color: string }) => (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 ${color} rounded-md`}>
          {icon}
        </div>
        <div className="ml-5">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
  
  // Mostrar estado de carga
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-700">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  // Mostrar error si ocurrió alguno
  if (error) {
    return (
      <div className="p-4 mt-8 rounded-md bg-red-50">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
            <div className="mt-4">
              <Button onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-7xl">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="mt-1 text-sm text-gray-500">
          Bienvenido al panel de administración de DocuSense. Gestiona usuarios, documentos y configuración del sistema.
        </p>
      </div>
      
      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 gap-5 mb-8 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Usuarios Totales" 
          value={stats?.totalUsers || 0} 
          icon={
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
          color="bg-blue-500"
        />
        
        <StatCard 
          title="Documentos" 
          value={stats?.totalDocuments || 0} 
          icon={
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          color="bg-green-500"
        />
        
        <StatCard 
          title="Almacenamiento" 
          value={formatBytes(stats?.storageUsed || 0)} 
          icon={
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          }
          color="bg-purple-500"
        />
        
        <StatCard 
          title="Documentos Firmados" 
          value={stats?.signedDocuments || 0} 
          icon={
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          color="bg-indigo-500"
        />
      </div>
      
      {/* Accesos rápidos */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => handleNavigate('users')}
            className="p-4 text-left transition-colors duration-200 bg-white rounded-lg shadow hover:bg-gray-50"
          >
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-md">
                <svg className="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-900">Gestionar Usuarios</p>
                <p className="mt-1 text-sm text-gray-500">Administrar usuarios del sistema</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => handleNavigate('documents')}
            className="p-4 text-left transition-colors duration-200 bg-white rounded-lg shadow hover:bg-gray-50"
          >
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-md">
                <svg className="w-6 h-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-900">Documentos</p>
                <p className="mt-1 text-sm text-gray-500">Ver y gestionar documentos</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => handleNavigate('security')}
            className="p-4 text-left transition-colors duration-200 bg-white rounded-lg shadow hover:bg-gray-50"
          >
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-md">
                <svg className="w-6 h-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-900">Seguridad</p>
                <p className="mt-1 text-sm text-gray-500">Ajustes y logs de seguridad</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => handleNavigate('settings')}
            className="p-4 text-left transition-colors duration-200 bg-white rounded-lg shadow hover:bg-gray-50"
          >
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-md">
                <svg className="w-6 h-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-900">Configuración</p>
                <p className="mt-1 text-sm text-gray-500">Ajustes del sistema</p>
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Actividad reciente */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Usuarios recientes */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Usuarios Recientes
              </h3>
              <Button 
                size="small"
                onClick={() => handleNavigate('users')}
              >
                Ver todos
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {recentUsers.length > 0 ? (
              recentUsers.map((user) => (
                <li key={user.id} className="px-4 py-4 transition-colors duration-200 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full">
                        <span className="text-sm font-medium text-gray-700">
                          {user.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">{user.name}</h4>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-xs text-gray-500">
                        {new Date(user.lastActivity).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.documentsCount} documentos
                      </p>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-4 py-5 text-center text-gray-500">
                No hay usuarios recientes
              </li>
            )}
          </ul>
        </div>
        
        {/* Eventos de seguridad */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Eventos de Seguridad
              </h3>
              <Button 
                size="small"
                onClick={() => handleNavigate('security/logs')}
              >
                Ver todos
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {securityEvents.length > 0 ? (
              securityEvents.map((event) => (
                <li key={event.id} className="px-4 py-4 transition-colors duration-200 hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                      event.severity === 'high' ? 'bg-red-500' :
                      event.severity === 'medium' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{event.type}</p>
                      <p className="text-xs text-gray-500">{event.description}</p>
                    </div>
                    <div className="ml-auto">
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-4 py-5 text-center text-gray-500">
                No hay eventos de seguridad recientes
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;