import { useState, useRef, useEffect } from 'react';
import Button from './Button';

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
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [signatureSize, setSignatureSize] = useState({ width: 200, height: 100 });
  const [activePage, setActivePage] = useState(currentPage);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  
  const containerRef = useRef(null);
  const signatureRef = useRef(null);
  
  // Inicializar la posición
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      // Posicionar inicialmente en la esquina inferior derecha
      setPosition({
        x: clientWidth - signatureSize.width - 50,
        y: clientHeight - signatureSize.height - 50
      });
    }
  }, []);
  
  // Manejar evento de mouse down en la firma
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  // Manejar movimiento del mouse
  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const signature = signatureRef.current.getBoundingClientRect();
    
    // Calcular nuevas coordenadas relativas al contenedor
    let newX = e.clientX - container.left - signature.width / 2;
    let newY = e.clientY - container.top - 20;
    
    // Limitar al área del contenedor
    newX = Math.max(0, Math.min(newX, container.width - signature.width));
    newY = Math.max(0, Math.min(newY, container.height - signature.height));
    
    setPosition({ x: newX, y: newY });
  };
  
  // Manejar soltar el mouse
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Efectos para agregar/remover listeners globales
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Cambio de página
  const changePage = (increment) => {
    const newPage = activePage + increment;
    if (newPage >= 1 && newPage <= totalPages) {
      setActivePage(newPage);
    }
  };
  
  // Confirmación de la posición
  const confirmPosition = () => {
    if (onPositionSelected) {
      onPositionSelected({
        page: activePage,
        x: position.x / scale,
        y: position.y / scale,
        width: signatureSize.width / scale,
        height: signatureSize.height / scale
      });
    }
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
      
      <div className="relative mb-4 border border-gray-300 rounded-md" style={{ height: "500px" }}>
        {/* Contenedor de documento */}
        <div 
          ref={containerRef}
          className={`relative w-full h-full overflow-hidden bg-white ${showGrid ? 'bg-grid' : ''}`} 
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease-out'
          }}
        >
          {/* Aquí iría la previsualización de la página del documento */}
          <div className="absolute inset-0">
            <img 
              src={`/api/documents/${documentId}/preview?page=${activePage}`}
              alt={`Vista previa página ${activePage}`}
              className="object-contain w-full h-full"
            />
          </div>
          
          {/* Componente de firma arrastrable */}
          <div 
            ref={signatureRef}
            className={`absolute bg-white border-2 rounded px-3 py-2 cursor-move ${
              isDragging ? 'border-blue-500 shadow-lg' : 'border-blue-300 shadow'
            }`}
            style={{ 
              left: `${position.x}px`, 
              top: `${position.y}px`,
              width: `${signatureSize.width}px`,
              touchAction: 'none'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
          >
            {/* Vista previa de la firma */}
            <div className="flex flex-col">
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
            
            {/* Indicadores de arrastre */}
            <div className="absolute top-0 left-0 w-full h-6 -mt-6 bg-blue-100 bg-opacity-50 opacity-0 pointer-events-none rounded-t-md group-hover:opacity-100">
              <div className="flex items-center justify-center h-full">
                <span className="text-xs text-blue-700">Arrastrar para posicionar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-4 text-sm text-gray-500">
        <p>• Arrastre la firma para posicionarla en el documento</p>
        <p>• Use los controles para cambiar de página y ajustar el zoom</p>
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
            <span className="text-xs text-gray-500">{signatureSize.width}px</span>
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
      
      <style jsx>{`
        .bg-grid {
          background-size: 20px 20px;
          background-image: 
            linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
};

export default SignaturePositioning;