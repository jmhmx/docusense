import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Signature {
  id: string;
  userId: string;
  userName?: string;
  position: {
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  signedAt: string;
  reason?: string;
  valid: boolean;
  sealData?: {
    style?: {
      color?: string;
      borderColor?: string;
      borderStyle?: string;
      shape?: string;
      backgroundColor?: string;
    };
    content?: {
      showName?: boolean;
      showDate?: boolean;
      showReason?: boolean;
      customText?: string;
    };
    image?: string;
  };
}

interface DocumentPreviewEnhancedProps {
  documentId: string;
  previewUrl: string;
  signatures: Signature[];
  totalPages: number;
  onPageChange: (page: number) => void;
  onSignatureClick?: (signature: Signature) => void;
  currentPage: number;
}

const DocumentPreviewEnhanced = ({
  documentId,
  previewUrl,
  signatures,
  totalPages,
  onPageChange,
  onSignatureClick,
  currentPage
}: DocumentPreviewEnhancedProps) => {
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSignatures, setPageSignatures] = useState<Signature[]>([]);
  const [hoveredSignature, setHoveredSignature] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Filtrar firmas por página actual
  useEffect(() => {
    setPageSignatures(signatures.filter(sig => sig.position.page === currentPage));
  }, [signatures, currentPage]);
  
  // Cargar imagen de página
  useEffect(() => {
    setIsLoading(true);
    
    const img = new Image();
    img.src = `${previewUrl}?page=${currentPage}`;
    img.onload = () => {
      setIsLoading(false);
    };
    img.onerror = () => {
      setIsLoading(false);
      // Manejar error
    };
  }, [previewUrl, currentPage]);
  
  // Configurar/quitar modo pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Funciones de zoom
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1);
  
  // Toggle modo pantalla completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  
  // Formatear fecha para mostrar
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Renderizar sello de firma con estilos personalizados
  const renderSignatureSeal = (signature: Signature) => {
    // Estilos por defecto
    const defaultStyle = {
      borderColor: '#0040A0',
      borderStyle: 'solid',
      borderWidth: '2px',
      backgroundColor: 'rgba(240, 247, 255, 0.8)',
      color: '#000000',
      borderRadius: '0',
      width: signature.position.width || 200,
      height: signature.position.height || 100,
    };
    
    // Aplicar estilos personalizados si existen
    const sealStyle = signature.sealData?.style || {};
    const contentOptions = signature.sealData?.content || {
      showName: true,
      showDate: true,
      showReason: !!signature.reason
    };
    
    // Determinar forma (border-radius)
    let borderRadius = '0';
    if (sealStyle.shape === 'round') {
      borderRadius = '12px';
    } else if (sealStyle.shape === 'circle') {
      borderRadius = '50%';
    }
    
    return (
      <div
        className={`absolute ${
          hoveredSignature === signature.id ? 'z-20' : 'z-10'
        } cursor-pointer border-2 ${
          signature.valid ? 'border-green-500' : 'border-red-500'
        }`}
        style={{
          left: `${signature.position.x}px`,
          top: `${signature.position.y}px`,
          width: `${defaultStyle.width}px`,
          height: `${defaultStyle.height}px`,
          borderColor: sealStyle.borderColor || defaultStyle.borderColor,
          borderStyle: sealStyle.borderStyle || defaultStyle.borderStyle,
          backgroundColor: sealStyle.backgroundColor || defaultStyle.backgroundColor,
          color: sealStyle.color || defaultStyle.color,
          borderRadius,
        }}
        onClick={() => onSignatureClick && onSignatureClick(signature)}
        onMouseEnter={() => setHoveredSignature(signature.id)}
        onMouseLeave={() => setHoveredSignature(null)}
      >
        <div className="relative flex items-center p-2">
          {/* Logo o Avatar */}
          {signature.sealData?.image ? (
            <img
              src={signature.sealData.image}
              alt="Logo"
              className="object-contain w-10 h-10 mr-2"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 mr-2 bg-blue-100 rounded-full">
              <span className="text-xs font-bold text-blue-800">
                {signature.userName?.substring(0, 2).toUpperCase() || 'US'}
              </span>
            </div>
          )}
          
          <div className="flex flex-col text-xs">
            {contentOptions.showName !== false && (
              <span className="font-medium">
                {signature.userName || 'Usuario'}
              </span>
            )}
            
            {contentOptions.showDate !== false && (
              <span className="text-gray-600">
                Fecha: {formatDate(signature.signedAt)}
              </span>
            )}
            
            {contentOptions.showReason !== false && signature.reason && (
              <span className="text-gray-600">
                Motivo: {signature.reason}
              </span>
            )}
            
            {contentOptions.customText && (
              <span className="mt-1 text-gray-600">
                {contentOptions.customText}
              </span>
            )}
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
        
        {/* Tooltip detallado al hacer hover */}
        <AnimatePresence>
          {hoveredSignature === signature.id && (
            <motion.div
              className="absolute left-0 z-30 p-3 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg bottom-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '250px' }}
            >
              <h4 className="mb-2 text-sm font-semibold">Detalles de la firma</h4>
              <p className="mb-1 text-xs">
                <span className="font-medium">Firmante:</span> {signature.userName || 'Usuario'}
              </p>
              <p className="mb-1 text-xs">
                <span className="font-medium">Fecha:</span> {formatDate(signature.signedAt)}
              </p>
              {signature.reason && (
                <p className="mb-1 text-xs">
                  <span className="font-medium">Motivo:</span> {signature.reason}
                </p>
              )}
              <p className="mb-1 text-xs">
                <span className="font-medium">Estado:</span>
                <span className={signature.valid ? 'text-green-600' : 'text-red-600'}>
                  {signature.valid ? ' Válida' : ' Inválida'}
                </span>
              </p>
              
              <div className="pt-2 mt-2 border-t border-gray-200">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSignatureClick && onSignatureClick(signature);
                  }}
                  className="w-full px-2 py-1 text-xs font-medium text-center text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Ver detalles completos
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
  
  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-gray-100 rounded-lg ${
        fullscreen ? 'fixed inset-0 z-50' : 'relative'
      }`}
    >
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between p-2 bg-white border-b rounded-t-lg">
        <div className="flex items-center">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 text-gray-700 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="flex items-center px-2">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) {
                  onPageChange(page);
                }
              }}
              className="w-16 px-2 py-1 text-center border border-gray-300 rounded"
            />
            <span className="ml-1 text-sm text-gray-600">/ {totalPages}</span>
          </div>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 text-gray-700 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={zoomOut}
            className="p-1 text-gray-700 border border-gray-300 rounded"
            title="Alejar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
          
          <button
            onClick={zoomIn}
            className="p-1 text-gray-700 border border-gray-300 rounded"
            title="Acercar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          
          <button
            onClick={resetZoom}
            className="p-1 text-gray-700 border border-gray-300 rounded"
            title="Restablecer zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-1 text-gray-700 border border-gray-300 rounded"
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Contenedor de visualización */}
      <div 
        className="relative flex-grow overflow-auto"
        style={{ 
          minHeight: fullscreen ? 'calc(100vh - 90px)' : '600px',
          maxHeight: fullscreen ? 'calc(100vh - 90px)' : '600px'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div 
            className="relative flex items-center justify-center min-h-full"
            style={{ padding: '20px' }}
          >
            <div
              className="relative transition-transform duration-200 origin-center"
              style={{ transform: `scale(${scale})` }}
            >
              {/* Imagen del documento */}
              <img
                src={`${previewUrl}?page=${currentPage}`}
                alt={`Página ${currentPage}`}
                className="object-contain shadow-lg"
              />
              
              {/* Renderizar firmas */}
              {pageSignatures.map(signature => renderSignatureSeal(signature))}
            </div>
          </div>
        )}
      </div>
      
      {/* Información de firmas */}
      {pageSignatures.length > 0 && (
        <div className="p-2 bg-white border-t">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{pageSignatures.length} firma(s) en esta página</span>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 mr-1 bg-green-500 rounded-full"></div>
                <span className="text-xs">Válida</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 mr-1 bg-red-500 rounded-full"></div>
                <span className="text-xs">Inválida</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPreviewEnhanced;