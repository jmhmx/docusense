// frontend/src/components/SatResponsesList.tsx
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import useSatNotifications from '../hooks/useSatNotifications';

interface SatResponse {
  id: string;
  uuid: string;
  folio: string;
  status: string;
  documentType: string;
  createdAt: string;
  processedAt: string;
  acuses?: Array<{
    id: string;
    filename: string;
    fileSize: number;
  }>;
}

const SatResponsesList = () => {
  const [responses, setResponses] = useState<SatResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { registerCallback } = useSatNotifications();

  useEffect(() => {
    fetchResponses();
    
    // Registrar callback para actualizar automáticamente cuando lleguen nuevas respuestas
    const unregister = registerCallback((notification) => {
      if (notification.type === 'SAT_RESPONSE') {
        fetchResponses();
      }
    });
    
    return () => {
      unregister();
    };
  }, []);

  const fetchResponses = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/sat/respuestas');
      setResponses(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Error al cargar respuestas del SAT:', error);
      setError(error?.response?.data?.message || 'Error al cargar respuestas');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAcuse = async (acuseId: string) => {
    try {
      // Creamos un link para descargar directamente
      const link = document.createElement('a');
      link.href = `/api/sat/acuses/${acuseId}/download`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al descargar acuse:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-MX');
  };

  const getStatusText = (status: string) => {
    const statuses = {
      'received': 'Recibido',
      'processing': 'En Procesamiento',
      'accepted': 'Aceptado',
      'rejected': 'Rechazado',
      'cancelled': 'Cancelado',
    };
    return statuses[status] || status;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <svg className="w-8 h-8 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-2">Cargando respuestas del SAT...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border-l-4 border-red-500 bg-red-50">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white rounded-lg shadow-md">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">Respuestas del SAT</h3>
        <p className="mt-1 text-sm text-gray-500">Lista de respuestas recibidas del SAT para sus trámites</p>
      </div>
      
      {responses.length === 0 ? (
        <div className="p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay respuestas</h3>
          <p className="mt-1 text-sm text-gray-500">Aún no se han recibido respuestas del SAT.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {responses.map((resp) => (
            <li key={resp.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {resp.documentType} - Folio: {resp.folio || 'Sin folio asignado'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Recibido: {formatDate(resp.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(resp.status)}`}>
                    {getStatusText(resp.status)}
                  </span>
                </div>
              </div>
              
              {/* Acuses si hay */}
              {resp.acuses && resp.acuses.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-gray-500">Acuses disponibles:</h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {resp.acuses.map(acuse => (
                      <button
                        key={acuse.id}
                        onClick={() => downloadAcuse(acuse.id)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {acuse.filename}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SatResponsesList;