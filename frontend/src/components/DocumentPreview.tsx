import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentPreviewProps {
  documentId: string;
  documentUrl: string;
  signatures: Array<{
    id: string;
    position: {
      page: number;
      x: number;
      y: number;
    };
    user: {
      name: string;
      email?: string;
    };
    signedAt: string;
    valid: boolean;
  }>;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSignatureClick?: (signatureId: string) => void;
}

const DocumentPreview = ({
  documentId,
  documentUrl,
  signatures,
  currentPage,
  totalPages,
  onPageChange,
  onSignatureClick
}: DocumentPreviewProps) => {
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignatureInfo, setShowSignatureInfo] = useState<string | null>(null);
  const [hoveredSignature, setHoveredSignature] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  
  // Cargar documento
  useEffect(() => {
    setIsLoading(true);
    
    const image = new Image();
    image.src = `${documentUrl}?page=${currentPage}`;
    
    image.onload = () => {
      setIsLoading(false);
    };
    
    image.onerror = () => {
      setIsLoading(false);
      // Manejar error
    };
    
    // Entrar/salir de pantalla completa
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, [documentUrl, currentPage]);
  
  // Funciones para zoom
  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };
  
  const handleZoomReset = () => {
    setScale(1);
  };
  
  // Función para navegar entre páginas
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };
  
  // Función para entrar/salir de pantalla completa
  const toggleFullScreen = () => {
    if (!documentRef.current) return;
    
    if (!document.fullscreenElement) {
      documentRef.current.requestFullscreen().catch(err => {
        console.error(`Error al intentar activar pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };
  
  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Filtrar firmas por página actual
  const pageSignatures = signatures.filter(sig => sig.position.page === currentPage);
  
  return (
    <div className="flex flex-col h-full" ref={documentRef}>
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between p-2 bg-white border-b rounded-t-lg shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Página anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="flex items-center">
            <span className="text-sm font-medium">Página</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || currentPage)}
              className="w-12 px-2 py-1 mx-2 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">de {totalPages}</span>
          </div>
          
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Página siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
            title="Alejar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          
          <button
            onClick={handleZoomIn}
            className="p-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
            title="Acercar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button
            onClick={handleZoomReset}
            className="p-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
            title="Restablecer zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button
            onClick={toggleFullScreen}
            className="p-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
            title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullScreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 5a1 1 0 00-1 1v3a1 1 0 01-2 0V4a2 2 0 012-2h4a1 1 0 010 2H5zm10 9V8a1 1 0 00-1-1h-3a1 1 0 010-2h4a2 2 0 012 2v4a1 1 0 01-2 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Contenedor del documento */}
      <div className="relative flex-1 overflow-auto" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <div className="relative">
            <div 
              className="relative transition-transform duration-200 ease-in-out origin-top-left transform"
              style={{ transform: `scale(${scale})` }}
            >
              <img 
                src={`${documentUrl}?page=${currentPage}`} 
                alt={`Página ${currentPage} del documento`}
                className="shadow-md"
              />
              
              {/* Renderizar firmas */}
              {pageSignatures.map(signature => (
                <motion.div
                  key={signature.id}
                  className={`absolute border-2 rounded shadow-sm cursor-pointer ${
                    signature.valid 
                      ? 'border-green-500 bg-green-50 bg-opacity-70' 
                      : 'border-red-500 bg-red-50 bg-opacity-70'
                  } ${hoveredSignature === signature.id ? 'z-10' : 'z-0'}`}
                  style={{
                    left: `${signature.position.x}px`,
                    top: `${signature.position.y}px`,
                    width: '300px',
                    height: '100px'
                  }}
                  onClick={() => onSignatureClick && onSignatureClick(signature.id)}
                  onMouseEnter={() => setHoveredSignature(signature.id)}
                  onMouseLeave={() => setHoveredSignature(null)}
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}
                  animate={{
                    scale: hoveredSignature === signature.id ? 1.05 : 1,
                    opacity: hoveredSignature === signature.id || !hoveredSignature ? 1 : 0.7
                  }}
                >
                  <div className="relative flex items-center p-2">
                    <div className="flex items-center justify-center w-8 h-8 mr-2 bg-blue-100 rounded-full">
                      <span className="text-xs font-bold text-blue-800">
                        {signature.user.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-gray-900">Firmado por: {signature.user.name}</span>
                      <span className="text-gray-600">Fecha: {formatDate(signature.signedAt)}</span>
                    </div>
                    
                    {/* Indicador de validez */}
                    <div className={`absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full ${
                      signature.valid ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {signature.valid ? (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  {/* Tooltip de información detallada */}
                  <AnimatePresence>
                    {hoveredSignature === signature.id && (
                      <motion.div
                        className="absolute left-0 z-20 p-3 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg bottom-full"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        style={{ width: '250px' }}
                      >
                        <h4 className="mb-2 text-sm font-semibold text-gray-900">Detalles de la firma</h4>
                        <p className="mb-1 text-xs text-gray-700">
                          <span className="font-medium">Firmante:</span> {signature.user.name}
                        </p>
                        {signature.user.email && (
                          <p className="mb-1 text-xs text-gray-700">
                            <span className="font-medium">Email:</span> {signature.user.email}
                          </p>
                        )}
                        <p className="mb-1 text-xs text-gray-700">
                          <span className="font-medium">Fecha:</span> {formatDate(signature.signedAt)}
                        </p>
                        <p className="mb-1 text-xs text-gray-700">
                          <span className="font-medium">Estado:</span> 
                          <span className={signature.valid ? 'text-green-600' : 'text-red-600'}>
                            {signature.valid ? ' Válida' : ' Inválida'}
                          </span>
                        </p>
                        <div className="pt-2 mt-2 border-t border-gray-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSignatureClick && onSignatureClick(signature.id);
                            }}
                            className="w-full px-2 py-1 text-xs font-medium text-center text-white bg-blue-600 rounded hover:bg-blue-700"
                          >
                            Ver detalles completos
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Información y leyenda de firmas */}
      {pageSignatures.length > 0 && (
        <div className="p-2 text-xs text-gray-500 border-t bg-gray-50">
          <div className="flex items-center space-x-4">
            <span className="font-medium">Firmas en esta página: {pageSignatures.length}</span>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 mr-1 bg-green-500 rounded-full"></span>
              <span>Válida</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 mr-1 bg-red-500 rounded-full"></span>
              <span>Inválida</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;