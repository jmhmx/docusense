import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
//import useAuth from '../hooks/UseAuth';
import DocumentAnalysis from '../components/DocumentAnalysis';

interface DocumentType {
  id: string;
  title: string;
  description?: string;
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  status: string;
  metadata?: Record<string, any>;
  extractedContent?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const DocumentViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Mantenemos user para posibles extensiones futuras (ej: verificar permisos)
  //const { user } = useAuth();
  
  const [document, setDocument] = useState<DocumentType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata' | 'content' | 'analysis'>('preview');
  const [processingDocument, setProcessingDocument] = useState<boolean>(false);

  useEffect(() => {
    const fetchDocument = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/documents/${id}`);
        setDocument(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error al cargar el documento:', err);
        setError(err?.response?.data?.message || 'Error al cargar el documento');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDocument();
    }
  }, [id]);

  const handleProcessDocument = async () => {
    if (!id) return;
    
    setProcessingDocument(true);
    try {
      await api.post(`/api/documents/${id}/process`);
      // Recargar el documento después de enviarlo a procesamiento
      const response = await api.get(`/api/documents/${id}`);
      setDocument(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error al procesar el documento:', err);
      setError(err?.response?.data?.message || 'Error al procesar el documento');
    } finally {
      setProcessingDocument(false);
    }
  };

  const handleDownloadDocument = () => {
    if (!document) return;
    
    // Crear un enlace de descarga con una petición al backend
    const link = window.document.createElement('a');
    link.href = `/api/documents/${id}/download`; // Esta ruta debe estar implementada en el backend
    link.setAttribute('download', document.filename);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const renderDocumentPreview = () => {
    if (!document) return null;

    if (document.mimeType?.includes('pdf')) {
      // Renderizar visor de PDF (se necesita implementar el endpoint en el backend)
      return (
        <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
          <img 
            src={`/api/documents/${id}/view`} 
            alt={document.title}
            className="object-contain max-w-full max-h-96"
          />
        </div>
      );
    } else {
      // Para otros tipos de documentos mostrar un mensaje
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg h-96">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-600">Vista previa no disponible para este tipo de documento.</p>
          <button 
            onClick={handleDownloadDocument}
            className="inline-flex items-center px-4 py-2 mt-4 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Descargar para ver
          </button>
        </div>
      );
    }
  };

  const renderMetadataTab = () => {
    if (!document) return null;

    return (
      <div className="mt-4 overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Metadatos del documento</h3>
          <p className="max-w-2xl mt-1 text-sm text-gray-500">Información detallada sobre el documento.</p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Título</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{document.title}</dd>
            </div>
            <div className="px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Archivo</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{document.filename}</dd>
            </div>
            <div className="px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Tamaño</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatFileSize(document.fileSize)}</dd>
            </div>
            <div className="px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Tipo</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{document.mimeType || 'Desconocido'}</dd>
            </div>
            <div className="px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Estado</dt>
              <dd className="mt-1 sm:mt-0 sm:col-span-2">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(document.status)}`}>
                  {document.status}
                </span>
              </dd>
            </div>
            <div className="px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Creado</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(document.createdAt)}</dd>
            </div>
            <div className="px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Última modificación</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(document.updatedAt)}</dd>
            </div>
            {document.description && (
              <div className="px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Descripción</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{document.description}</dd>
              </div>
            )}
            {document.metadata && Object.keys(document.metadata).length > 0 && (
              <div className="px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Metadatos adicionales</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <pre className="p-2 overflow-auto bg-gray-100 rounded max-h-40">
                    {JSON.stringify(document.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    );
  };

  const renderContentTab = () => {
    if (!document) return null;

    if (!document.extractedContent || Object.keys(document.extractedContent).length === 0) {
      return (
        <div className="p-6 mt-4 overflow-hidden text-center bg-white shadow sm:rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay contenido extraído</h3>
          <p className="mt-1 text-sm text-gray-500">
            Este documento aún no ha sido procesado o no se pudo extraer contenido.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleProcessDocument}
              disabled={processingDocument || document.status === 'processing'}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingDocument ? 'Procesando...' : 'Procesar documento'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Contenido extraído</h3>
          <p className="max-w-2xl mt-1 text-sm text-gray-500">Texto e información extraída del documento.</p>
        </div>
        <div className="px-4 py-5 border-t border-gray-200 sm:px-6">
          {document.extractedContent.text ? (
            <div className="mt-2">
              <h4 className="mb-2 text-sm font-medium text-gray-500">Texto extraído:</h4>
              <div className="p-4 overflow-auto rounded-md bg-gray-50 max-h-96">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{document.extractedContent.text}</p>
              </div>
            </div>
          ) : null}

          {document.extractedContent.data ? (
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-medium text-gray-500">Datos estructurados:</h4>
              <pre className="p-4 overflow-auto text-sm rounded-md bg-gray-50 max-h-96">
                {JSON.stringify(document.extractedContent.data, null, 2)}
              </pre>
            </div>
          ) : null}

          {document.extractedContent.success === false && document.extractedContent.error ? (
            <div className="p-4 mt-4 border-l-4 border-red-400 bg-red-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">Error en la extracción: {document.extractedContent.error}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="py-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-500">Cargando documento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Error</h3>
          </div>
          <div className="px-4 py-5 border-t border-gray-200 sm:px-6">
            <div className="p-4 rounded-md bg-red-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Volver al dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="mb-6 overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{document.title}</h2>
              {document.description && (
                <p className="mt-1 text-sm text-gray-500">{document.description}</p>
              )}
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(document.status)}`}>
                  {document.status}
                </span>
                <span className="mx-2 text-gray-500">•</span>
                <span className="text-sm text-gray-500">{formatFileSize(document.fileSize)}</span>
                <span className="mx-2 text-gray-500">•</span>
                <span className="text-sm text-gray-500">Subido el {formatDate(document.createdAt)}</span>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleDownloadDocument}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('preview')}
            className={`${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Vista previa
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`${
              activeTab === 'metadata'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Metadatos
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`${
              activeTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Contenido extraído
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Análisis
          </button>
        </nav>
      </div>

      {/* Contenido de la pestaña activa */}
      {activeTab === 'preview' && renderDocumentPreview()}
      {activeTab === 'metadata' && renderMetadataTab()}
      {activeTab === 'content' && renderContentTab()}
      {activeTab === 'analysis' && id && <DocumentAnalysis documentId={id} />}
    </div>
  );
};

export default DocumentViewer;