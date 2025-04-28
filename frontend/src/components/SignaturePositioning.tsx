import { useState, useRef, useEffect } from 'react';
import Button from './Button';

interface SignaturePositioningProps {
  documentId: string;
  currentPage?: number;
  totalPages?: number;
  onPositionSelected: (position: {page: number, x: number, y: number, width: number, height: number}) => void;
  onCancel: () => void;
  signatureData?: {
    name: string;
    date: string;
    reason?: string;
  };
}

const SignaturePositioning = ({ 
  documentId, 
  currentPage = 1, 
  totalPages = 1,
  onPositionSelected,
  onCancel,
  signatureData = {
    name: 'Usuario Actual',
    date: new Date().toLocaleDateString(),
    reason: 'Aprobación del documento'
  }
}: SignaturePositioningProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [signatureSize, setSignatureSize] = useState({ width: 200, height: 100 });
  const [activePage, setActivePage] = useState(currentPage);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLImageElement>(null);
  
  // Inicializar posición en un área inteligente
  useEffect(() => {
    if (containerRef.current && documentRef.current) {
      // Esperar a que la imagen del documento esté cargada
      const checkImage = () => {
        if (documentRef.current?.complete) {
          const docWidth = documentRef.current.width;
          const docHeight = documentRef.current.height;
          
          // Colocar la firma en la esquina inferior derecha por defecto
          // pero con espacio para verse completamente
          setPosition({
            x: Math.max(30, docWidth - signatureSize.width - 50),
            y: Math.max(30, docHeight - signatureSize.height - 50)
          });
        } else {
          setTimeout(checkImage, 100);
        }
      };
      
      checkImage();
    }
  }, [signatureSize]);
  
  // Efecto para manejar el arrastre global
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current || !signatureRef.current) return;
        
        const container = containerRef.current.getBoundingClientRect();
        const signature = signatureRef.current.getBoundingClientRect();
        
        // Calcular la posición relativa al contenedor
        let newX = (e.clientX - container.left - signature.width / 2) / scale;
        let newY = (e.clientY - container.top - 20) / scale;
        
        // Aplicar snap to grid si está activado
        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }
        
        // Limitar al área del documento
        if (documentRef.current) {
          const docWidth = documentRef.current.width;
          const docHeight = documentRef.current.height;
          
          newX = Math.max(0, Math.min(newX, docWidth - signatureSize.width));
          newY = Math.max(0, Math.min(newY, docHeight - signatureSize.height));
        }
        
        setPosition({ x: newX, y: newY });
      };
      
      const handleMouseUp = () => {
        setIsDragging(false);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, scale, snapToGrid, gridSize, signatureSize]);
  
  // Cambio de página
  const changePage = (increment: number) => {
    const newPage = activePage + increment;
    if (newPage >= 1 && newPage <= totalPages) {
      setActivePage(newPage);
    }
  };
  
  // Confirmación de posición
  const confirmPosition = () => {
    onPositionSelected({
      page: activePage,
      x: position.x,
      y: position.y,
      width: signatureSize.width,
      height: signatureSize.height
    });
  };
  
  // Renderizar guías de alineación
  const renderGuides = () => {
    if (!showGuides || !containerRef.current || !documentRef.current) return null;
    
    const docWidth = documentRef.current.width;
    const docHeight = documentRef.current.height;
    
    const centerX = position.x + signatureSize.width / 2;
    const centerY = position.y + signatureSize.height / 2;
    
    // Verificar si está alineado con el centro
    const isHCentered = Math.abs(centerX - docWidth / 2) < 10;
    const isVCentered = Math.abs(centerY - docHeight / 2) < 10;
    
    return (
      <>
        {/* Guía horizontal */}
        {isHCentered && (
          <div 
            className="absolute left-0 right-0 z-10 border-t-2 border-blue-500 border-dashed pointer-events-none"
            style={{ 
              top: `${docHeight / 2}px`,
              opacity: 0.6
            }}
          />
        )}
        
        {/* Guía vertical */}
        {isVCentered && (
          <div 
            className="absolute top-0 bottom-0 z-10 border-l-2 border-blue-500 border-dashed pointer-events-none"
            style={{ 
              left: `${docWidth / 2}px`,
              opacity: 0.6
            }}
          />
        )}
      </>
    );
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-4 border-b">
        <h3 className="text-lg font-medium text-gray-800">Posicionar firma en el documento</h3>
        <div className="flex space-x-2">
          <button 
            className={`p-1.5 rounded-md ${showGrid ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setShowGrid(!showGrid)}
            title={showGrid ? "Ocultar cuadrícula" : "Mostrar cuadrícula"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          
          <button 
            className={`p-1.5 rounded-md ${snapToGrid ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setSnapToGrid(!snapToGrid)}
            title={snapToGrid ? "Desactivar ajuste a cuadrícula" : "Activar ajuste a cuadrícula"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </button>
          
          <button 
            className={`p-1.5 rounded-md ${showGuides ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setShowGuides(!showGuides)}
            title={showGuides ? "Ocultar guías" : "Mostrar guías"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15v4c0 1.1.9 2 2 2h4M17 21h4c1.1 0 2-.9 2-2v-4M21 7V3m0 0h-4M3 3h4m0 0v4" />
            </svg>
          </button>
          
          <button 
            className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
            onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
            title="Reducir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <button 
            className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
            onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
            title="Ampliar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex justify-center mb-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => changePage(-1)} 
            disabled={activePage <= 1}
            className="p-1 bg-gray-100 rounded-full disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium">
            Página {activePage} de {totalPages}
          </span>
          <button 
            onClick={() => changePage(1)} 
            disabled={activePage >= totalPages}
            className="p-1 bg-gray-100 rounded-full disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="relative mb-4 overflow-hidden border border-gray-300 rounded-md" style={{ height: "500px" }}>
        <div 
          ref={containerRef}
          className={`relative w-full h-full overflow-auto bg-white transition-all duration-300 ${showGrid ? 'bg-grid' : ''}`} 
        >
          <div
            className="relative transition-transform duration-300 origin-center"
            style={{ transform: `scale(${scale})` }}
          >
            <img 
              ref={documentRef}
              src={`/api/documents/${documentId}/preview?page=${activePage}`}
              alt={`Vista previa página ${activePage}`}
              className="object-contain"
            />
            
            {renderGuides()}
            
            <div 
              ref={signatureRef}
              className={`absolute bg-white border-2 rounded px-3 py-2 cursor-move ${
                isDragging ? 'border-blue-500 shadow-lg z-20' : 'border-blue-300 shadow z-10'
              }`}
              style={{ 
                left: `${position.x}px`, 
                top: `${position.y}px`,
                width: `${signatureSize.width}px`,
                height: `${signatureSize.height}px`,
                touchAction: 'none'
              }}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
            >
              <div className="flex flex-col justify-between h-full">
                <div>
                  <div className="text-base font-medium text-blue-800">
                    {signatureData.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Fecha: {signatureData.date}
                  </div>
                  {signatureData.reason && (
                    <div className="mt-1 text-xs text-gray-600">
                      Motivo: {signatureData.reason}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <div className="flex items-center text-xs text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Arrastrar para mover
                  </div>
                </div>
              </div>
              
              {/* Controles de redimensionamiento */}
              <div 
                className="absolute bottom-0 right-0 w-4 h-4 transform translate-x-1/2 translate-y-1/2 bg-blue-400 rounded-full cursor-se-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startWidth = signatureSize.width;
                  const startHeight = signatureSize.height;
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    const deltaX = (e.clientX - startX) / scale;
                    const deltaY = (e.clientY - startY) / scale;
                    
                    const newWidth = Math.max(150, startWidth + deltaX);
                    const newHeight = Math.max(80, startHeight + deltaY);
                    
                    setSignatureSize({ width: newWidth, height: newHeight });
                  };
                  
                  const handleMouseUp = () => {
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-4 text-sm text-gray-500">
        <p>• Arrastre la firma para posicionarla en el documento</p>
        <p>• Use el punto azul en la esquina inferior derecha para redimensionar</p>
        <p>• Active/desactive la cuadrícula y el ajuste para una colocación precisa</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 sm:flex sm:justify-between">
        <div className="col-span-2 sm:col-auto">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">Ancho:</label>
            <input
              type="range"
              min="150"
              max="300"
              value={signatureSize.width}
              onChange={(e) => setSignatureSize(prev => ({ ...prev, width: Number(e.target.value) }))}
              className="w-24"
            />
            <span className="text-xs text-gray-500">{Math.round(signatureSize.width)}px</span>
          </div>
          
          <div className="flex items-center mt-2 space-x-2">
            <label className="text-sm text-gray-700">Alto:</label>
            <input
              type="range"
              min="80"
              max="200"
              value={signatureSize.height}
              onChange={(e) => setSignatureSize(prev => ({ ...prev, height: Number(e.target.value) }))}
              className="w-24"
            />
            <span className="text-xs text-gray-500">{Math.round(signatureSize.height)}px</span>
          </div>
        </div>
        
        <div className="flex justify-end col-span-2 sm:col-auto">
          <Button variant="secondary" onClick={onCancel} className="mr-2">
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmPosition}>
            Confirmar posición
          </Button>
        </div>
      </div>
      
      <style >{`
        .bg-grid {
          background-size: ${gridSize}px ${gridSize}px;
          background-image: 
            linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
};

export default SignaturePositioning;