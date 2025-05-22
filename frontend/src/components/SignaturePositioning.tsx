import { useState, useRef, useEffect } from 'react';
import Button from './Button';

interface SignaturePositioningProps {
  documentId: string;
  currentPage?: number;
  totalPages?: number;
  onPositionSelected: (position: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
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
    reason: 'Aprobación del documento',
  },
}: SignaturePositioningProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [signatureSize, setSignatureSize] = useState({
    width: 200,
    height: 100,
  });
  const [activePage, setActivePage] = useState(currentPage);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize] = useState(20);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Cargar PDF.js y el documento
  useEffect(() => {
    const loadPdfJs = async (): Promise<any> => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
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

  // Renderizar página cuando cambie activePage, scale o pdfDoc
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }
  }, [pdfDoc, activePage, scale]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(activePage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const viewport = page.getViewport({ scale });

      // Guardar dimensiones de la página original y renderizada
      setPdfPageDimensions({
        width: page.view[2], // ancho original en puntos PDF
        height: page.view[3], // altura original en puntos PDF
      });

      setCanvasDimensions({
        width: viewport.width,
        height: viewport.height,
      });

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

  // Posicionar firma inicialmente en la esquina inferior derecha
  useEffect(() => {
    if (canvasDimensions.width > 0 && canvasDimensions.height > 0) {
      const initialX = Math.max(
        0,
        canvasDimensions.width - signatureSize.width - 50,
      );
      const initialY = Math.max(0, canvasDimensions.height / 3);
      setPosition({ x: initialX, y: initialY });
    }
  }, [canvasDimensions, signatureSize]);

  // Manejar arrastre de firma
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        if (!pdfContainerRef.current) return;

        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        let newX = e.clientX - containerRect.left - signatureSize.width / 2;
        let newY = e.clientY - containerRect.top - 20;

        // Ajustar a cuadrícula si está habilitado
        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        // Limitar al área del canvas
        newX = Math.max(
          0,
          Math.min(newX, canvasDimensions.width - signatureSize.width),
        );
        newY = Math.max(
          0,
          Math.min(newY, canvasDimensions.height - signatureSize.height),
        );

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
  }, [isDragging, snapToGrid, gridSize, canvasDimensions, signatureSize]);

  // Manejar clic en el documento
  const handleDocumentClick = (e: React.MouseEvent) => {
    if (isDragging || !pdfContainerRef.current) return;

    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    // Verificar que el clic está dentro del canvas
    if (
      clickX >= 0 &&
      clickX <= canvasDimensions.width &&
      clickY >= 0 &&
      clickY <= canvasDimensions.height
    ) {
      let newX = clickX - signatureSize.width / 2;
      let newY = clickY - signatureSize.height / 2;

      // Ajustar a cuadrícula si está habilitado
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      // Limitar al área del canvas
      newX = Math.max(
        0,
        Math.min(newX, canvasDimensions.width - signatureSize.width),
      );
      newY = Math.max(
        0,
        Math.min(newY, canvasDimensions.height - signatureSize.height),
      );

      setPosition({ x: newX, y: newY });
    }
  };

  // Cambio de página
  const changePage = (increment: number) => {
    const newPage = activePage + increment;
    if (newPage >= 1 && newPage <= (numPages || totalPages)) {
      setActivePage(newPage);
    }
  };

  // Confirmación de la posición
  const confirmPosition = () => {
    if (
      !pdfPageDimensions ||
      !canvasDimensions.width ||
      !canvasDimensions.height
    ) {
      console.error('Dimensiones del PDF no disponibles');
      return;
    }

    // Calcular escalas entre canvas renderizado y PDF original
    const scaleX = pdfPageDimensions.width / canvasDimensions.width;
    const scaleY = pdfPageDimensions.height / canvasDimensions.height;

    // Convertir coordenadas del canvas a coordenadas PDF
    const pdfX = position.x * scaleX;
    const pdfWidth = signatureSize.width * scaleX;
    const pdfHeight = signatureSize.height * scaleY;

    // Convertir Y de sistema DOM (top=0) a sistema PDF (bottom=0)
    const pdfY = pdfPageDimensions.height - position.y * scaleY - pdfHeight;

    console.log('Confirmación de posición:', {
      canvasPos: position,
      canvasSize: canvasDimensions,
      pdfOriginalSize: pdfPageDimensions,
      scales: { x: scaleX, y: scaleY },
      finalPdfCoords: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
    });

    onPositionSelected({
      page: activePage,
      x: Math.round(pdfX),
      y: Math.round(pdfY),
      width: Math.round(pdfWidth),
      height: Math.round(pdfHeight),
    });
  };

  if (isLoading) {
    return (
      <div className='p-6 bg-white rounded-lg shadow-xl'>
        <div className='flex items-center justify-center h-64'>
          <div className='w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin'></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-6 bg-white rounded-lg shadow-xl'>
        <div className='flex flex-col items-center justify-center h-64'>
          <p className='text-red-600'>{error}</p>
          <Button
            variant='secondary'
            onClick={onCancel}
            className='mt-4'>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-6xl p-4 bg-white rounded-lg shadow-xl'>
      <div className='flex items-center justify-between pb-3 mb-4 border-b'>
        <h3 className='text-lg font-medium text-gray-800'>
          Posicionar firma en el documento
        </h3>

        <div className='flex space-x-2'>
          <button
            className={`p-1.5 rounded-md ${
              showGrid
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => setShowGrid(!showGrid)}
            title={showGrid ? 'Ocultar guías' : 'Mostrar guías'}>
            ⚏
          </button>

          <button
            className={`p-1.5 rounded-md ${
              snapToGrid
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => setSnapToGrid(!snapToGrid)}
            title={
              snapToGrid
                ? 'Desactivar ajuste a cuadrícula'
                : 'Activar ajuste a cuadrícula'
            }>
            ⊞
          </button>

          <div className='flex border border-gray-300 rounded-md'>
            <button
              className='p-1.5 rounded-l-md bg-gray-100 text-gray-600 hover:bg-gray-200'
              onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
              title='Reducir zoom'>
              -
            </button>
            <span className='px-2 py-1.5 text-xs bg-white border-l border-r border-gray-300 min-w-16 text-center'>
              {Math.round(scale * 100)}%
            </span>
            <button
              className='p-1.5 rounded-r-md bg-gray-100 text-gray-600 hover:bg-gray-200'
              onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}
              title='Aumentar zoom'>
              +
            </button>
          </div>
        </div>
      </div>

      {/* Controles de página */}
      <div className='flex justify-center mb-4'>
        <div className='flex items-center space-x-4'>
          <button
            onClick={() => changePage(-1)}
            disabled={activePage <= 1}
            className='p-2 bg-gray-100 rounded-full disabled:opacity-50 hover:bg-gray-200'>
            ←
          </button>
          <div className='px-4 py-2 bg-white border border-gray-300 rounded-md'>
            <span className='text-sm font-medium'>
              Página {activePage} de {numPages || totalPages}
            </span>
          </div>
          <button
            onClick={() => changePage(1)}
            disabled={activePage >= (numPages || totalPages)}
            className='p-2 bg-gray-100 rounded-full disabled:opacity-50 hover:bg-gray-200'>
            →
          </button>
        </div>
      </div>

      {/* Información de dimensiones */}
      {canvasDimensions.width > 0 && pdfPageDimensions && (
        <div className='p-3 mb-4 border border-blue-200 rounded-md bg-blue-50'>
          <div className='text-xs text-blue-800'>
            <div className='flex justify-between'>
              <span>
                Canvas: {Math.round(canvasDimensions.width)} ×{' '}
                {Math.round(canvasDimensions.height)}px
              </span>
              <span>
                PDF: {Math.round(pdfPageDimensions.width)} ×{' '}
                {Math.round(pdfPageDimensions.height)}pts
              </span>
            </div>
            <div className='mt-1'>
              Escala:{' '}
              {(
                (canvasDimensions.width / pdfPageDimensions.width) *
                100
              ).toFixed(1)}
              %
            </div>
          </div>
        </div>
      )}

      {/* Contenedor principal */}
      <div
        className='relative mb-4 border border-gray-300 rounded-md bg-gray-50'
        style={{ height: '500px' }}
        ref={containerRef}>
        <div
          ref={pdfContainerRef}
          className={`relative w-full h-full overflow-auto bg-white ${
            showGrid ? 'bg-grid' : ''
          }`}
          style={{
            cursor: isDragging ? 'grabbing' : 'crosshair',
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
          onClick={handleDocumentClick}>
          {/* Canvas del PDF */}
          <div className='flex justify-center p-4'>
            <canvas
              ref={canvasRef}
              className='shadow-lg'
              style={{ maxWidth: '100%' }}
            />
          </div>

          {/* Firma arrastrable */}
          <div
            ref={signatureRef}
            className={`absolute bg-white border-2 rounded px-3 py-2 transition-all duration-200 ${
              isDragging
                ? 'border-blue-500 shadow-lg cursor-grabbing scale-105'
                : 'border-blue-300 shadow cursor-grab hover:border-blue-400'
            }`}
            style={{
              left: `${position.x + 16}px`, // Offset por el padding del contenedor
              top: `${position.y + 16}px`,
              width: `${signatureSize.width}px`,
              height: `${signatureSize.height}px`,
              touchAction: 'none',
              zIndex: 10,
            }}
            onMouseDown={handleMouseDown}>
            {/* Vista previa de la firma */}
            <div className='flex flex-col justify-between h-full'>
              <div className='text-base font-medium text-blue-800'>
                {signatureData.name}
              </div>
              <div className='mt-1 text-xs text-gray-600'>
                Fecha: {signatureData.date}
              </div>
              {signatureData.reason && (
                <div className='mt-1 text-xs text-gray-600'>
                  Motivo: {signatureData.reason}
                </div>
              )}
            </div>

            {/* Controlador de redimensionamiento */}
            <div
              className='absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize rounded-tl-md opacity-70 hover:opacity-100'
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = signatureSize.width;
                const startHeight = signatureSize.height;

                const handleResizeMove = (moveEvent: MouseEvent) => {
                  const newWidth = Math.max(
                    150,
                    startWidth + (moveEvent.clientX - startX),
                  );
                  const newHeight = Math.max(
                    80,
                    startHeight + (moveEvent.clientY - startY),
                  );
                  setSignatureSize({ width: newWidth, height: newHeight });
                };

                const handleResizeUp = () => {
                  window.removeEventListener('mousemove', handleResizeMove);
                  window.removeEventListener('mouseup', handleResizeUp);
                };

                window.addEventListener('mousemove', handleResizeMove);
                window.addEventListener('mouseup', handleResizeUp);
              }}>
              ⋰
            </div>

            {/* Indicador de arrastre */}
            {isDragging && (
              <div className='absolute inset-0 flex items-center justify-center bg-blue-500 border-2 border-blue-500 rounded pointer-events-none bg-opacity-10'>
                <span className='px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md'>
                  Posicionando...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información de uso */}
      <div className='mb-4 text-sm text-gray-500'>
        <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
          <p>📍 Clic para posicionar la firma</p>
          <p>🖱️ Arrastrar para ajustar posición</p>
        </div>
        {canvasDimensions.width > 0 && (
          <div className='p-2 mt-2 text-xs text-green-700 border border-green-200 rounded bg-green-50'>
            ✓ Documento cargado correctamente
          </div>
        )}
      </div>

      {/* Controles finales */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <label className='text-sm text-gray-700'>Tamaño:</label>
          <input
            type='range'
            min='150'
            max='400'
            value={signatureSize.width}
            onChange={(e) =>
              setSignatureSize({
                width: Number(e.target.value),
                height: Number(e.target.value) / 2,
              })
            }
            className='w-24'
          />
          <span className='text-xs text-gray-500'>
            {signatureSize.width}×{signatureSize.height}px
          </span>
        </div>

        <div className='flex space-x-3'>
          <Button
            variant='secondary'
            onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant='primary'
            onClick={confirmPosition}
            disabled={!pdfPageDimensions}>
            Confirmar posición
          </Button>
        </div>
      </div>

      <style>{`
        .bg-grid {
          background-image:
            linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
};

export default SignaturePositioning;
