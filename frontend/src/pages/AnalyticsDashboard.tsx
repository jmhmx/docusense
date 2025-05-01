import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from '../components/Button';
import DocumentStatusChart from '../components/analytics/DocumentStatusChart';
import SignatureProgressChart from '../components/analytics/SignatureProgressChart';
import DocumentMetricsCard from '../components/analytics/DocumentMetricsCard';
import RecentActivityTimeline from '../components/analytics/RecentActivityTimeline';
import TopDocumentsTable from '../components/analytics/TopDocumentsTable';

const AnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/analytics/dashboard?range=${dateRange}`);
      setMetrics(response.data);
    } catch (err: any) {
      console.error('Error al cargar datos del dashboard:', err);
      setError(err?.response?.data?.message || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get(`/api/analytics/export?range=${dateRange}`, {
        responseType: 'blob'
      });
      
      // Crear un enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dashboard_report_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Limpieza
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error al exportar reporte:', err);
      setError('Error al exportar el reporte. Inténtelo de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 mx-auto max-w-7xl">
        <div className="p-4 mb-6 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
        <Button onClick={fetchDashboardData}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto max-w-7xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Analítico</h1>
          <p className="mt-1 text-sm text-gray-500">
            Visión general del sistema de gestión documental
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setDateRange('week')}
              className={`px-4 py-2 text-sm font-medium ${
                dateRange === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 rounded-l-md focus:z-10 focus:outline-none`}
            >
              Semana
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-4 py-2 text-sm font-medium ${
                dateRange === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border-t border-b border-gray-300 focus:z-10 focus:outline-none`}
            >
              Mes
            </button>
            <button
              onClick={() => setDateRange('year')}
              className={`px-4 py-2 text-sm font-medium ${
                dateRange === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 rounded-r-md focus:z-10 focus:outline-none`}
            >
              Año
            </button>
          </div>
          <Button
            onClick={exportReport}
            disabled={isExporting}
            className="flex items-center"
          >
            {isExporting ? (
              <svg className="w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-2 -ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Exportar Reporte
          </Button>
        </div>
      </div>

      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 gap-5 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <DocumentMetricsCard
          title="Documentos Totales"
          value={metrics?.totalDocuments || 0}
          change={metrics?.documentChange || 0}
          icon={
            <svg className="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />

        <DocumentMetricsCard
          title="Documentos Firmados"
          value={metrics?.signedDocuments || 0}
          change={metrics?.signedChange || 0}
          icon={
            <svg className="w-6 h-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
        />

        <DocumentMetricsCard
          title="Documentos Encriptados"
          value={metrics?.encryptedDocuments || 0}
          change={metrics?.encryptedChange || 0}
          icon={
            <svg className="w-6 h-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />

        <DocumentMetricsCard
          title="Documentos Compartidos"
          value={metrics?.sharedDocuments || 0}
          change={metrics?.sharedChange || 0}
          icon={
            <svg className="w-6 h-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          }
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">Estado de los Documentos</h3>
            <div className="h-64 mt-4">
              <DocumentStatusChart data={metrics?.documentStatusData || []} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">Progreso de Firmas</h3>
            <div className="h-64 mt-4">
              <SignatureProgressChart data={metrics?.signatureProgressData || []} />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline y Top Documentos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden bg-white rounded-lg shadow lg:col-span-2">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">Actividad Reciente</h3>
            <div className="mt-4">
              <RecentActivityTimeline activities={metrics?.recentActivity || []} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">Documentos Más Vistos</h3>
            <div className="mt-4">
              <TopDocumentsTable documents={metrics?.topDocuments || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;