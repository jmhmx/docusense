import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import Button from './Button';
import TextHighlighter from './TextHighlighter';
import DocumentThumbnails from './DocumentThumbnails';
import DocumentSearch from './DocumentSearch';
import DocumentAnnotations, { Annotation } from './DocumentAnnotations';
import DocumentZoomControls from './DocumentZoomControls';

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface EnhancedPDFViewerProps {
  documentId: string;
  onPageChange?: (page: number) => void;
  onSelectionChange?: (selection: { text: string; start: number; end: number }) => void;
  initialPage?: number;
  allowAnnotations?: boolean;
  allowHighlighting?: boolean;
}

interface TextHighlight {
  id: string;
  page: number;
  text: string;
  position: { top: number; left: number; width: number; height: number };
  color: string;
  created: Date;
}

const EnhancedPDFViewer: React.FC<EnhancedPDFViewerProps> = ({
  documentId,
  onPageChange,
  onSelectionChange,
  initialPage = 1,
  allowAnnotations = true,
  allowHighlighting = true,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI states
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showAnnotationsPanel, setShowAnnotationsPanel] = useState<boolean>(false);
  const [showControlsPanel, setShowControlsPanel] = useState<boolean>(true);
  
  // Document data
  const [pdfDocumentProxy, setPdfDocumentProxy] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  
  // Referencias
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  // Token para autorización
  const token = localStorage.getItem('token');

  // Efecto para actualizar cuando cambia la página inicial
  useEffect(() => {
    if (initialPage && initialPage !== pageNumber) {
      setPageNumber(initialPage);
    }
  }, [initialPage]);

  // Efecto para notificar cuando cambia la página
  useEffect(() => {
    if (onPageChange && pageNumber) {
      onPageChange(pageNumber);
    }
  }, [pageNumber, onPageChange]);

  // Cargar anotaciones y highlights del servidor
  useEffect(() => {
    const fetchAnnotationsAndHighlights = async () => {
      if (!documentId || !allowAnnotations) return;
      
      try {
        // Cargar anotaciones
        const annotationsResponse = await fetch(`/api/documents/${documentId}/annotations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (annotationsResponse.ok) {
          const data = await annotationsResponse.json();
          setAnnotations(data.annotations || []);
        }
        
        // Cargar resaltados
        const highlightsResponse = await fetch(`/api/documents/${documentId}/highlights`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (highlightsResponse.ok) {
          const data = await highlightsResponse.json();
          setHighlights(data.highlights || []);
        }
      } catch (err) {
        console.error('Error loading annotations and highlights:', err);
      }
    };
    
    fetchAnnotationsAndHighlights();
  }, [documentId, allowAnnotations, token]);

  // Callback para cuando el documento se carga exitosamente
  const onDocumentLoadSuccess = (pdf: pdfjs.PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    setPdfDocumentProxy(pdf);
    setLoading(false);
    setError(null);
  };

  // Callback para cuando hay un error al cargar el documento
  const onDocumentLoadError = (err: Error) => {
    console.error('Error cargando PDF:', err);
    setLoading(false);
    setError('No se pudo cargar el documento. Intente descargarlo.');
  };

  // Navegación básica
  const goToPreviousPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const goToNextPage = () => {
    if (numPages && pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  // Funciones de zoom
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.2);
  
  // Funciones de rotación
  const rotateClockwise = () => setRotation(prev => (prev + 90) % 360);
  const rotateCounterClockwise = () => setRotation(prev => (prev - 90 + 360) % 360);

  // Función para ajustar al ancho (simulada)
  const fitToWidth = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40; // Restar padding
    const pageWidth = 595; // Ancho estándar de una página A4 en puntos
    
    // Calcular escala para ajustar al ancho
    const newScale = containerWidth / pageWidth;
    setScale(newScale);
  }, []);

  // Función para ajustar a la página (simulada)
  const fitToPage = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerHeight = container.clientHeight - 40; // Restar padding
    const pageHeight = 842; // Alto estándar de una página A4 en puntos
    
    // Calcular escala para ajustar a la altura
    const newScale = containerHeight / pageHeight;
    setScale(newScale);
  }, []);

  // Función para manejar la creación de una anotación
  const handleCreateAnnotation = async (annotation: Omit<Annotation, 'id' | 'created'>) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...annotation,
          documentId
        })
      });
      
      if (response.ok) {
        const newAnnotation = await response.json();
        setAnnotations(prev => [...prev, newAnnotation]);
      }
    } catch (err) {
      console.error('Error creating annotation:', err);
    }
  };

  // Función para manejar la actualización de una anotación
  const handleUpdateAnnotation = async (id: string, content: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      
      if (response.ok) {
        setAnnotations(prev => 
          prev.map(a => a.id === id ? { ...a, content } : a)
        );
      }
    } catch (err) {
      console.error('Error updating annotation:', err);
    }
  };

  // Función para manejar la eliminación de una anotación
  const handleDeleteAnnotation = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/annotations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setAnnotations(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error('Error deleting annotation:', err);
    }
  };

  // Función para manejar la creación de un resaltado
  const handleHighlight = async (selection: { text: string; range: Range; rects: DOMRect[] }) => {
    const { text, rects } = selection;
    
    // Convertir coordenadas relativas a la página
    const pageRef = pageRefs.current[pageNumber];
    if (!pageRef) return;
    
    const pageRect = pageRef.getBoundingClientRect();
    
    const highlight: Omit<TextHighlight, 'id' | 'created'> = {
      page: pageNumber,
      text,
      position: {
        top: rects[0].top - pageRect.top,
        left: rects[0].left - pageRect.left,
        width: rects[0].width,
        height: rects[0].height
      },
      color: '#FFEB3B'
    };
    
    try {
      const response = await fetch(`/api/documents/${documentId}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...highlight,
          documentId
        })
      });
      
      if (response.ok) {
        const newHighlight = await response.json();
        setHighlights(prev => [...prev, newHighlight]);
      }
    } catch (err) {
      console.error('Error creating highlight:', err);
    }
  };

  // Función para navegar al resultado de una búsqueda
  const handleSearchResultClick = (result: any) => {
    setPageNumber(result.pageNumber);
    // También podríamos buscar y resaltar el texto encontrado
  };

  // Función para alternar la visualización de paneles laterales
  const togglePanel = (panel: 'thumbnails' | 'search' | 'annotations') => {
    switch (panel) {
      case 'thumbnails':
        setShowThumbnails(!showThumbnails);
        setShowSearch(false);
        setShowAnnotationsPanel(false);
        break;
      case 'search':
        setShowSearch(!showSearch);
        setShowThumbnails(false);
        setShowAnnotationsPanel(false);
        break;
      case 'annotations':
        setShowAnnotationsPanel(!showAnnotationsPanel);
        setShowThumbnails(false);
        setShowSearch(false);
        break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md" ref={containerRef}>
      {/* Barra de herramientas superior */}
      <div className="flex items-center justify-between p-2 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          {/* Botones de navegación */}
          <button
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">