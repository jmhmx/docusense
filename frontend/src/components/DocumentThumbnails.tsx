import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

interface DocumentThumbnailsProps {
  documentId: string;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  token?: string;
}

const DocumentThumbnails: React.FC<DocumentThumbnailsProps> = ({
  documentId,
  totalPages,
  currentPage,
  onPageChange,
  token,
}) => {
  const [thumbnailsLoaded, setThumbnailsLoaded] = useState<{ [key: number]: boolean }>({});
  const [visibleRange, setVisibleRange] = useState<[number, number]>([1, 10]);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Calcular el rango visible basado en la posición de desplazamiento
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollPosition(target.scrollTop);
      
      // Calculamos las miniaturas visibles basadas en el scroll
      const thumbnailHeight = 150; // Altura aproximada de cada miniatura
      const startIdx = Math.max(1, Math.floor(target.scrollTop / thumbnailHeight));
      const visibleCount = Math.ceil(target.clientHeight / thumbnailHeight);
      const endIdx = Math.min(totalPages, startIdx + visibleCount + 2); // +2 para pre-carga
      
      setVisibleRange([startIdx, endIdx]);
      
      // Cargar miniaturas en el rango visible
      for (let i = startIdx; i <= endIdx; i++) {
        loadThumbnail(i);
      }
    };
    
    // Agregar evento de scroll al contenedor
    const container = document.getElementById('thumbnails-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      // Cargar miniaturas iniciales
      const initialVisibleCount = Math.ceil(container.clientHeight / 150);
      const initialEndIdx = Math.min(totalPages, 1 + initialVisibleCount + 2);
      setVisibleRange([1, initialEndIdx]);
      
      for (let i = 1; i <= initialEndIdx; i++) {
        loadThumbnail(i);
      }
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [totalPages]);

  const loadThumbnail = (pageNum: number) => {
    // Marcar la miniatura como cargada
    if (!thumbnailsLoaded[pageNum]) {
      setThumbnailsLoaded(prev => ({ ...prev, [pageNum]: true }));
    }
  };

  const scrollToThumbnail = (page: number) => {
    const container = document.getElementById('thumbnails-container');
    if (!container) return;
    
    const thumbnailHeight = 150; // Altura aproximada de cada miniatura con padding
    const newScrollPos = (page - 1) * thumbnailHeight;
    
    container.scrollTo({
      top: newScrollPos,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    // Al cambiar la página, scroll a la miniatura correspondiente
    scrollToThumbnail(currentPage);
  }, [currentPage]);

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50">
      <div className="p-2 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">Miniaturas</h3>
      </div>
      
      <div 
        id="thumbnails-container"
        className="h-[calc(100vh-12rem)] overflow-y-auto pb-4"
      >
        {Array.from(new Array(totalPages), (_, index) => {
          const pageNum = index + 1;
          const isVisible = pageNum >= visibleRange[0] && pageNum <= visibleRange[1];
          
          // Solo renderizamos las miniaturas visibles para mejor rendimiento
          return (
            <div 
              key={`thumb-${pageNum}`}
              className={`p-2 mx-2 my-2 transition-all ${
                currentPage === pageNum 
                  ? 'border-blue-500 bg-blue-50 border-2 rounded-md' 
                  : 'border border-gray-300 hover:border-blue-300 bg-white rounded'
              }`}
              onClick={() => onPageChange(pageNum)}
            >
              <div className="relative">
                {isVisible ? (
                  <Document
                    file={{
                      url: `/api/documents/${documentId}/view`,
                      httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined
                    }}
                    loading={<div className="h-24 bg-gray-100 animate-pulse"></div>}
                  >
                    <Page 
                      pageNumber={pageNum} 
                      width={140}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={<div className="h-24 bg-gray-100 animate-pulse"></div>}
                    />
                  </Document>
                ) : (
                  <div className="flex items-center justify-center h-24 bg-gray-100">
                    <span className="text-gray-400">Página {pageNum}</span>
                  </div>
                )}
                <div className="absolute bottom-0 right-0 px-2 py-1 text-xs text-white bg-gray-700 rounded-tl">
                  {pageNum}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Miniatura flotante para navegación rápida */}
      <div className="sticky bottom-0 flex justify-between p-2 bg-white border-t border-gray-200">
        <button
          onClick={() => {
            if (currentPage > 1) {
              onPageChange(currentPage - 1);
            }
          }}
          disabled={currentPage <= 1}
          className="p-1 text-gray-600 bg-gray-100 rounded disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        
        <div className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded">
          {currentPage} / {totalPages}
        </div>
        
        <button
          onClick={() => {
            if (currentPage < totalPages) {
              onPageChange(currentPage + 1);
            }
          }}
          disabled={currentPage >= totalPages}
          className="p-1 text-gray-600 bg-gray-100 rounded disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DocumentThumbnails;