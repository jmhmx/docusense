import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import { api } from '../api/client';
import FileUpload from '../components/FileUpload';
import ContentSearch from '../components/ContentSearch';
import AnalyticsDashboard from './AnalyticsDashboard';
import Button from '../components/Button';
import DocumentStatusBadge from '../components/DocumentStatusBadge';
import { useNotifications } from '../components/NotificationSystem';
import FiltersPanel from '../components/FiltersPanel';

// Tipos
interface DocumentType {
  id: string;
  title: string;
  description?: string;
  filename: string;
  fileSize: number;
  status: string;
  mimeType?: string;
  createdAt: string;
  extractedContent?: Record<string, any>;
}

interface Filters {
  status: string;
  dateRange: string;
  searchQuery: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Estados para documentos
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentType[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados para modales
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showContentSearch, setShowContentSearch] = useState(false);
  const [contentSearchResults, setContentSearchResults] = useState<
    DocumentType[] | null
  >(null);

  // Estado para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [docsPerPage] = useState(8); // Aumentado de 5 a 8 documentos por página

  // Estado para filtros y ordenamiento
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    dateRange: 'all',
    searchQuery: '',
  });
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [sharedDocuments, setSharedDocuments] = useState<DocumentType[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeView, setActiveView] = useState<'grid' | 'list'>('list');
  const { errorNotification, confirm } = useNotifications();

  // Cargar documentos al iniciar
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/documents');
      setDocuments(response.data);
      setErrorMessage('');
    } catch (err: any) {
      console.error('Error al cargar documentos:', err);
      setErrorMessage(
        'No se pudieron cargar los documentos. Intente nuevamente más tarde.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar documentos compartidos
  const fetchSharedDocuments = async () => {
    try {
      const response = await api.get('/api/sharing/shared-with-me');
      setSharedDocuments(response.data);
    } catch (err) {
      console.error('Error al cargar documentos compartidos:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchSharedDocuments();
  }, []);

  // Aplicar filtros y ordenamiento
  useEffect(() => {
    let result = [...documents];

    // Aplicar filtro por estado
    if (filters.status !== 'all') {
      result = result.filter((doc) => doc.status === filters.status);
    }

    // Aplicar filtro por fecha
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let dateLimit = new Date();

      switch (filters.dateRange) {
        case 'today':
          dateLimit.setHours(0, 0, 0, 0);
          break;
        case 'week':
          dateLimit.setDate(now.getDate() - 7);
          break;
        case 'month':
          dateLimit.setMonth(now.getMonth() - 1);
          break;
      }

      result = result.filter((doc) => new Date(doc.createdAt) >= dateLimit);
    }

    // Aplicar búsqueda por título o nombre de archivo
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.filename.toLowerCase().includes(query) ||
          (doc.description && doc.description.toLowerCase().includes(query)),
      );
    }

    // Aplicar ordenamiento
    result.sort((a, b) => {
      const fieldA = a[sortField as keyof DocumentType];
      const fieldB = b[sortField as keyof DocumentType];

      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        return sortDirection === 'asc'
          ? fieldA.localeCompare(fieldB)
          : fieldB.localeCompare(fieldA);
      }

      // Para fechas
      if (sortField === 'createdAt') {
        return sortDirection === 'asc'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      // Para tamaño de archivo
      if (sortField === 'fileSize') {
        return sortDirection === 'asc'
          ? (a.fileSize || 0) - (b.fileSize || 0)
          : (b.fileSize || 0) - (a.fileSize || 0);
      }

      return 0;
    });

    setFilteredDocuments(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [documents, filters, sortField, sortDirection]);

  // Eliminar documento
  const handleDeleteDocument = async (id: string) => {
    const confirmed = await confirm(
      '¿Está seguro de que desea eliminar este documento? Esta acción no se puede deshacer.',
      'Confirmar eliminación',
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/documents/${id}`);
      setDocuments(documents.filter((doc) => doc.id !== id));
    } catch (err) {
      console.error('Error al eliminar documento:', err);
      errorNotification(
        'No se pudo eliminar el documento. Intente nuevamente más tarde.',
        'pSDK-500',
        {
          persistent: true, // Los errores son persistentes por defecto
        },
      );
    }
  };

  // Manejar cambio de filtros
  const handleFilterChange = (filterName: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  // Manejar ordenamiento
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Paginación
  const indexOfLastDoc = currentPage * docsPerPage;
  const indexOfFirstDoc = indexOfLastDoc - docsPerPage;
  const paginatedDocs = filteredDocuments.slice(
    indexOfFirstDoc,
    indexOfLastDoc,
  );
  const totalPages = Math.ceil(filteredDocuments.length / docsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Funciones utilitarias
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'processing':
        return 'Procesando';
      case 'error':
        return 'Error';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const getDocumentTypeIcon = (mimeType: string = '') => {
    if (mimeType.includes('pdf')) {
      return (
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
            d='M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'
          />
        </svg>
      );
    } else if (mimeType.includes('image')) {
      return (
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
            d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
          />
        </svg>
      );
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return (
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
            d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
          />
        </svg>
      );
    } else if (mimeType.includes('excel') || mimeType.includes('sheet')) {
      return (
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
            d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
          />
        </svg>
      );
    } else {
      return (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          className='w-6 h-6 text-gray-600'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
          />
        </svg>
      );
    }
  };

  // Componente para tarjeta de documento en vista de cuadrícula
  const DocumentCard = ({ document }: { document: DocumentType }) => (
    <div className='overflow-hidden transition-shadow duration-300 bg-white rounded-lg shadow hover:shadow-md'>
      <div className='flex items-center justify-center h-40 bg-gray-50'>
        <div className='p-4 text-center'>
          {getDocumentTypeIcon(document.mimeType)}
        </div>
      </div>
      <div className='p-4'>
        <h3 className='mb-1 text-lg font-medium text-gray-900 truncate'>
          {document.title}
        </h3>
        {document.description && (
          <p className='mb-2 text-sm text-gray-500 line-clamp-2'>
            {document.description}
          </p>
        )}
        <div className='flex items-center justify-between mt-2'>
          <DocumentStatusBadge status={document.status} />
          <span className='text-xs text-gray-500'>
            {formatFileSize(document.fileSize)}
          </span>
        </div>
        <div className='mt-3 text-xs text-gray-500'>
          {formatDate(document.createdAt)}
        </div>
        <div className='flex justify-end mt-4 space-x-2'>
          <button
            type='button'
            className='inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            onClick={() => navigate(`/documents/${document.id}`)}>
            Ver
          </button>
          <button
            type='button'
            onClick={() => handleDeleteDocument(document.id)}
            className='inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );

  // Componente para fila de documento en vista de lista
  const DocumentRow = ({ document }: { document: DocumentType }) => (
    <li className='transition-colors duration-200 border-b border-gray-100 hover:bg-gray-50'>
      <div className='px-4 py-4'>
        <div className='md:flex md:items-center'>
          <div className='flex justify-center flex-shrink-0 w-12'>
            {getDocumentTypeIcon(document.mimeType)}
          </div>
          <div className='px-2 md:w-1/3'>
            <h4 className='text-lg font-medium text-gray-900'>
              {document.title}
            </h4>
            {document.description && (
              <p className='mt-1 text-sm text-gray-500 line-clamp-1'>
                {document.description}
              </p>
            )}
            <p className='mt-1 text-xs text-gray-500 md:hidden'>
              {document.filename}
            </p>
          </div>
          <div className='px-2 mt-2 md:w-1/6 md:mt-0'>
            <span
              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                document.status,
              )}`}>
              {getStatusText(document.status)}
            </span>
          </div>
          <div className='px-2 mt-2 text-sm text-gray-500 md:w-1/6 md:mt-0'>
            {formatFileSize(document.fileSize)}
          </div>
          <div className='px-2 mt-2 text-sm text-gray-500 md:w-1/4 md:mt-0'>
            {formatDate(document.createdAt)}
          </div>
          <div className='flex px-2 mt-4 space-x-2 md:w-1/6 md:mt-0 md:justify-end'>
            <button
              type='button'
              className='inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              onClick={() => navigate(`/documents/${document.id}`)}>
              Ver
            </button>
            <button
              type='button'
              onClick={() => handleDeleteDocument(document.id)}
              className='inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </li>
  );

  // Componente para la tarjeta de bienvenida
  const WelcomeCard = () => (
    <div className='mb-8 overflow-hidden transition-all duration-300 bg-white rounded-lg shadow hover:shadow-lg'>
      <div className='px-4 py-5 sm:p-6'>
        <div className='flex items-center'>
          <div className='flex-shrink-0 p-3 bg-blue-500 rounded-md'>
            <svg
              className='w-6 h-6 text-white'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
              />
            </svg>
          </div>
          <div className='ml-5'>
            <h3 className='text-lg font-medium leading-6 text-gray-900'>
              Bienvenido, {user?.name}!
            </h3>
            <div className='max-w-xl mt-2 text-sm text-gray-500'>
              <p>
                Aquí puedes gestionar tus documentos, subirlos, visualizarlos y
                ver la información extraída.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente para la lista de documentos compartidos
  const SharedDocumentsList = () => {
    if (!sharedDocuments || sharedDocuments.length === 0) return null;

    return (
      <div className='mt-8 overflow-hidden transition-shadow duration-300 bg-white rounded-lg shadow hover:shadow-md'>
        <div className='px-4 py-5 border-b border-gray-200 sm:px-6'>
          <h3 className='text-lg font-medium leading-6 text-gray-900'>
            Documentos compartidos recientemente
          </h3>
        </div>
        <ul className='divide-y divide-gray-200'>
          {sharedDocuments.slice(0, 3).map((doc) => (
            <li
              key={doc.id}
              className='px-4 py-4 transition-colors duration-200 hover:bg-gray-50'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='w-8 h-8 text-blue-500'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                      />
                    </svg>
                  </div>
                  <div className='ml-4'>
                    <h4 className='text-sm font-medium text-gray-900'>
                      {doc.title}
                    </h4>
                    <p className='text-xs text-gray-500'>
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className='px-3 py-1 text-xs font-medium text-gray-700 transition-colors duration-200 bg-gray-100 rounded-md hover:bg-gray-200'>
                  Ver
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Componente para la paginación
  const Pagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className='flex items-center justify-between px-4 py-3 mt-4 bg-white border-t border-gray-200 rounded-md shadow sm:px-6'>
        <div className='hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'>
          <div>
            <p className='text-sm text-gray-700'>
              Mostrando{' '}
              <span className='font-medium'>{indexOfFirstDoc + 1}</span> a{' '}
              <span className='font-medium'>
                {Math.min(indexOfLastDoc, filteredDocuments.length)}
              </span>{' '}
              de <span className='font-medium'>{filteredDocuments.length}</span>{' '}
              resultados
            </p>
          </div>
          <div>
            <nav
              className='relative z-0 inline-flex -space-x-px rounded-md shadow-sm'
              aria-label='Pagination'>
              <button
                onClick={() => paginate(currentPage > 1 ? currentPage - 1 : 1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}>
                <span className='sr-only'>Anterior</span>
                <svg
                  className='w-5 h-5'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                  aria-hidden='true'>
                  <path
                    fillRule='evenodd'
                    d='M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0010-1.414l4-4a1 1 0 011.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>

              {/* Page Numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => paginate(pageNumber)}
                    className={`relative inline-flex items-center px-4 py-2 border ${
                      currentPage === pageNumber
                        ? 'bg-blue-50 border-blue-500 text-blue-600 z-10'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    } text-sm font-medium`}>
                    {pageNumber}
                  </button>
                ),
              )}

              <button
                onClick={() =>
                  paginate(
                    currentPage < totalPages ? currentPage + 1 : totalPages,
                  )
                }
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === totalPages
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}>
                <span className='sr-only'>Siguiente</span>
                <svg
                  className='w-5 h-5'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                  aria-hidden='true'>
                  <path
                    fillRule='evenodd'
                    d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // Renderizado principal
  return (
    <div className='px-4 py-8 pt-16 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      <div className='mb-8 md:flex md:items-center md:justify-between'>
        <div className='flex-1 min-w-0'>
          <h1 className='text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate'>
            Dashboard
          </h1>
          <p className='mt-1 text-sm text-gray-500'>
            Gestiona tus documentos y visualiza su información extraída
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-4 mt-4 md:mt-0 md:ml-4'>
          {/* Toggle between list and grid views */}
          <div className='flex p-1 border border-gray-300 rounded-md'>
            <button
              type='button'
              onClick={() => setActiveView('list')}
              className={`px-3 py-1.5 rounded-md text-sm ${
                activeView === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}>
              <span className='flex items-center'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-4 h-4 mr-1'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 6h16M4 10h16M4 14h16M4 18h16'
                  />
                </svg>
                Lista
              </span>
            </button>
            <button
              type='button'
              onClick={() => setActiveView('grid')}
              className={`px-3 py-1.5 rounded-md text-sm ${
                activeView === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}>
              <span className='flex items-center'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-4 h-4 mr-1'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
                  />
                </svg>
                Cuadrícula
              </span>
            </button>
          </div>

          <Button
            onClick={() => setShowAnalytics(!showAnalytics)}
            variant={showAnalytics ? 'secondary' : 'primary'}
            className='flex items-center'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-4 h-4 mr-1'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
              />
            </svg>
            {showAnalytics ? 'Mostrar Documentos' : 'Mostrar Analíticas'}
          </Button>

          {/* <button
            type='button'
            onClick={() => {
              setShowContentSearch(true);
              setContentSearchResults(null);
            }}
            className='inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-4 h-4 mr-2 -ml-1 text-gray-500'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
            Búsqueda avanzada
          </button> */}

          <button
            type='button'
            onClick={() => setShowUploadModal(true)}
            className='inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-4 h-4 mr-2 -ml-1'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z'
                clipRule='evenodd'
              />
            </svg>
            Nuevo documento
          </button>
        </div>
      </div>

      {/* Contenido principal - Alternando entre documentos y analíticas */}
      {showAnalytics ? (
        <AnalyticsDashboard />
      ) : (
        <div>
          {/* Welcome Card */}
          <WelcomeCard />

          {/* Estados de carga y error */}
          {isLoading ? (
            <div className='flex items-center justify-center p-12'>
              <div className='flex flex-col items-center justify-center'>
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
                <p className='mt-4 text-lg font-medium text-gray-700'>
                  Cargando documentos...
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className='p-4 rounded-md bg-red-50'>
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
                  <h3 className='text-sm font-medium text-red-800'>
                    {errorMessage}
                  </h3>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <FiltersPanel
                filters={filters}
                onFilterChange={handleFilterChange}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onSortDirectionChange={() =>
                  setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                }
              />

              {/* Lista de documentos */}
              {paginatedDocs.length === 0 ? (
                <div className='p-12 text-center bg-white rounded-lg shadow-sm'>
                  <svg
                    className='w-16 h-16 mx-auto text-gray-400'
                    xmlns='http://www.w3.org/2000/svg'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    />
                  </svg>
                  <h3 className='mt-4 text-lg font-medium text-gray-900'>
                    No hay documentos
                  </h3>
                  <p className='mt-2 text-gray-500'>
                    Comienza subiendo tu primer documento.
                  </p>
                  <div className='mt-6'>
                    <button
                      type='button'
                      onClick={() => setShowUploadModal(true)}
                      className='inline-flex items-center px-5 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='w-5 h-5 mr-2 -ml-1'
                        viewBox='0 0 20 20'
                        fill='currentColor'>
                        <path
                          fillRule='evenodd'
                          d='M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z'
                          clipRule='evenodd'
                        />
                      </svg>
                      Nuevo documento
                    </button>
                  </div>
                </div>
              ) : activeView === 'grid' ? (
                // Vista de cuadrícula
                <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                  {paginatedDocs.map((document) => (
                    <DocumentCard
                      key={document.id}
                      document={document}
                    />
                  ))}
                </div>
              ) : (
                // Vista de lista
                <div className='overflow-hidden bg-white rounded-lg shadow'>
                  <ul className='divide-y divide-gray-200'>
                    {paginatedDocs.map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* Paginación */}
              <Pagination />
            </>
          )}

          {/* Documentos Compartidos Recientemente */}
          <SharedDocumentsList />

          {/* Búsqueda y resultados */}
          {contentSearchResults && (
            <div className='mb-6'>
              <div className='overflow-hidden bg-white rounded-lg shadow'>
                <div className='px-4 py-5 border-b border-gray-200 sm:px-6'>
                  <div className='flex items-center justify-between'>
                    <h3 className='text-lg font-medium leading-6 text-gray-900'>
                      Resultados de búsqueda
                    </h3>
                    <button
                      type='button'
                      onClick={() => setContentSearchResults(null)}
                      className='text-gray-400 hover:text-gray-500'
                      aria-label='Cerrar'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='w-5 h-5'
                        viewBox='0 0 20 20'
                        fill='currentColor'>
                        <path
                          fillRule='evenodd'
                          d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                          clipRule='evenodd'
                        />
                      </svg>
                    </button>
                  </div>
                  <p className='max-w-2xl mt-1 text-sm text-gray-500'>
                    {contentSearchResults.length} documentos encontrados
                  </p>
                </div>
                <ul className='divide-y divide-gray-200'>
                  {contentSearchResults.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Modal de búsqueda por contenido */}
          {showContentSearch && (
            <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-75'>
              <div className='w-full max-w-lg p-8 bg-white rounded-lg shadow-xl'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-lg font-medium text-gray-900'>
                    Búsqueda por contenido
                  </h3>
                  <button
                    type='button'
                    onClick={() => setShowContentSearch(false)}
                    className='text-gray-400 transition-colors duration-200 hover:text-gray-500'
                    aria-label='Cerrar'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='w-6 h-6'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <ContentSearch
                  onResultsFound={(results) => {
                    setContentSearchResults(results);
                    setShowContentSearch(false);
                  }}
                />
              </div>
            </div>
          )}

          {/* Modal de subida de documentos */}
          {showUploadModal && (
            <FileUpload
              onUploadSuccess={() => {
                setShowUploadModal(false);
                fetchDocuments();
              }}
              onCancel={() => setShowUploadModal(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
