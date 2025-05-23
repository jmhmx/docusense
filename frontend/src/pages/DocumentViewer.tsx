import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, downloadFile } from '../api/client';
import DocumentAnalysis from '../components/DocumentAnalysis';
import DocumentSignature from '../components/DocumentSignature';
import DocumentEncrypt from '../components/DocumentEncrypt';
import DocumentSharing from '../components/DocumentSharing';
import DocumentComments from '../components/DocumentComments';
import PDFViewer from '../components/PDFViewer';
import DocumentBlockchainVerification from '../components/DocumentBlockchainVerification';
import MultiSignatureManager from '../components/MultiSignatureManager';
import MultiSignatureVerification from '../components/MultiSignatureVerification';
import PDFSearch from '../components/PDFSearch';
import DocumentStatusBadge from '../components/DocumentStatusBadge';

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

interface Signature {
  id: string;
  userId: string;
  signedAt: string;
  reason?: string;
  valid: boolean;
  position?: string;
  user?: {
    name: string;
    email: string;
  };
}

const DocumentViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'preview'
    | 'metadata'
    | 'content'
    | 'analysis'
    | 'signatures'
    | 'sharing'
    | 'comments'
    | 'blockchain'
  >('preview');
  const [processingDocument, setProcessingDocument] = useState<boolean>(false);
  // @ts-ignore
  const [unreadComments, setUnreadComments] = useState(0);
  // @ts-ignore
  const [multiSignatureEnabled, setMultiSignatureEnabled] = useState(true);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  // @ts-ignore
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(true);
  const [documentImageUrl, setDocumentImageUrl] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(true);

  // Estado para comentarios contextuales
  const [contextualComments, setContextualComments] = useState<{
    visible: boolean;
    x: number;
    y: number;
    comments: any[];
  }>({
    visible: false,
    x: 0,
    y: 0,
    comments: [],
  });
  const [comments, setComments] = useState<any[]>([]);
  // Estado para permisos del usuario sobre el documento
  const [userPermissions, setUserPermissions] = useState({
    canShare: false,
    isOwner: false,
  });

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

  // Cargar permisos del usuario
  const checkUserPermissions = async () => {
    if (!id) return;

    try {
      // Verificar permiso para compartir
      const shareResponse = await api.get(
        `/api/sharing/document/${id}/check-permission?action=share`,
      );
      const canShare = shareResponse.data.canAccess;

      // Verificar si es propietario
      const docResponse = await api.get(`/api/documents/${id}`);
      const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
      const isOwner = docResponse.data.userId === currentUserId;

      setUserPermissions({ canShare, isOwner });
    } catch (err) {
      console.error('Error verificando permisos:', err);
      setUserPermissions({ canShare: false, isOwner: false });
    }
  };

  // Función para mostrar comentarios contextuales
  const showContextualComments = (
    position: { x: number; y: number },
    pageNumber: number,
  ) => {
    // Filtrar comentarios para esta posición específica
    const commentsForPosition = comments.filter((comment) => {
      if (!comment.position) return false;

      // Verificar si es el mismo número de página
      if (comment.position.page !== pageNumber) return false;

      // Calcular distancia a la posición
      const commentX = comment.position.x || 0;
      const commentY = comment.position.y || 0;

      // Si la posición está dentro del área del comentario o muy cerca (30px)
      const distance = Math.sqrt(
        Math.pow(position.x - commentX, 2) + Math.pow(position.y - commentY, 2),
      );

      return distance < 30;
    });

    if (commentsForPosition.length > 0) {
      setContextualComments({
        visible: true,
        x: position.x,
        y: position.y,
        comments: commentsForPosition,
      });
    }
  };

  // Manejar clic en el documento
  const handleDocumentClick = (e: React.MouseEvent) => {
    // Si hay comentarios contextuales visibles, ocultarlos
    if (contextualComments.visible) {
      setContextualComments((prev) => ({ ...prev, visible: false }));
      return;
    }

    // Obtener posición relativa al contenedor del documento
    const container = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - container.left;
    const y = e.clientY - container.top;

    // Mostrar comentarios para esta posición
    showContextualComments({ x, y }, currentPage);
  };

  // Añadir esta función
  const fetchUnreadComments = async () => {
    if (!id) return;

    try {
      const response = await api.get(
        `/api/comments/document/${id}/unread-count`,
      );
      setUnreadComments(response.data);
    } catch (err) {
      console.error('Error al obtener comentarios no leídos:', err);
    }
  };

  // Función para obtener texto seleccionado
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectedText(null);
      return;
    }

    // Solo para fines de demostración, en una implementación real
    // se obtendrían las posiciones de inicio y fin reales del texto dentro del PDF
    setSelectedText({
      text,
      start: 0,
      end: text.length,
    });
  };

  useEffect(() => {
    if (id) {
      fetchDocument();
      fetchUnreadComments();
      fetchSignatures();
      fetchComments();
      checkUserPermissions();
    }

    if (id && currentPage) {
      loadDocumentImage();
      // Limpieza al desmontar
      return () => {
        if (documentImageUrl) {
          URL.revokeObjectURL(documentImageUrl);
        }
      };
    }
  }, [id, currentPage]);

  useEffect(() => {
    if (document?.metadata?.pageCount) {
      setTotalPages(document.metadata.pageCount);
    }
  }, [document]);

  const handleCommentAdded = () => {
    fetchComments();
  };

  const fetchDocument = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/documents/${id}`);
      setDocument(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError(
        err?.response?.data?.message ||
          'Error loading the document. Please try again later.',
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!id) return;

    try {
      const response = await api.get(`/api/comments/document/${id}`);
      setComments(response.data);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
    }
  };

  const fetchSignatures = async () => {
    if (!id) return;

    setIsLoadingSignatures(true);
    try {
      const response = await api.get(`/api/signatures/document/${id}`);
      setSignatures(response.data);
    } catch (err) {
      console.error('Error loading signatures:', err);
    } finally {
      setIsLoadingSignatures(false);
    }
  };

  // Crear un objeto URL con datos binarios
  const loadDocumentImage = async () => {
    try {
      const response = await api.get(
        `/api/documents/${id}/view?page=${currentPage}`,
        {
          responseType: 'blob',
        },
      );
      const imageUrl = URL.createObjectURL(response.data);
      setDocumentImageUrl(imageUrl);
    } catch (err) {
      console.error('Error cargando imagen del documento:', err);
      setError('Error al cargar la vista previa del documento');
    }
  };

  const handleProcessDocument = async () => {
    if (!id) return;

    setProcessingDocument(true);
    try {
      await api.post(`/api/documents/${id}/process`);
      // Reload document after processing
      const response = await api.get(`/api/documents/${id}`);
      setDocument(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error processing document:', err);
      setError(err?.response?.data?.message || 'Error processing document');
    } finally {
      setProcessingDocument(false);
    }
  };

  const handleDocumentUpdated = () => {
    fetchDocument();
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
      return (
        <div className='flex flex-col space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-medium text-gray-900'>
              Visualizador de documento
            </h3>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
                className='inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-5 mr-1'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d={
                      showCommentsSidebar
                        ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7'
                        : 'M13 5l7 7-7 7M5 5l7 7-7 7'
                    }
                  />
                </svg>
                {showCommentsSidebar
                  ? 'Ocultar comentarios'
                  : 'Mostrar comentarios'}
              </button>

              {/* Botón para ver PDF original */}
              <button
                onClick={() => {
                  window.open(`/api/documents/${id}/view`, '_blank');
                }}
                className='inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-4 h-4 mr-2'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7h-4v4'
                  />
                </svg>
                Ver original
              </button>
            </div>
          </div>

          {/* PDF Viewer + Comentarios en columnas */}
          <div className='flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4'>
            <div
              className={`${
                showCommentsSidebar ? 'md:w-1/2' : 'w-full'
              } transition-all duration-300`}>
              {/* Búsqueda en PDF */}
              <PDFSearch
                documentId={id || ''}
                numPages={totalPages}
                onResultClick={(page) => setCurrentPage(page)}
              />

              {/* Botón de descarga con firmas */}
              {signatures.length > 0 && (
                <div className='flex justify-end mb-2'>
                  <button
                    onClick={() => {
                      downloadFile(
                        `/api/documents/${id}/download-signed`,
                        `signed_${document.filename || 'documento'}.pdf`,
                      );
                    }}
                    className='inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='w-4 h-4 mr-2'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                      />
                    </svg>
                    Descargar PDF con firmas
                  </button>
                </div>
              )}

              {/* Información sobre las firmas */}
              {signatures.length > 0 && (
                <div className='p-3 mb-4 border border-green-200 rounded-md bg-green-50'>
                  <div className='flex items-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='w-5 h-5 mr-2 text-green-600'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                    <div className='text-sm'>
                      <span className='font-medium text-green-800'>
                        Documento firmado
                      </span>
                      <p className='text-green-700'>
                        {signatures.length} firma
                        {signatures.length > 1 ? 's' : ''} integrada
                        {signatures.length > 1 ? 's' : ''} en el PDF
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PDF Viewer - Ahora muestra el PDF con firmas integradas */}
              <div
                className='relative'
                onClick={handleDocumentClick}
                onMouseUp={handleTextSelection}>
                {documentImageUrl ? (
                  <PDFViewer
                    documentId={id || ''}
                    // NO pasamos annotations - las firmas están integradas en el PDF
                  />
                ) : (
                  <div className='flex items-center justify-center h-96'>
                    <div className='w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin'></div>
                  </div>
                )}

                {/* Popup de comentarios contextuales - mantenemos esta funcionalidad */}
                {contextualComments.visible &&
                  contextualComments.comments.length > 0 && (
                    <div
                      className='absolute z-20 p-2 bg-white border border-gray-200 rounded-md shadow-lg'
                      style={{
                        left: `${contextualComments.x}px`,
                        top: `${contextualComments.y}px`,
                        maxWidth: '300px',
                      }}>
                      <div className='mb-2 text-xs font-medium text-gray-700'>
                        {contextualComments.comments.length} comentario(s) en
                        esta área
                      </div>
                      <div className='space-y-2 overflow-y-auto max-h-60'>
                        {contextualComments.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className='p-2 text-xs border-b border-gray-100'>
                            <div className='font-medium'>
                              {comment.user?.name || 'Usuario'}
                            </div>
                            <div className='mt-1 text-gray-600'>
                              {comment.content}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className='flex justify-end mt-2'>
                        <button
                          onClick={() => setActiveTab('comments')}
                          className='px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700'>
                          Ver todos
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Panel lateral de comentarios */}
            {showCommentsSidebar && (
              <div className='max-h-screen p-4 overflow-y-auto transition-all duration-300 rounded-lg md:w-1/2 bg-gray-50'>
                <DocumentComments
                  documentId={id || ''}
                  currentPage={currentPage}
                  selectedText={selectedText}
                  onCommentAdded={handleCommentAdded}
                  onCommentsUpdated={(count) => {
                    setUnreadComments(count);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      );
    } else if (document.mimeType?.includes('image')) {
      return (
        <div className='flex items-center justify-center p-4 bg-gray-100 rounded-lg'>
          <img
            src={`/api/documents/${id}/view`}
            alt={document.title}
            className='object-contain max-w-full max-h-96'
          />
        </div>
      );
    } else {
      // Para otros tipos de documento
      return (
        <div className='flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg h-96'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-20 h-20 text-gray-400'
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
          <p className='mt-4 text-gray-600'>
            Previsualización no disponible para este tipo de archivo.
          </p>
          <button
            onClick={() =>
              (window.location.href = `/api/documents/${id}/download`)
            }
            className='inline-flex items-center px-4 py-2 mt-4 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
            Descargar para ver
          </button>
        </div>
      );
    }
  };

  const renderMetadataTab = () => {
    if (!document) return null;

    return (
      <div className='mt-4 overflow-hidden bg-white shadow sm:rounded-lg'>
        <div className='px-4 py-5 sm:px-6'>
          <h3 className='text-lg font-medium leading-6 text-gray-900'>
            Metadatos del documento
          </h3>
          <p className='max-w-2xl mt-1 text-sm text-gray-500'>
            Información detallada sobre el documento.
          </p>
        </div>
        <div className='border-t border-gray-200'>
          <dl>
            <div className='px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>Título</dt>
              <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                {document.title}
              </dd>
            </div>
            <div className='px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>Archivo</dt>
              <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                {document.filename}
              </dd>
            </div>
            <div className='px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>Tamaño</dt>
              <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                {formatFileSize(document.fileSize)}
              </dd>
            </div>
            <div className='px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>Tipo</dt>
              <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                {document.mimeType || 'Unknown'}
              </dd>
            </div>
            <div className='px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>Estatus</dt>
              <dd className='mt-1 sm:mt-0 sm:col-span-2'>
                <DocumentStatusBadge status={document.status} />
              </dd>
            </div>
            <div className='px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>
                Fecha creación
              </dt>
              <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                {formatDate(document.createdAt)}
              </dd>
            </div>
            <div className='px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500'>
                Última modificación
              </dt>
              <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                {formatDate(document.updatedAt)}
              </dd>
            </div>
            {document.description && (
              <div className='px-4 py-5 bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
                <dt className='text-sm font-medium text-gray-500'>
                  Descripción
                </dt>
                <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                  {document.description}
                </dd>
              </div>
            )}
            {document.metadata && Object.keys(document.metadata).length > 0 && (
              <div className='px-4 py-5 bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
                <dt className='text-sm font-medium text-gray-500'>
                  Metadatos adicionales
                </dt>
                <dd className='mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2'>
                  <pre className='p-2 overflow-auto bg-gray-100 rounded max-h-40'>
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

    if (
      !document.extractedContent ||
      Object.keys(document.extractedContent).length === 0
    ) {
      return (
        <div className='p-6 mt-4 overflow-hidden text-center bg-white shadow sm:rounded-lg'>
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
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
          <h3 className='mt-2 text-sm font-medium text-gray-900'>
            No hay contenido extraído
          </h3>
          <p className='mt-1 text-sm text-gray-500'>
            Este documento aún no ha sido procesado o no se pudo extraer
            contenido.
          </p>
          <div className='mt-6'>
            <button
              type='button'
              onClick={handleProcessDocument}
              disabled={processingDocument || document.status === 'processing'}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'>
              {processingDocument ? 'Procesando...' : 'Procesar documento'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className='mt-4 overflow-hidden bg-white shadow sm:rounded-lg'>
        <div className='px-4 py-5 sm:px-6'>
          <h3 className='text-lg font-medium leading-6 text-gray-900'>
            Extracción de contenido
          </h3>
          <p className='max-w-2xl mt-1 text-sm text-gray-500'>
            Texto e información extraídos del documento.
          </p>
        </div>
        <div className='px-4 py-5 border-t border-gray-200 sm:px-6'>
          {/* Verificar múltiples posibles ubicaciones del texto extraído */}
          {(document.extractedContent.text ||
            document.extractedContent.content ||
            document.extractedContent.extractedText) && (
            <div className='mt-2'>
              <h4 className='mb-2 text-sm font-medium text-gray-500'>
                Texto extraído:
              </h4>
              <div className='p-4 overflow-auto rounded-md bg-gray-50 max-h-96'>
                <p className='text-sm text-gray-900 whitespace-pre-wrap'>
                  {document.extractedContent.text ||
                    document.extractedContent.content ||
                    document.extractedContent.extractedText}
                </p>
              </div>
            </div>
          )}

          {/* Verificar datos estructurados */}
          {(document.extractedContent.data ||
            document.extractedContent.structuredData ||
            document.extractedContent.sheets) && (
            <div className='mt-6'>
              <h4 className='mb-2 text-sm font-medium text-gray-500'>
                Estructura:
              </h4>
              <pre className='p-4 overflow-auto text-sm rounded-md bg-gray-50 max-h-96'>
                {JSON.stringify(
                  document.extractedContent.data ||
                    document.extractedContent.structuredData ||
                    document.extractedContent.sheets,
                  null,
                  2,
                )}
              </pre>
            </div>
          )}

          {/* Mostrar mensaje si hay contenido extraído pero no en los formatos esperados */}
          {!document.extractedContent.text &&
            !document.extractedContent.content &&
            !document.extractedContent.extractedText &&
            !document.extractedContent.data &&
            !document.extractedContent.structuredData &&
            !document.extractedContent.sheets && (
              <div className='mt-2'>
                <h4 className='mb-2 text-sm font-medium text-gray-500'>
                  Contenido extraído:
                </h4>
                <pre className='p-4 overflow-auto text-sm rounded-md bg-gray-50 max-h-96'>
                  {JSON.stringify(document.extractedContent, null, 2)}
                </pre>
              </div>
            )}

          {document.extractedContent.success === false &&
          document.extractedContent.error ? (
            <div className='p-4 mt-4 border-l-4 border-red-400 bg-red-50'>
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
                  <p className='text-sm text-red-700'>
                    Error de extracción: {document.extractedContent.error}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderSignaturesTab = () => {
    if (!document || !id) return null;

    return (
      <div className='mt-4'>
        {/* Componente de gestión de firmas múltiples */}
        {multiSignatureEnabled !== false && (
          <MultiSignatureManager
            documentId={id}
            documentTitle={document.title}
            onUpdate={() => {
              // Usar fetchDocument para actualizar toda la información del documento
              fetchDocument();
              // O cargar solamente las firmas
              const fetchSignatures = async () => {
                try {
                  const response = await api.get(
                    `/api/signatures/document/${id}`,
                  );
                  setSignatures(response.data);
                } catch (err) {
                  console.error('Error loading signatures:', err);
                }
              };
              fetchSignatures();
            }}
          />
        )}

        {/* Verificación de firmas múltiples */}
        {multiSignatureEnabled !== false && signatures.length > 1 && (
          <MultiSignatureVerification
            documentId={id}
            documentTitle={document.title}
            signatures={signatures}
            onUpdate={() => {
              const fetchSignatures = async () => {
                try {
                  const response = await api.get(
                    `/api/signatures/document/${id}`,
                  );
                  setSignatures(response.data);
                } catch (err) {
                  console.error('Error loading signatures:', err);
                }
              };
              fetchSignatures();
            }}
          />
        )}

        <DocumentSignature
          documentId={id}
          documentTitle={document.title}
          documentStatus={document.status}
          onSignSuccess={handleDocumentUpdated}
          multiSignatureEnabled={true}
        />

        {/* Document Encryption Component */}
        <DocumentEncrypt
          documentId={id}
          isEncrypted={!!document.metadata?.isEncrypted}
          onEncryptSuccess={handleDocumentUpdated}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
        <div className='py-12 text-center'>
          <svg
            className='w-12 h-12 mx-auto text-gray-400 animate-spin'
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
          <p className='mt-2 text-sm font-medium text-gray-500'>
            Cargando documento...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
        <div className='overflow-hidden bg-white shadow sm:rounded-lg'>
          <div className='px-4 py-5 sm:px-6'>
            <h3 className='text-lg font-medium leading-6 text-gray-900'>
              Error
            </h3>
          </div>
          <div className='px-4 py-5 border-t border-gray-200 sm:px-6'>
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
                  <p className='text-sm font-medium text-red-800'>{error}</p>
                </div>
              </div>
            </div>
            <div className='mt-4'>
              <button
                type='button'
                onClick={() => navigate('/dashboard')}
                className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
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
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      {/* Header */}
      <div className='mb-6 overflow-hidden bg-white shadow sm:rounded-lg'>
        <div className='px-4 py-5 sm:px-6'>
          <div className='flex items-start justify-between'>
            <div>
              <h2 className='text-2xl font-bold text-gray-900'>
                {document.title}
              </h2>
              {document.description && (
                <p className='mt-1 text-sm text-gray-500'>
                  {document.description}
                </p>
              )}
              <div className='flex items-center mt-2'>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(
                    document.status,
                  )}`}>
                  {getStatusText(document.status)}
                </span>
                <span className='mx-2 text-gray-500'>•</span>
                <span className='text-sm text-gray-500'>
                  {formatFileSize(document.fileSize)}
                </span>
                <span className='mx-2 text-gray-500'>•</span>
                <span className='text-sm text-gray-500'>
                  Subido el {formatDate(document.createdAt)}
                </span>
              </div>
            </div>
            <div className='flex space-x-2'>
              <button
                type='button'
                onClick={() => navigate('/dashboard')}
                className='inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='-ml-0.5 mr-1 h-4 w-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10 19l-7-7m0 0l7-7m-7 7h18'
                  />
                </svg>
                Atrás
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='mb-6 border-b border-gray-200'>
        <nav
          className='flex -mb-px space-x-8'
          aria-label='Tabs'>
          <button
            onClick={() => setActiveTab('preview')}
            className={`${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Visualizador
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`${
              activeTab === 'metadata'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Metadatos
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`${
              activeTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Extraer contenido
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Análisis
          </button>
          <button
            onClick={() => setActiveTab('signatures')}
            className={`${
              activeTab === 'signatures'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Firmado
          </button>
          {userPermissions.canShare && (
            <button
              onClick={() => setActiveTab('sharing')}
              className={`${
                activeTab === 'sharing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
              Compartir
            </button>
          )}
          <button
            onClick={() => setActiveTab('blockchain')}
            className={`${
              activeTab === 'blockchain'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Blockchain
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'preview' && renderDocumentPreview()}
      {activeTab === 'metadata' && renderMetadataTab()}
      {activeTab === 'content' && renderContentTab()}
      {activeTab === 'analysis' && id && <DocumentAnalysis documentId={id} />}
      {activeTab === 'signatures' && renderSignaturesTab()}
      {activeTab === 'sharing' && id && (
        <DocumentSharing
          documentId={id}
          documentTitle={document?.title || ''}
          onPermissionsUpdated={() => fetchDocument()}
        />
      )}
      {activeTab === 'blockchain' && id && (
        <DocumentBlockchainVerification
          documentId={id}
          documentTitle={document?.title || 'Document'}
        />
      )}
    </div>
  );
};

export default DocumentViewer;
