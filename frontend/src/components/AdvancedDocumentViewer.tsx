import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import Button from './Button';

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface AdvancedDocumentViewerProps {
  documentId: string;
  onPageChange?: (page: number) => void;
  onSelectionChange?: (selection: { text: string; start: number; end: number }) => void;
  initialPage?: number;
  allowAnnotations?: boolean;
  allowHighlighting?: boolean;
}

type Annotation = {
  id: string;
  type: 'note' | 'highlight' | 'underline';
  page: number;
  position: { x: number; y: number };
  content: string;
  color: string;
  created: Date;
};

type TextHighlight = {
  id: string;
  page: number;
  text: string;
  position: { top: number; left: number; width: number; height: number };
  color: string;
  created: Date;
};

const AdvancedDocumentViewer = ({
  documentId,
  onPageChange,
  onSelectionChange,
  initialPage = 1,
  allowAnnotations = true,
  allowHighlighting = true
}: AdvancedDocumentViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedScale, setRenderedScale] = useState<number | null>(null);
  
  // Para anotaciones
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState<boolean>(false);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState<boolean>(false);
  const [newAnnotationText, setNewAnnotationText] = useState<string>('');
  const [annotationColor, setAnnotationColor] = useState<string>('#FFEB3B');

  // Para miniaturas
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [thumbnailsLoaded, setThumbnailsLoaded] = useState<{ [key: number]: boolean }>({});
  
  // Referencias
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const annotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pdfDocumentRef = useRef<any>(null);
  
  // Token para autorización
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (initialPage && initialPage !== pageNumber) {
      setPageNumber(initialPage);
    }
  }, [initialPage]);

  useEffect(() => {
    if (onPageChange && pageNumber) {
      onPageChange(pageNumber);
    }
  }, [pageNumber, onPageChange]);

  // Cargar anotaciones existentes
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/annotations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAnnotations(data.annotations || []);
          setHighlights(data.highlights || []);
        }
      } catch (err) {
        console.error('Error loading annotations:', err);
      }
    };
    
    if (documentId && allowAnnotations) {
      fetchAnnotations();
    }
  }, [documentId, allowAnnotations, token]);

  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages);
    setLoading(false);
    setError(null);
    pdfDocumentRef.current = pdf;
    
    // Pre-cargar miniaturas para las primeras páginas
    const preloadPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= preloadPages; i++) {
      loadThumbnail(i);
    }
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('Error cargando PDF:', err);
    setLoading(false);
    setError('No se pudo cargar el documento. Intente descargarlo.');
  };

  const handlePreviousPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const handleNextPage = () => {
    if (numPages && pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.2);
  
  const rotateClockwise = () => setRotation(prev => (prev + 90) % 360);
  const rotateCounterClockwise = () => setRotation(prev => (prev - 90 + 360) % 360);

  const toggleThumbnails = () => {
    setShowThumbnails(!showThumbnails);
    
    // Cargar miniaturas si es necesario
    if (!showThumbnails && numPages) {
      const visibleRange = 10; // Cargar primeras 10 páginas
      const endPage = Math.min(numPages, visibleRange);
      
      for (let i = 1; i <= endPage; i++) {
        loadThumbnail(i);
      }
    }
  };
  
  const loadThumbnail = async (pageNum: number) => {
    if (thumbnailsLoaded[pageNum] || !pdfDocumentRef.current) return;
    
    try {
      // Marcar como cargada para evitar cargarla múltiples veces
      setThumbnailsLoaded(prev => ({ ...prev, [pageNum]: true }));
    } catch (err) {
      console.error(`Error loading thumbnail for page ${pageNum}:`, err);
    }
  };

  const handleTextSelection = useCallback(() => {
    if (!allowHighlighting) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (text) {
      // Obtener posición de la selección
      const rects = range.getClientRects();
      if (rects.length === 0) return;
      
      // Usar el primer rectángulo para determinar la posición
      const rect = rects[0];
      const pageElement = pageRefs.current[pageNumber];
      
      if (!pageElement) return;
      
      const pageRect = pageElement.getBoundingClientRect();
      
      const position = {
        top: rect.top - pageRect.top,
        left: rect.left - pageRect.left,
        width: rect.width,
        height: rect.height
      };
      
      if (onSelectionChange) {
        onSelectionChange({
          text,
          start: 0, // Aproximado, se necesitaría más info del PDF
          end: text.length
        });
      }
      
      // Mostrar un menú de resaltado
      showHighlightMenu(position, text);
    }
  }, [allowHighlighting, pageNumber, onSelectionChange]);

  const showHighlightMenu = (position: any, text: string) => {
    // Aquí podríamos mostrar un menú contextual con opciones
    // para resaltar, subrayar, comentar, etc.
    
    // Por simplicidad, vamos a crear directamente un resaltado
    const newHighlight: TextHighlight = {
      id: `highlight-${Date.now()}`,
      page: pageNumber,
      text,
      position,
      color: annotationColor,
      created: new Date()
    };
    
    // Añadir el resaltado a la lista
    setHighlights(prev => [...prev, newHighlight]);
    
    // También podríamos guardar el resaltado en el servidor
    saveHighlight(newHighlight);
  };
  
  const saveHighlight = async (highlight: TextHighlight) => {
    try {
      await fetch(`/api/documents/${documentId}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(highlight)
      });
    } catch (err) {
      console.error('Error saving highlight:', err);
    }
  };

  const handleAnnotationClick = (annotationId: string) => {
    setSelectedAnnotation(prevId => prevId === annotationId ? null : annotationId);
  };
  
  const startAddingAnnotation = (event: React.MouseEvent) => {
    if (!allowAnnotations || !pageRefs.current[pageNumber]) return;
    
    const pageRect = pageRefs.current[pageNumber]!.getBoundingClientRect();
    const x = (event.clientX - pageRect.left) / scale;
    const y = (event.clientY - pageRect.top) / scale;
    
    setIsAddingAnnotation(true);
    
    // Crear una anotación temporal
    const newAnnotation: Annotation = {
      id: `temp-${Date.now()}`,
      type: 'note',
      page: pageNumber,
      position: { x, y },
      content: '',
      color: annotationColor,
      created: new Date()
    };
    
    // Añadir anotación temporal y seleccionarla para edición
    setAnnotations(prev => [...prev, newAnnotation]);
    setSelectedAnnotation(newAnnotation.id);
    setNewAnnotationText('');
  };
  
  const saveAnnotation = async () => {
    if (!selectedAnnotation || !newAnnotationText.trim()) {
      // Si no hay texto, eliminar la anotación temporal
      setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotation));
      setIsAddingAnnotation(false);
      setSelectedAnnotation(null);
      return;
    }
    
    // Actualizar la anotación con el texto ingresado
    const updatedAnnotations = annotations.map(a => 
      a.id === selectedAnnotation 
        ? { ...a, content: newAnnotationText, id: `annotation-${Date.now()}` } 
        : a
    );
    
    setAnnotations(updatedAnnotations);
    
    // Guardar en el servidor
    const annotation = updatedAnnotations.find(a => a.id === selectedAnnotation);
    if (annotation) {
      try {
        await fetch(`/api/documents/${documentId}/annotations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(annotation)
        });
      } catch (err) {
        console.error('Error saving annotation:', err);
      }
    }
    
    setIsAddingAnnotation(false);
    setSelectedAnnotation(null);
  };
  
  const cancelAddingAnnotation = () => {
    setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotation));
    setIsAddingAnnotation(false);
    setSelectedAnnotation(null);
  };

  const renderAnnotations = (pageNum: number) => {
    if (!showAnnotations) return null;
    
    const pageAnnotations = annotations.filter(a => a.page === pageNum);
    
    return pageAnnotations.map(annotation => (
      <div
        key={annotation.id}
        className={`absolute cursor-pointer z-30 ${
          selectedAnnotation === annotation.id ? 'z-40' : ''
        }`}
        style={{
          left: `${annotation.position.x}px`,
          top: `${annotation.position.y}px`,
          transform: `scale(${1/scale})`,
          transformOrigin: 'top left'
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleAnnotationClick(annotation.id);
        }}
      >
        <div 
          className="flex items-center justify-center w-6 h-6 rounded-full shadow-md"
          style={{ backgroundColor: annotation.color }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </div>
        
        {selectedAnnotation === annotation.id && (
          <div className="absolute z-50 mt-2 bg-white rounded-md shadow-lg w-60 -left-28">
            <div className="p-3">
              <div className="font-medium text-gray-800">{annotation.content}</div>
              <div className="mt-1 text-xs text-gray-500">
                {new Date(annotation.created).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    ));
  };
  
  const renderHighlights = (pageNum: number) => {
    if (!showAnnotations) return null;
    
    const pageHighlights = highlights.filter(h => h.page === pageNum);
    
    return pageHighlights.map(highlight => (
      <div
        key={highlight.id}
        className="absolute z-20 rounded-sm pointer-events-none"
        style={{
          top: `${highlight.position.top}px`,
          left: `${highlight.position.left}px`,
          width: `${highlight.position.width}px`,
          height: `${highlight.position.height}px`,
          backgroundColor: highlight.color,
          opacity: 0.3
        }}
      />
    ));
  };

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-md" ref={containerRef}>
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviousPage}
            disabled={pageNumber <= 1}
            className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="flex items-center">
            <span className="mr-1 text-sm font-medium">Página</span>
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageNumber}
              onChange={(e) => setPageNumber(parseInt(e.target.value) || 1)}
              className="w-12 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="ml-1 text-sm font-medium">de {numPages || "-"}</span>
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={zoomOut}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              title="Reducir zoom"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            
            <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
            
            <button
              onClick={zoomIn}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              title="Aumentar zoom"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            
            <button
              onClick={resetZoom}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              title="Restablecer zoom"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={rotateCounterClockwise}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              title="Rotar a la izquierda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <button
              onClick={rotateClockwise}
              className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              title="Rotar a la derecha"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {allowAnnotations && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowAnnotations(!showAnnotations)}
                className={`p-1 rounded border ${
                  showAnnotations 
                    ? 'bg-blue-100 text-blue-700 border-blue-300' 
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
                title={showAnnotations ? "Ocultar anotaciones" : "Mostrar anotaciones"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </button>
              
              <button
                onClick={() => setShowAnnotationPanel(!showAnnotationPanel)}
                className={`p-1 rounded border ${
                  showAnnotationPanel 
                    ? 'bg-blue-100 text-blue-700 border-blue-300' 
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
                title="Panel de anotaciones"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              
              <div className="relative inline-block">
                <button
                  className="flex items-center justify-center border border-gray-300 rounded-full w-7 h-7 hover:bg-gray-200"
                  style={{ backgroundColor: annotationColor }}
                  title="Color de anotación"
                >
                  <span className="sr-only">Seleccionar color</span>
                </button>
                
                <div className="absolute right-0 z-10 hidden p-2 origin-top-right bg-white rounded-md shadow-lg top-8 w-52 ring-1 ring-black ring-opacity-5">
                  <div className="grid grid-cols-5 gap-2">
                    {['#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336', 
                      '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', 
                      '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A'].map(color => (
                      <button
                        key={color}
                        className="w-8 h-8 transition-transform transform border border-gray-300 rounded-full hover:scale-110"
                        style={{ backgroundColor: color }}
                        onClick={() => setAnnotationColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleThumbnails}
            className={`p-1 rounded border ${
              showThumbnails 
                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
            title="Miniaturas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Contenedor principal */}
      <div className="flex flex-1">
        {/* Panel de miniaturas */}
        {showThumbnails && (
          <div className="w-64 p-2 overflow-y-auto border-r border-gray-200">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Miniaturas</h3>
            <div className="space-y-2">
              {numPages && Array.from(new Array(numPages), (_, index) => (
                <div 
                  key={`thumb-${index + 1}`}
                  className={`p-1 border rounded cursor-pointer ${
                    pageNumber === index + 1 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setPageNumber(index + 1)}
                >
                  <div className="relative">
                    <Document
                      file={{
                        url: `/api/documents/${documentId}/view`,
                        httpHeaders: { Authorization: `Bearer ${token}` }
                      }}
                      loading={<div className="bg-gray-100 h-28 animate-pulse"></div>}
                    >
                      <Page 
                        pageNumber={index + 1} 
                        width={150}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                      />
                    </Document>
                    <div className="absolute bottom-0 right-0 px-1 text-xs text-white bg-gray-700 rounded-tl">
                      {index + 1}