import { useState, useEffect } from 'react';
import configService from '../services/ConfigService';
import Button from './Button';
import { SystemHealthData } from '../types/admin';

const SystemHealthPanel = () => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Formatear bytes a unidades legibles
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatear fecha ISO a formato legible
  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  // Cargar datos de salud del sistema
  const fetchHealthData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await configService.getSystemHealth();
      setHealthData(response);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Error al obtener estado de salud del sistema:', err);
      setError(
        err.response?.data?.message ||
          'Error al obtener datos de salud del sistema',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchHealthData();

    // Configurar actualización automática cada 30 segundos
    const intervalId = setInterval(fetchHealthData, 30000);

    // Limpiar intervalo al desmontar
    return () => clearInterval(intervalId);
  }, []);

  // Determinar el color según el estado
  const getStatusColor = (status: 'up' | 'down' | 'warning'): string => {
    switch (status) {
      case 'up':
        return 'bg-green-500';
      case 'down':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Determinar el color según el porcentaje de uso
  const getUsageColor = (usedPercentage: number): string => {
    if (usedPercentage < 50) return 'text-green-600';
    if (usedPercentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading && !healthData) {
    return (
      <div className='flex items-center justify-center p-6'>
        <svg
          className='w-10 h-10 text-blue-500 animate-spin'
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
    );
  }

  if (error && !healthData) {
    return (
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
              onClick={fetchHealthData}
              className='mt-2 text-sm font-medium text-red-700 underline hover:text-red-900'>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!healthData) return null;

  // Calcular porcentajes de uso
  const storageUsedPercentage =
    healthData.resources.storage.total > 0
      ? (healthData.resources.storage.used /
          healthData.resources.storage.total) *
        100
      : 0;

  const activeUsersPercentage =
    healthData.resources.users.total > 0
      ? (healthData.resources.users.active / healthData.resources.users.total) *
        100
      : 0;

  return (
    <div className='space-y-6'>
      {/* Encabezado con estado general y última actualización */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center'>
          <div
            className={`w-3 h-3 rounded-full mr-2 ${
              healthData.status === 'healthy'
                ? 'bg-green-500'
                : healthData.status === 'degraded'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}></div>
          <h2 className='text-lg font-medium text-gray-900'>
            Estado del Sistema:{' '}
            <span className='capitalize'>{healthData.status}</span>
          </h2>
        </div>
        <div className='flex items-center space-x-2'>
          <span className='text-sm text-gray-500'>
            Actualizado: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchHealthData}
            disabled={isLoading}
            className='p-1 text-gray-500 hover:text-gray-700 focus:outline-none'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tarjetas de estado de servicios */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        {Object.entries(healthData.services).map(
          ([serviceName, serviceStatus]) => (
            <div
              key={serviceName}
              className='p-4 bg-white rounded-lg shadow'>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-medium text-gray-900 capitalize'>
                  {serviceName}
                </h3>
                <div
                  className={`w-2.5 h-2.5 rounded-full ${getStatusColor(
                    serviceStatus.status,
                  )}`}></div>
              </div>
              <p className='mt-1 text-3xl font-semibold text-gray-900 capitalize'>
                {serviceStatus.status}
              </p>
              <p className='mt-1 text-xs text-gray-500'>
                Verificado: {formatDate(serviceStatus.lastChecked)}
              </p>
              {serviceStatus.status === 'down' && (
                <div className='mt-2'>
                  <Button
                    variant='secondary'
                    size='small'
                    onClick={() => fetchHealthData()}>
                    Verificar de nuevo
                  </Button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {/* Métricas de recursos */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        {/* Almacenamiento */}
        <div className='p-4 bg-white rounded-lg shadow'>
          <h3 className='text-sm font-medium text-gray-900'>Almacenamiento</h3>
          <div className='mt-2'>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-gray-500'>Utilizado</span>
              <span
                className={`text-sm font-medium ${getUsageColor(
                  storageUsedPercentage,
                )}`}>
                {formatBytes(healthData.resources.storage.used)} /{' '}
                {formatBytes(healthData.resources.storage.total)}
              </span>
            </div>
            <div className='w-full h-2 mt-2 bg-gray-200 rounded-full'>
              <div
                className={`h-2 rounded-full ${
                  storageUsedPercentage < 50
                    ? 'bg-green-500'
                    : storageUsedPercentage < 80
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(storageUsedPercentage, 100)}%`,
                }}></div>
            </div>
            <div className='mt-1 text-xs text-gray-500'>
              Disponible: {formatBytes(healthData.resources.storage.available)}
            </div>
          </div>
        </div>

        {/* Usuarios */}
        <div className='p-4 bg-white rounded-lg shadow'>
          <h3 className='text-sm font-medium text-gray-900'>Usuarios</h3>
          <div className='flex items-center justify-between mt-2'>
            <div>
              <p className='text-3xl font-semibold text-gray-900'>
                {healthData.resources.users.active}
              </p>
              <p className='text-sm text-gray-500'>Usuarios activos</p>
            </div>
            <div>
              <p className='text-3xl font-semibold text-gray-900'>
                {healthData.resources.users.total}
              </p>
              <p className='text-sm text-gray-500'>Usuarios totales</p>
            </div>
          </div>
          <div className='w-full h-2 mt-4 bg-gray-200 rounded-full'>
            <div
              className='h-2 bg-blue-500 rounded-full'
              style={{
                width: `${Math.min(activeUsersPercentage, 100)}%`,
              }}></div>
          </div>
          <div className='mt-1 text-xs text-gray-500'>
            {activeUsersPercentage.toFixed(1)}% de usuarios activos
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
