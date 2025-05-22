import { useState, useRef, useEffect } from 'react';

interface PDFViewerProps {
  documentId: string;
  annotations?: any[];
}

const PDFViewer = ({ documentId }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar PDF.js
  useEffect(() => {
    const loadPdfJs = async (): Promise<any> => {
      try {
        // Importar PDF.js (requiere: npm install pdfjs-dist)
        const pdfjsLib = await import('pdfjs-dist');

        // Configurar worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.js',
          import.meta.url,
        ).toString();

        return pdfjsLib;
      } catch (error) {
        console.error('Error cargando PDF.js:', error);
        throw error;
      }
    };

    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const pdfjsLib = (await loadPdfJs()) as any;

        // Cargar documento
        const loadingTask = pdfjsLib.getDocument(
          `/api/documents/${documentId}/view`,
        );
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError('No se pudo cargar el documento');
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  // Renderizar página cuando cambie pageNumber, scale o pdfDoc
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }
  }, [pdfDoc, pageNumber, scale]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const viewport = page.getViewport({ scale });

      // Configurar canvas
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Renderizar página
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Error al renderizar la página');
    }
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const goToNextPage = () => {
    if (numPages && pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  return (
    <div
      className='relative flex flex-col overflow-hidden bg-gray-100 rounded-lg'
      ref={containerRef}>
      {/* Controles */}
      <div className='flex items-center justify-between p-2 bg-white border-b'>
        <div className='flex items-center space-x-2'>
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className='p-1 bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200'>
            ← Anterior
          </button>
          <span className='text-sm'>
            Página {pageNumber} de {numPages || '?'}
          </span>
          <button
            onClick={goToNextPage}
            disabled={numPages !== null && pageNumber >= numPages}
            className='p-1 bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200'>
            Siguiente →
          </button>
        </div>

        <div className='flex items-center space-x-2'>
          <button
            onClick={zoomOut}
            className='p-1 bg-gray-100 rounded hover:bg-gray-200'>
            -
          </button>
          <span className='text-sm text-center min-w-12'>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className='p-1 bg-gray-100 rounded hover:bg-gray-200'>
            +
          </button>
          <button
            onClick={resetZoom}
            className='p-1 bg-gray-100 rounded hover:bg-gray-200'
            title='Restablecer zoom'>
            ⟲
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

        {error && (
          <div className='absolute inset-0 flex items-center justify-center bg-white'>
            <div className='p-4 text-red-700 rounded-md bg-red-50'>{error}</div>
          </div>
        )}

        <div className='flex justify-center p-4'>
          <canvas
            ref={canvasRef}
            className='max-w-full shadow-lg'
            style={{ display: isLoading || error ? 'none' : 'block' }}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
