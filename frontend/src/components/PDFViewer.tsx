import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  documentId: string;
  onSelectionChange?: (selection: { text: string; start: number; end: number }) => void;
  onPageChange?: (page: number) => void;
}

const PDFViewer = ({ documentId, onSelectionChange, onPageChange }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set the PDF URL
    // SOLUCIÓN: En lugar de establecer una URL directa, vamos a usar un objeto options
    // para que react-pdf sepa cómo autenticar la petición
    setPdfUrl(`/api/documents/${documentId}/view`);
    setLoading(true);
  }, [documentId]);

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

  const handleZoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 3));
  const handleZoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  const handleResetZoom = () => setScale(1.2);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (text && onSelectionChange) {
      // This is a simplified version - in a real app you might need more complex handling
      // to get the actual position in the document
      onSelectionChange({
        text,
        start: 0, // Placeholder
        end: text.length // Placeholder
      });
    }
  };

  // Obtener el token de auth
  const token = localStorage.getItem('token');

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
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
            title="Zoom out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
            title="Reset zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
            title="Zoom in"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF viewer */}
      <div 
        className="p-4 overflow-auto bg-gray-100 rounded-lg"
        style={{ height: '600px' }}
        onMouseUp={handleTextSelection}
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

        {/* SOLUCIÓN: En lugar de pasar directamente la URL, usamos un objeto options */}
        <Document
          file={{
            url: pdfUrl,
            httpHeaders: {
              'Authorization': `Bearer ${token}`
            }
          }}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          className="flex justify-center"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;