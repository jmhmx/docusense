import { useState, useEffect } from 'react';
import SystemHealthPanel from '../components/SystemHealthPanel';
import configService from '../services/ConfigService';
import { SecurityEvent, RecentUser } from '../types/admin';

const SystemHealthDashboard = () => {
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  //@ts-ignore
  const [error, setError] = useState('');

  useEffect(() => {
    // Cargar usuarios recientes
    const fetchRecentUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const data = await configService.getRecentUsers();
        setRecentUsers(data);
      } catch (err) {
        console.error('Error al cargar usuarios recientes:', err);
        setError('Error al cargar usuarios recientes');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    // Cargar eventos de seguridad
    const fetchSecurityEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const data = await configService.getSecurityEvents();
        setSecurityEvents(data);
      } catch (err) {
        console.error('Error al cargar eventos de seguridad:', err);
        setError('Error al cargar eventos de seguridad');
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchRecentUsers();
    fetchSecurityEvents();
  }, []);

  // Formatear fecha relativa
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    }
    if (diffMins > 0) {
      return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    }
    return `Hace ${diffSecs} segundo${diffSecs !== 1 ? 's' : ''}`;
  };

  // Función para obtener color según severidad
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className='p-6 space-y-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>Estado del Sistema</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Monitorea el estado de salud y los recursos del sistema
        </p>
      </div>

      {/* Panel de estado de salud */}
      <div className='p-6 bg-white rounded-lg shadow'>
        <SystemHealthPanel />
      </div>

      {/* Información adicional - Grid con dos columnas */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Usuarios recientes */}
        <div className='p-6 bg-white rounded-lg shadow'>
          <h2 className='mb-4 text-lg font-medium text-gray-900'>
            Usuarios recientes
          </h2>

          {isLoadingUsers ? (
            <div className='flex items-center justify-center p-4'>
              <svg
                className='w-6 h-6 text-blue-500 animate-spin'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'>
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
              </svg>
            </div>
          ) : recentUsers.length > 0 ? (
            <ul className='divide-y divide-gray-200'>
              {recentUsers.slice(0, 5).map((user) => (
                <li
                  key={user.id}
                  className='py-3'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0'>
                      <div className='flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full'>
                        <span className='text-xs font-medium text-blue-800'>
                          {user.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className='ml-3'>
                      <p className='text-sm font-medium text-gray-900'>
                        {user.name}
                      </p>
                      <p className='text-xs text-gray-500'>{user.email}</p>
                    </div>
                    <div className='ml-auto'>
                      <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800'>
                        {user.isAdmin ? 'Admin' : 'Usuario'}
                      </span>
                    </div>
                  </div>
                  <div className='mt-1 text-xs text-gray-500'>
                    <span>Registrado: {formatTimeAgo(user.createdAt)}</span>
                    {user.lastActivity && (
                      <span className='ml-2'>
                        • Última actividad: {formatTimeAgo(user.lastActivity)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-gray-500'>No hay usuarios recientes</p>
          )}
        </div>

        {/* Eventos de seguridad */}
        <div className='p-6 bg-white rounded-lg shadow'>
          <h2 className='mb-4 text-lg font-medium text-gray-900'>
            Eventos de seguridad recientes
          </h2>

          {isLoadingEvents ? (
            <div className='flex items-center justify-center p-4'>
              <svg
                className='w-6 h-6 text-blue-500 animate-spin'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'>
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
              </svg>
            </div>
          ) : securityEvents.length > 0 ? (
            <ul className='divide-y divide-gray-200'>
              {securityEvents.slice(0, 5).map((event) => (
                <li
                  key={event.id}
                  className='py-3'>
                  <div className='flex items-center'>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                        event.severity,
                      )}`}>
                      {event.severity}
                    </span>
                    <p className='ml-2 text-sm font-medium text-gray-900'>
                      {event.type}
                    </p>
                    <span className='ml-auto text-xs text-gray-500'>
                      {formatTimeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className='mt-1 text-sm text-gray-500'>
                    {event.description}
                  </p>
                  {(event.ipAddress || event.userId || event.resourceId) && (
                    <div className='flex flex-wrap mt-1 space-x-2'>
                      {event.ipAddress && (
                        <span className='text-xs text-gray-500'>
                          IP: {event.ipAddress}
                        </span>
                      )}
                      {event.userId && (
                        <span className='text-xs text-gray-500'>
                          Usuario ID: {event.userId}
                        </span>
                      )}
                      {event.resourceId && (
                        <span className='text-xs text-gray-500'>
                          Recurso: {event.resourceId}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-gray-500'>
              No hay eventos de seguridad recientes
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemHealthDashboard;
