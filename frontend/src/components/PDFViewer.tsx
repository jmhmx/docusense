import { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  documentId: string;
  annotations?: any[]; // Mantenemos la prop pero no la usamos
}

const PDFViewer = ({ documentId }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
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
            className='p-1 bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200'>
            ← Anterior
          </button>
          <span className='text-sm'>
            Página {pageNumber} de {numPages || '?'}
          </span>
          <button
            onClick={() =>
              setPageNumber((prev) => Math.min(numPages || prev, prev + 1))
            }
            disabled={numPages !== null && pageNumber >= numPages}
            className='p-1 bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200'>
            Siguiente →
          </button>
        </div>

        <div className='flex items-center space-x-2'>
          <button
            onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
            className='p-1 bg-gray-100 rounded hover:bg-gray-200'>
            -
          </button>
          <span className='text-sm text-center min-w-12'>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}
            className='p-1 bg-gray-100 rounded hover:bg-gray-200'>
            +
          </button>
        </div>
      </div>

      {/* Visor de PDF - SIN capa de anotaciones */}
      <div className='relative flex-grow overflow-auto'>
        {isLoading && (
          <div className='absolute inset-0 z-20 flex items-center justify-center bg-white bg-opacity-70'>
            <div className='w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin'></div>
          </div>
        )}

        <div className='flex justify-center'>
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
            />

            {/* NO renderizamos anotaciones - las firmas están integradas en el PDF */}
          </Document>
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
