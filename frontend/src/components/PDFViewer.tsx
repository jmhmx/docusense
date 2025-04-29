import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { api } from '../api/client';
import TextHighlighter from './TextHighlighter';
import DocumentAnnotations, { Annotation } from './DocumentAnnotations';
import DocumentZoomControls from './DocumentZoomControls';
import DocumentThumbnails from './DocumentThumbnails';
import DocumentSearch from './DocumentSearch';

// Configuración de worker para react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  documentId: string;
  onPageChange?: (page: number) => void;
  onSelectionChange?: (selection: { text: string; start: number; end: number }) => void;
  token?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  documentId,
  onPageChange,
  onSelectionChange,
  token,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState<boolean>(false);
  // @ts-ignore
  const [selectedText, setSelectedText] = useState<{ text: string; start: number; end: number } | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotationModeActive, setIsAnnotationModeActive] = useState<boolean>(false);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<'single' | 'double'>('single');
  

  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar documento
  useEffect(() => {
    const loadDocument = async () => {
      try {
        const url = `/api/documents/${documentId}/view`;
        const loadingTask = pdfjs.getDocument({
          url,
          ...(token ? { httpHeaders: { Authorization: `Bearer ${token}` } } : {})
        });
        
        const pdf = await loadingTask.promise;
        setPdfDocument(pdf);
      } catch (err) {
        console.error('Error cargando documento PDF:', err);
      }
    };
    
    loadDocument();
  }, [documentId, token]);

  // Cargar anotaciones existentes
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        const response = await api.get(`/api/documents/${documentId}/annotations`);
        setAnnotations(response.data);
      } catch (err) {
        console.error('Error cargando anotaciones:', err);
      }
    };
    
    if (documentId) {
      fetchAnnotations();
    }
  }, [documentId]);

  const onDocumentLoadSuccess = (pdf: pdfjs.PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    setIsDocumentLoaded(true);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      if (onPageChange) {
        onPageChange(page);
      }
    }
  };

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };

  const handleZoomReset = () => {
    setScale(1);
  };

  const handleRotateClockwise = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  const handleRotateCounterClockwise = () => {
    setRotation(prevRotation => (prevRotation - 90 + 360) % 360);
  };

  const handleSelectionChange = (selection: { text: string; start: number; end: number }) => {
    setSelectedText(selection);
    if (onSelectionChange) {
      onSelectionChange(selection);
    }
  };

  const handleCreateAnnotation = async (annotation: Omit<Annotation, 'id' | 'created'>) => {
    try {
      const response = await api.post(`/api/documents/${documentId}/annotations`, {
        ...annotation,
        documentId,
      });
      
      const newAnnotation = response.data;
      setAnnotations(prev => [...prev, newAnnotation]);
      return newAnnotation;
    } catch (err) {
      console.error('Error creando anotación:', err);
      return null;
    }
  };

  const handleUpdateAnnotation = async (id: string, content: string) => {
    try {
      await api.patch(`/api/documents/${documentId}/annotations/${id}`, {
        content,
      });
      
      setAnnotations(prev => 
        prev.map(ann => ann.id === id ? { ...ann, content } : ann)
      );
    } catch (err) {
      console.error('Error actualizando anotación:', err);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      await api.delete(`/api/documents/${documentId}/annotations/${id}`);
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
    } catch (err) {
      console.error('Error eliminando anotación:', err);
    }
  };

  const handleHighlight = (highlightData: { text: string; range: Range; rects: DOMRect[] }) => {
    if (isAnnotationModeActive) {
      // Crear anotación de tipo resaltado
      const annotation: Omit<Annotation, 'id' | 'created'> = {
        type: 'highlight',
        page: currentPage,
        position: { 
          x: highlightData.rects[0].left, 
          y: highlightData.rects[0].top 
        },
        content: highlightData.text,
        color: '#FFEB3B',
      };
      
      handleCreateAnnotation(annotation);
    }
  };

  // Función para ajustar al ancho
  const handleFitToWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      // Asumimos un ancho de página estándar de 595 (A4 en puntos)
      const estimatedScale = (containerWidth - 40) / 595;
      setScale(estimatedScale);
    }
  };

  // Función para ajustar a la página
  const handleFitToPage = () => {
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      // Asumimos una altura de página estándar de 842 (A4 en puntos)
      const estimatedScale = (containerHeight - 40) / 842;
      setScale(estimatedScale);
    }
  };

  // Función para manejar la navegación desde los resultados de búsqueda
  const handleSearchResultClick = (result: { pageNumber: number, text: string, matchIndex: number }) => {
    handlePageChange(result.pageNumber);
    // Aquí podríamos implementar el scroll a la posición exacta del resultado
  };
  

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg bg-gray-50">
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={(e) => handlePageChange(parseInt(e.target.value) || currentPage)}
                className="w-12 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">/ {numPages}</span>
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <DocumentZoomControls
            scale={scale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onRotateClockwise={handleRotateClockwise}
            onRotateCounterClockwise={handleRotateCounterClockwise}
            rotation={rotation}
            onFitToWidth={handleFitToWidth}
            onFitToPage={handleFitToPage}
          />
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setIsAnnotationModeActive(!isAnnotationModeActive)}
            className={`p-1 border rounded ${isAnnotationModeActive ? 'text-blue-600 border-blue-500 bg-blue-50' : 'text-gray-700 border-gray-300 bg-gray-100'}`}
            title={isAnnotationModeActive ? "Desactivar modo anotación" : "Activar modo anotación"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className='flex space-x-2'>
          {/* Botón de búsqueda */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 border rounded ${showSearch ? 'text-blue-600 border-blue-500 bg-blue-50' : 'text-gray-700 border-gray-300 bg-gray-100'}`}
            title={showSearch ? "Ocultar búsqueda" : "Mostrar búsqueda"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Botón de miniaturas */}
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-1 border rounded ${showThumbnails ? 'text-blue-600 border-blue-500 bg-blue-50' : 'text-gray-700 border-gray-300 bg-gray-100'}`}
            title={showThumbnails ? "Ocultar miniaturas" : "Mostrar miniaturas"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
            </svg>
          </button>

          {/* Botón de anotaciones */}
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`p-1 border rounded ${showAnnotations ? 'text-blue-600 border-blue-500 bg-blue-50' : 'text-gray-700 border-gray-300 bg-gray-100'}`}
            title={showAnnotations ? "Ocultar anotaciones" : "Mostrar anotaciones"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Barra de búsqueda, solo visible cuando showSearch es true */}
      {showSearch && (
        <div className="border-b border-gray-200">
          <DocumentSearch
            documentId={documentId}
            pdfDocument={pdfDocument}
            currentPage={currentPage}
            onSearchResultClick={handleSearchResultClick}
          />
        </div>
      )}      

      {/* Contenido principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel de miniaturas */}
        {showThumbnails && (
          <DocumentThumbnails
            documentId={documentId}
            totalPages={numPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            token={token}
          />
        )}
        
        {/* Panel lateral para anotaciones */}
        {showAnnotations && (
          <div className="p-4 overflow-y-auto border-r border-gray-200 w-80">
            <DocumentAnnotations
              documentId={documentId}
              annotations={annotations}
              onCreateAnnotation={handleCreateAnnotation}
              onUpdateAnnotation={handleUpdateAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              currentPage={currentPage}
            />
          </div>
        )}
        
        {/* Visor de PDF */}
        <div ref={containerRef} className="flex justify-center flex-1 overflow-auto bg-gray-200">
          <Document
            file={{
              url: `/api/documents/${documentId}/view`,
              httpHeaders: token ? { Authorization: `Bearer ${token}` } : {}
            }}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
            }
          >
            {/* Modo de visualización: una o dos páginas */}
            {layoutMode === 'single' ? (
              <TextHighlighter
                onSelectionChange={handleSelectionChange}
                onHighlight={handleHighlight}
                enabled={isAnnotationModeActive}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  rotate={rotation}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                  loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
            }
                />
              </TextHighlighter>
            ) : (
              <div className="flex space-x-4">
                {/* Página actual */}
                <TextHighlighter
                  onSelectionChange={handleSelectionChange}
                  onHighlight={handleHighlight}
                  enabled={isAnnotationModeActive}
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale * 0.8} // Reducir escala para que quepan dos páginas
                    rotate={rotation}
                    renderAnnotationLayer={false}
                    renderTextLayer={true}
                    loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
            }
                  />
                </TextHighlighter>
                
                {/* Página siguiente (si existe) */}
                {currentPage < numPages && (
                  <TextHighlighter enabled={false}>
                    <Page
                      pageNumber={currentPage + 1}
                      scale={scale * 0.8}
                      rotate={rotation}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                      loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
            }
                    />
                  </TextHighlighter>
                )}
              </div>
            )}
          </Document>
        </div>
      </div>

      {/* Barra de estado inferior */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {isDocumentLoaded ? (
            <>
              {numPages} página{numPages !== 1 ? 's' : ''} • {Math.round(scale * 100)}% •{' '}
              {rotation > 0 ? `Rotación: ${rotation}°` : 'Sin rotación'}
            </>
          ) : (
            'Cargando documento...'
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Selector de modo de visualización */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">Modo:</span>
            <button
              onClick={() => setLayoutMode('single')}
              className={`p-1 text-xs rounded ${layoutMode === 'single' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
            >
              Una página
            </button>
            <button
              onClick={() => setLayoutMode('double')}
              className={`p-1 text-xs rounded ${layoutMode === 'double' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
            >
              Dos páginas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;