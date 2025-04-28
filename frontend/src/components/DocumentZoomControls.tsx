import { useState, useEffect } from 'react';

interface DocumentZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotateClockwise: () => void;
  onRotateCounterClockwise: () => void;
  minScale?: number;
  maxScale?: number;
  rotation?: number;
  onFitToWidth?: () => void;
  onFitToPage?: () => void;
}

const DocumentZoomControls: React.FC<DocumentZoomControlsProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRotateClockwise,
  onRotateCounterClockwise,
  minScale = 0.5,
  maxScale = 3,
  rotation = 0,
  onFitToWidth,
  onFitToPage,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [customScale, setCustomScale] = useState<string>('');

  // Actualizar el valor del input al cambiar la escala
  useEffect(() => {
    setCustomScale(Math.round(scale * 100).toString());
  }, [scale]);

  const handleCustomScaleChange = (value: string) => {
    setCustomScale(value);
  };

  const handleCustomScaleSubmit = () => {
    const numericValue = parseInt(customScale, 10);
    if (!isNaN(numericValue) && numericValue >= minScale * 100 && numericValue <= maxScale * 100) {
      const newScale = numericValue / 100;
      // Este valor se pasaría al componente padre para actualizar el zoom
      // pero por ahora sólo simulamos el cambio
      const zoomFactor = newScale / scale;
      if (zoomFactor > 1) {
        for (let i = 0; i < Math.floor(zoomFactor * 10); i++) {
          onZoomIn();
        }
      } else if (zoomFactor < 1) {
        for (let i = 0; i < Math.floor((1 / zoomFactor) * 10); i++) {
          onZoomOut();
        }
      }
    }
    setShowDropdown(false);
  };

  return (
    <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center space-x-1">
        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          disabled={scale <= minScale}
          className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Reducir zoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Current Zoom */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center px-2 py-1 text-sm text-gray-800 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            <span>{Math.round(scale * 100)}%</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          {showDropdown && (
            <div className="absolute left-0 z-10 w-48 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
              <div className="p-2">
                <div className="flex items-center mb-2">
                  <input
                    type="text"
                    value={customScale}
                    onChange={(e) => handleCustomScaleChange(e.target.value)}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-l"
                    placeholder="100"
                  />
                  <span className="px-2 py-1 text-sm border border-l-0 border-gray-300 rounded-r bg-gray-50">%</span>
                  <button
                    onClick={handleCustomScaleSubmit}
                    className="px-2 py-1 ml-2 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Ir
                  </button>
                </div>
                
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      onZoomReset();
                      setShowDropdown(false);
                    }}
                    className="block w-full px-2 py-1 text-sm text-left text-gray-700 rounded hover:bg-gray-100"
                  >
                    100% (Tamaño real)
                  </button>
                  
                  {onFitToWidth && (
                    <button
                      onClick={() => {
                        onFitToWidth();
                        setShowDropdown(false);
                      }}
                      className="block w-full px-2 py-1 text-sm text-left text-gray-700 rounded hover:bg-gray-100"
                    >
                      Ajustar al ancho
                    </button>
                  )}
                  
                  {onFitToPage && (
                    <button
                      onClick={() => {
                        onFitToPage();
                        setShowDropdown(false);
                      }}
                      className="block w-full px-2 py-1 text-sm text-left text-gray-700 rounded hover:bg-gray-100"
                    >
                      Ajustar a la página
                    </button>
                  )}
                  
                  <div className="pt-1 border-t border-gray-200">
                    {[50, 75, 100, 125, 150, 200, 300].map((percentage) => (
                      <button
                        key={percentage}
                        onClick={() => {
                          setCustomScale(percentage.toString());
                          handleCustomScaleSubmit();
                        }}
                        className="block w-full px-2 py-1 text-sm text-left text-gray-700 rounded hover:bg-gray-100"
                      >
                        {percentage}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          disabled={scale >= maxScale}
          className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Aumentar zoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Reset Zoom */}
        <button
          onClick={onZoomReset}
          className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
          title="Restablecer zoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
        
        <div className="w-px h-6 mx-1 bg-gray-300"></div>
        
        {/* Rotate Counter-Clockwise */}
        <button
          onClick={onRotateCounterClockwise}
          className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
          title="Rotar a la izquierda"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Rotate Clockwise */}
        <button
          onClick={onRotateClockwise}
          className="p-1 text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
          title="Rotar a la derecha"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Rotation Indicator */}
        <div className="px-2 py-1 ml-1 text-xs text-gray-600 bg-gray-100 rounded">
          {rotation}°
        </div>
      </div>
    </div>
  );
};

export default DocumentZoomControls;