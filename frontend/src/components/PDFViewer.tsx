// Componente PDFViewer.tsx actualizado

import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Annotation {
  id: string;
  position: {
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  user: {
    name: string;
    email?: string;
  };
  signedAt: string;
  valid: boolean;
  reason?: string;
}

interface PDFViewerProps {
  documentId: string;
  annotations?: Annotation[];
}

const PDFViewer = ({ documentId, annotations = [] }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // @ts-ignore
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // Obtener el tamaño de la página cuando cambie la escala o el número de página
  useEffect(() => {
    const updatePageSize = () => {
      const pageViewport = document.querySelector('.react-pdf__Page');
      if (pageViewport) {
        const rect = pageViewport.getBoundingClientRect();
        setPageSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // Pequeño retraso para asegurar que el PDF se ha renderizado
    const timer = setTimeout(updatePageSize, 200);
    return () => clearTimeout(timer);
  }, [scale, pageNumber, numPages, isLoading]);

  // Renderizar anotaciones (firmas) como overlays sobre el PDF
  const renderAnnotations = () => {
    if (!annotations || annotations.length === 0) return null;

    // Filtrar anotaciones para la página actual
    const pageAnnotations = annotations.filter(
      (anno) => anno.position.page === pageNumber,
    );

    return pageAnnotations.map((annotation) => {
      // Calcular posiciones escaladas
      const scaledX = annotation.position.x * scale;
      const scaledY = annotation.position.y * scale;
      const scaledWidth = (annotation.position.width || 200) * scale;
      const scaledHeight = (annotation.position.height || 100) * scale;

      return (
        <div
          key={annotation.id}
          className={`absolute border-2 rounded shadow-sm p-2 ${
            annotation.valid
              ? 'border-green-500 bg-green-50/80'
              : 'border-red-500 bg-red-50/80'
          }`}
          style={{
            left: `${scaledX}px`,
            top: `${scaledY}px`,
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            zIndex: 10,
          }}>
          <div className='flex items-center'>
            <div className='flex items-center justify-center flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full'>
              <span className='text-xs font-bold text-blue-800'>
                {annotation.user.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div className='flex flex-col ml-2 text-xs'>
              <span className='text-sm font-medium text-gray-900'>
                {annotation.user.name}
              </span>
              <span className='text-gray-600'>
                {new Date(annotation.signedAt).toLocaleString()}
              </span>
              {annotation.reason && (
                <span className='text-gray-600'>
                  Motivo: {annotation.reason}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  // Evento para cuando la página se renderiza
  function onPageLoadSuccess() {
    // Actualizar el tamaño de la página
    const pageViewport = document.querySelector('.react-pdf__Page');
    if (pageViewport) {
      const rect = pageViewport.getBoundingClientRect();
      setPageSize({
        width: rect.width,
        height: rect.height,
      });
    }
  }

  return (
    <div
      className='relative flex flex-col overflow-hidden bg-gray-100 rounded-lg'
      ref={containerRef}>
      {/* Controles */}
      <div className='flex items-center justify-between p-2 bg-white border-b'>
        <div className='flex items-center space-x-2'>
          <button
            onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
            disabled={pageNumber <= 1}
            className='p-1 bg-gray-100 rounded disabled:opacity-50'>
            ← Anterior
          </button>
          <span>
            Página {pageNumber} de {numPages || '?'}
          </span>
          <button
            onClick={() =>
              setPageNumber((prev) => Math.min(numPages || prev, prev + 1))
            }
            disabled={numPages !== null && pageNumber >= numPages}
            className='p-1 bg-gray-100 rounded disabled:opacity-50'>
            Siguiente →
          </button>
        </div>
        <div className='flex items-center space-x-2'>
          <button
            onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
            className='p-1 bg-gray-100 rounded'>
            -
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}
            className='p-1 bg-gray-100 rounded'>
            +
          </button>
        </div>
      </div>

      {/* Visor de PDF */}
      <div className='relative flex-grow overflow-auto'>
        {isLoading && (
          <div className='absolute inset-0 z-20 flex items-center justify-center bg-white bg-opacity-70'>
            <div className='w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin'></div>
          </div>
        )}

        <div className='flex justify-center'>
          <div className='relative'>
            <Document
              file={`/api/documents/${documentId}/view`}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error('Error loading PDF:', error);
                setError('No se pudo cargar el documento');
                setIsLoading(false);
              }}
              className='flex justify-center'>
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className='shadow-lg'
                onLoadSuccess={onPageLoadSuccess}
              />

              {/* Capa de anotaciones (firmas) */}
              {renderAnnotations()}
            </Document>
          </div>
        </div>

        {error && (
          <div className='absolute inset-0 flex items-center justify-center bg-white'>
            <div className='p-4 text-red-700 rounded-md bg-red-50'>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
