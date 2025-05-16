import { useState, useEffect } from 'react';
//import { api } from '../api/client';
import Button from '../components/Button';

// Tipos
interface SecurityEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  ipAddress?: string;
  userId?: string;
  resourceId?: string;
}

interface SecurityStats {
  totalEvents: number;
  criticalEvents: number;
  highEvents: number;
  mediumEvents: number;
  lowEvents: number;
  blockedAttempts: number;
  documentVerifications: number;
  signaturesVerified: number;
  certificatesRevoked: number;
}

const SecurityDashboard = () => {
  // Estados
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Cargar datos al iniciar
  useEffect(() => {
    fetchSecurityData();
  }, [filter, timeRange]);

  // Función para cargar datos de seguridad
  const fetchSecurityData = async () => {
    setIsLoading(true);
    setError('');

    try {
      // En un entorno real, estas serían peticiones a la API
      // Datos de ejemplo para demostración

      // Estadísticas de seguridad
      const mockStats: SecurityStats = {
        totalEvents: 156,
        criticalEvents: 3,
        highEvents: 12,
        mediumEvents: 48,
        lowEvents: 93,
        blockedAttempts: 27,
        documentVerifications: 103,
        signaturesVerified: 78,
        certificatesRevoked: 2,
      };

      // Eventos de seguridad
      const mockEvents: SecurityEvent[] = [
        {
          id: '1',
          type: 'Intento de acceso fallido',
          severity: 'medium',
          description:
            'Múltiples intentos fallidos de inicio de sesión desde IP 192.168.1.1',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          ipAddress: '192.168.1.1',
          userId: '3',
        },
        {
          id: '2',
          type: 'Certificado revocado',
          severity: 'high',
          description:
            'Certificado de usuario revocado por posible compromiso de clave',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          userId: '2',
        },
        {
          id: '3',
          type: 'Documento verificado en blockchain',
          severity: 'low',
          description:
            'Verificación exitosa de integridad de documento en blockchain',
          timestamp: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          resourceId: 'doc-123',
          userId: '5',
        },
        {
          id: '4',
          type: 'Rotación de claves',
          severity: 'low',
          description:
            'Rotación automática de claves criptográficas completada',
          timestamp: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          id: '5',
          type: 'Intento de acceso a documento cifrado',
          severity: 'high',
          description: 'Intento de acceso no autorizado a documento cifrado',
          timestamp: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ipAddress: '203.0.113.45',
          resourceId: 'doc-456',
        },
        {
          id: '6',
          type: 'Configuración de seguridad modificada',
          severity: 'medium',
          description: 'Modificación de parámetros de seguridad del sistema',
          timestamp: new Date(
            Date.now() - 4 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          userId: '1',
        },
        {
          id: '7',
          type: 'Alerta de seguridad',
          severity: 'critical',
          description:
            'Posible ataque de fuerza bruta detectado contra interfaz de API',
          timestamp: new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ipAddress: '198.51.100.23',
        },
      ];

      // Aplicar filtros
      let filteredEvents = [...mockEvents];

      // Filtrar por severidad
      if (filter !== 'all') {
        filteredEvents = filteredEvents.filter(
          (event) => event.severity === filter,
        );
      }

      // Filtrar por rango de tiempo
      const now = new Date();
      let timeLimit = new Date();

      switch (timeRange) {
        case '24h':
          timeLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      filteredEvents = filteredEvents.filter(
        (event) => new Date(event.timestamp) >= timeLimit,
      );

      // Ordenar por fecha (más reciente primero)
      filteredEvents.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setStats(mockStats);
      setEvents(filteredEvents);
    } catch (err) {
      console.error('Error cargando datos de seguridad:', err);
      setError('Error al cargar información de seguridad');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para generar clase de color según severidad
  const getSeverityClass = (severity: string) => {
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

  // Función para formatear fechas
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Función para mostrar tiempo transcurrido
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0)
      return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffMins > 0)
      return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    return `Hace ${diffSecs} segundo${diffSecs !== 1 ? 's' : ''}`;
  };

  // Renderizado
  return (
    <div className='p-6'>
      <h1 className='mb-6 text-2xl font-bold text-gray-900'>
        Panel de Seguridad
      </h1>

      {/* Tarjetas de estadísticas */}
      {stats && (
        <div className='grid grid-cols-1 gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4'>
          <div className='p-6 bg-white rounded-lg shadow-md'>
            <div className='flex items-center'>
              <div className='p-3 mr-4 bg-blue-100 rounded-full'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-6 h-6 text-blue-600'
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
              </div>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Eventos de Seguridad
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {stats.totalEvents}
                </p>
              </div>
            </div>
            <div className='flex mt-4 text-xs'>
              <span className='px-2 py-1 mr-1 text-red-800 bg-red-100 rounded-full'>
                {stats.criticalEvents} críticos
              </span>
              <span className='px-2 py-1 mr-1 text-orange-800 bg-orange-100 rounded-full'>
                {stats.highEvents} altos
              </span>
              <span className='px-2 py-1 text-yellow-800 bg-yellow-100 rounded-full'>
                {stats.mediumEvents} medios
              </span>
            </div>
          </div>

          <div className='p-6 bg-white rounded-lg shadow-md'>
            <div className='flex items-center'>
              <div className='p-3 mr-4 bg-red-100 rounded-full'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-6 h-6 text-red-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z'
                  />
                </svg>
              </div>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Intentos Bloqueados
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {stats.blockedAttempts}
                </p>
              </div>
            </div>
            <div className='mt-4 text-xs'>
              <p className='text-gray-600'>
                Incluye intentos de inicio de sesión y accesos no autorizados
              </p>
            </div>
          </div>

          <div className='p-6 bg-white rounded-lg shadow-md'>
            <div className='flex items-center'>
              <div className='p-3 mr-4 bg-green-100 rounded-full'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-6 h-6 text-green-600'
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
              </div>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Verificaciones
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {stats.documentVerifications}
                </p>
              </div>
            </div>
            <div className='flex mt-4 text-xs'>
              <span className='px-2 py-1 mr-1 text-blue-800 bg-blue-100 rounded-full'>
                {stats.signaturesVerified} firmas
              </span>
            </div>
          </div>

          <div className='p-6 bg-white rounded-lg shadow-md'>
            <div className='flex items-center'>
              <div className='p-3 mr-4 bg-purple-100 rounded-full'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-6 h-6 text-purple-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                  />
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                  />
                </svg>
              </div>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Certificados Revocados
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {stats.certificatesRevoked}
                </p>
              </div>
            </div>
            <div className='mt-4 text-xs'>
              <p className='text-gray-600'>
                Certificados revocados por motivos de seguridad
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className='flex flex-wrap items-center gap-4 mb-6'>
        <div>
          <label
            htmlFor='severity-filter'
            className='block mb-1 text-sm font-medium text-gray-700'>
            Severidad
          </label>
          <select
            id='severity-filter'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className='block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'>
            <option value='all'>Todas</option>
            <option value='critical'>Crítica</option>
            <option value='high'>Alta</option>
            <option value='medium'>Media</option>
            <option value='low'>Baja</option>
          </select>
        </div>

        <div>
          <label
            htmlFor='time-filter'
            className='block mb-1 text-sm font-medium text-gray-700'>
            Período
          </label>
          <select
            id='time-filter'
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className='block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'>
            <option value='24h'>Últimas 24 horas</option>
            <option value='7d'>Últimos 7 días</option>
            <option value='30d'>Últimos 30 días</option>
          </select>
        </div>

        <div className='self-end'>
          <Button
            onClick={fetchSecurityData}
            variant='secondary'>
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estado de carga o error */}
      {isLoading ? (
        <div className='flex items-center justify-center p-12'>
          <svg
            className='w-12 h-12 text-blue-500 animate-spin'
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
      ) : error ? (
        <div className='p-4 mb-4 border-l-4 border-red-500 bg-red-50'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='w-5 h-5 text-red-400'
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm text-red-700'>{error}</p>
              <button
                onClick={fetchSecurityData}
                className='mt-2 text-sm font-medium text-red-700 underline hover:text-red-900'>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className='p-6 text-center bg-white rounded-lg shadow'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-12 h-12 mx-auto text-gray-400'
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
          <h3 className='mt-2 text-lg font-medium text-gray-900'>
            No hay eventos de seguridad
          </h3>
          <p className='mt-1 text-gray-500'>
            No se encontraron eventos que coincidan con los filtros
            seleccionados.
          </p>
        </div>
      ) : (
        // Lista de eventos de seguridad
        <div className='overflow-hidden bg-white rounded-lg shadow'>
          <ul className='divide-y divide-gray-200'>
            {events.map((event) => (
              <li
                key={event.id}
                className='hover:bg-gray-50'>
                <div className='px-4 py-4 sm:px-6'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityClass(
                          event.severity,
                        )}`}>
                        {event.severity === 'critical'
                          ? 'Crítico'
                          : event.severity === 'high'
                          ? 'Alto'
                          : event.severity === 'medium'
                          ? 'Medio'
                          : 'Bajo'}
                      </span>
                      <p className='ml-2 text-sm font-medium text-gray-900'>
                        {event.type}
                      </p>
                    </div>
                    <div className='flex items-center ml-2 text-sm text-gray-500'>
                      <p>{getTimeAgo(event.timestamp)}</p>
                    </div>
                  </div>
                  <div className='mt-2'>
                    <p className='text-sm text-gray-700'>{event.description}</p>
                  </div>
                  <div className='mt-2 text-sm text-gray-500'>
                    <div className='flex flex-wrap gap-2'>
                      {event.ipAddress && (
                        <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800'>
                          IP: {event.ipAddress}
                        </span>
                      )}
                      {event.userId && (
                        <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800'>
                          Usuario ID: {event.userId}
                        </span>
                      )}
                      {event.resourceId && (
                        <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800'>
                          Recurso ID: {event.resourceId}
                        </span>
                      )}
                      <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800'>
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instrucciones de seguridad */}
      <div className='p-6 mt-8 bg-white rounded-lg shadow'>
        <h2 className='mb-4 text-lg font-semibold text-gray-900'>
          Recomendaciones de Seguridad
        </h2>
        <div className='flex flex-col gap-4'>
          <div className='p-4 border-l-4 border-blue-500 bg-blue-50'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='w-5 h-5 text-blue-400'
                  xmlns='http://www.w3.org/2000/svg'
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
                <h3 className='text-sm font-medium text-blue-800'>
                  Rotación de claves
                </h3>
                <div className='mt-2 text-sm text-blue-700'>
                  <p>
                    Se recomienda programar rotaciones de claves cada 90 días.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='p-4 border-l-4 border-yellow-500 bg-yellow-50'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='w-5 h-5 text-yellow-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h3 className='text-sm font-medium text-yellow-800'>
                  Autenticación de dos factores
                </h3>
                <div className='mt-2 text-sm text-yellow-700'>
                  <p>
                    Active la autenticación de dos factores para todos los
                    usuarios con acceso a documentos sensibles.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='p-4 border-l-4 border-green-500 bg-green-50'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='w-5 h-5 text-green-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h3 className='text-sm font-medium text-green-800'>
                  Cifrado de documentos
                </h3>
                <div className='mt-2 text-sm text-green-700'>
                  <p>
                    Configure el cifrado automático para documentos clasificados
                    como confidenciales.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
