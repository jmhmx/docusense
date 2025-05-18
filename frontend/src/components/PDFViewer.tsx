import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Annotation {
  id: string;
  position: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  user: {
    name: string;
    email?: string;
  };
  signedAt: string;
  valid: boolean;
  reason?: string;
  signature?: string;
}

interface PDFViewerProps {
  documentId: string;
  onPageChange?: (page: number) => void;
  annotations?: Annotation[];
  showAnnotationTools?: boolean;
}

const PDFViewer = ({
  documentId,
  onPageChange,
  annotations = [],
  showAnnotationTools = true,
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  // Cargar el PDF como blob para asegurar que no hay problemas de caché o CORS
  useEffect(() => {
    const fetchPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/documents/${documentId}/view?t=${Date.now()}`;
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        setPdfBlob(blob);
      } catch (err) {
        console.error('Error fetching PDF:', err);
        if (retryCount < 3) {
          setRetryCount((prev) => prev + 1);
          setTimeout(() => fetchPdf(), 1500);
          setError(
            `Error al cargar el PDF. Reintentando (${retryCount + 1}/3)...`,
          );
        } else {
          setError(
            'No se pudo cargar el PDF. Por favor, prueba a descargarlo en su lugar.',
          );
          setLoading(false);
        }
      }
    };

    fetchPdf();
  }, [documentId, retryCount, token]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    setRetryCount(0);
  };

  const onDocumentLoadError = (errorObj: Error) => {
    console.error('Error loading PDF:', errorObj);
    setLoading(false);

    if (retryCount < 3) {
      setRetryCount((prev) => prev + 1);
      setError(`Error al cargar el PDF. Reintentando (${retryCount + 1}/3)...`);
    } else {
      setError(
        'No se pudo cargar el PDF. Por favor, prueba a descargarlo en su lugar.',
      );
    }
  };

  const handlePreviousPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1;
      setPageNumber(newPage);
      if (onPageChange) onPageChange(newPage);
    }
  };

  const handleNextPage = () => {
    if (numPages && pageNumber < numPages) {
      const newPage = pageNumber + 1;
      setPageNumber(newPage);
      if (onPageChange) onPageChange(newPage);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const renderAnnotations = () => {
    if (!annotations || !showAnnotationTools) return [];

    // Filtrar anotaciones para la página actual
    const pageAnnotations = annotations.filter(
      (ann) => ann.position.page === pageNumber,
    );

    return pageAnnotations.map((annotation) => {
      const { x, y, width, height } = annotation.position;
      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${x * scale}px`,
        top: `${y * scale}px`,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        zIndex: 2,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.7)',
        border: annotation.valid
          ? '2px solid rgba(0, 128, 0, 0.5)'
          : '2px solid rgba(255, 0, 0, 0.5)',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      };

      return (
        <div
          key={annotation.id}
          style={style}
          onClick={() => handleAnnotationClick(annotation)}
          title={annotation.reason || 'Firma'}>
          {annotation.signature ? (
            <img
              src={`data:image/png;base64,${annotation.signature}`}
              alt='Firma'
              style={{
                width: '100px',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div className='flex flex-col items-center justify-center w-full h-full'>
              <div className='flex items-center justify-center flex-shrink-0 w-8 h-8 mb-1 bg-blue-100 rounded-full'>
                <span className='text-xs font-bold text-blue-800'>
                  {annotation.user.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <span className='text-xs font-medium text-gray-700'>
                {annotation.user.name}
              </span>
            </div>
          )}
        </div>
      );
    });
  };

  const handleAnnotationClick = (annotation: Annotation) => {
    console.log('Annotation clicked:', annotation);
  };

  return (
    <div className='flex flex-col p-4 bg-white rounded-lg shadow'>
      {/* Controls */}
      <div className='flex items-center justify-between mb-4 space-x-4'>
        <div className='flex items-center space-x-2'>
          <button
            onClick={handlePreviousPage}
            disabled={pageNumber <= 1}
            className='p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50'
            title='Página anterior'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z'
                clipRule='evenodd'
              />
            </svg>
          </button>
          <span className='text-sm'>
            Página {pageNumber} de {numPages || '-'}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className='p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50'
            title='Página siguiente'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>

        <div className='flex items-center space-x-2'>
          <button
            onClick={handleZoomOut}
            className='p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200'
            title='Alejar'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z'
                clipRule='evenodd'
              />
            </svg>
          </button>
          <span className='text-sm font-medium'>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className='p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200'
            title='Acercar'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF viewer */}
      <div
        className='relative p-4 overflow-auto bg-gray-100 rounded-lg'
        style={{ height: '600px' }}
        ref={pageContainerRef}>
        {loading && (
          <div className='flex items-center justify-center h-full'>
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
        )}

        {error && (
          <div className='flex flex-col items-center justify-center h-full'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-12 h-12 text-red-500'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
            <p className='mt-2 text-center text-red-600'>{error}</p>
            <button
              onClick={() => {
                window.open(`/api/documents/${documentId}/download`, '_blank');
              }}
              className='px-4 py-2 mt-4 font-medium text-white bg-blue-600 rounded hover:bg-blue-700'>
              Descargar PDF
            </button>
          </div>
        )}

        {pdfBlob && !error && (
          <div className='relative flex justify-center'>
            <Document
              file={pdfBlob}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              className='relative'
              loading={
                <div className='flex items-center justify-center w-full h-64'>
                  <div className='w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin'></div>
                </div>
              }
              options={{
                cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                cMapPacked: true,
                standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts`,
              }}>
              <Page
                key={`page_${pageNumber}_scale_${scale}`}
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className='shadow-lg'
                loading={
                  <div className='flex items-center justify-center h-64'>
                    <div className='w-12 h-12 border-4 border-blue-300 rounded-full border-t-transparent animate-spin'></div>
                  </div>
                }
                error='Error al cargar la página. Por favor inténtelo más tarde.'
              />

              {renderAnnotations()}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
