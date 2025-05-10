import { useState, useEffect, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

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
  signature?: string; // base64 de la firma
}

interface PDFViewerProps {
  documentId: string;
  onPageChange?: (page: number) => void;
  annotations?: Annotation[];
}

const PDFViewer = ({
  documentId,
  onPageChange,
  annotations = [],
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  //@ts-ignore
  const [scale, setScale] = useState<number>(1.2);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');
  const [signatureOverlayVisible, setSignatureOverlayVisible] = useState<boolean>(true);

  useEffect(() => {
    setPdfUrl(`/api/documents/${documentId}/view`);
    setLoading(true);
  }, [documentId]);

  // Detectar si las firmas deben ser visibles (controlado por PDFAnnotationManager)
  useEffect(() => {
    const checkSignatureVisibility = () => {
      const visibilityInput = document.getElementById('signatures-visible');
      if (visibilityInput) {
        const isVisible = visibilityInput.value === 'true';
        setSignatureOverlayVisible(isVisible);
      }
    };

    // Verificar inicialmente
    checkSignatureVisibility();

    // Configurar un observador de mutación para detectar cambios en el valor
    const observer = new MutationObserver(checkSignatureVisibility);
    const visibilityInput = document.getElementById('signatures-visible');
    if (visibilityInput) {
      observer.observe(visibilityInput, { attributes: true });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setLoading(false);
    setError('Failed to load the PDF. Please try downloading it instead.');
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

  const renderAnnotations = () => {
    if (!annotations) return [];

    // Filtrar anotaciones para la página actual y solo mostrar si la capa está visible
    if (!signatureOverlayVisible) return [];

    const pageAnnotations = annotations.filter(ann => ann.position.page === pageNumber);

    return pageAnnotations.map(annotation => {
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
        background: 'rgba(240, 247, 255, 0.8)',
        border: '2px solid #0066cc',
        borderRadius: '4px',
      };

      return (
        <div
          key={annotation.id}
          style={style}
          onClick={() => handleAnnotationClick(annotation)}
          title={annotation.reason || 'Signature'}
        >
          <div className="p-2 text-xs">
            <p className="font-bold">{annotation.user.name}</p>
            <p>{new Date(annotation.signedAt).toLocaleDateString()}</p>
            {annotation.reason && <p>{annotation.reason}</p>}
          </div>
        </div>
      );
    });
  };

  const handleAnnotationClick = (annotation: Annotation) => {
    console.log('Annotation clicked:', annotation);
  };

  return (
    <div className="flex flex-col p-4 bg-white rounded-lg shadow">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 space-x-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviousPage}
            disabled={pageNumber <= 1}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Previous page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm">
            Page {pageNumber} of {numPages || '-'}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Next page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF viewer */}
      <div
        className="relative p-4 overflow-auto bg-gray-100 rounded-lg"
        style={{ height: '600px' }}
        ref={pageContainerRef}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <svg className="w-10 h-10 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="mt-2 text-red-600">{error}</p>
          </div>
        )}

        <div className="relative flex justify-center">
          <Document
            file={{
              url: pdfUrl,
              httpHeaders: {
                'Authorization': `Bearer ${token}`
              }
            }}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            className="relative"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />

            {/* Render annotations */}
            {renderAnnotations()}
          </Document>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;