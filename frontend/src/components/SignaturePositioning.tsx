import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Button from './Button';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [signatureSize, setSignatureSize] = useState({
    width: 200,
    height: 100,
  });
  const [activePage, setActivePage] = useState(currentPage);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  // @ts-ignore
  const [gridSize, setGridSize] = useState(20);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [autoScale, setAutoScale] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Cargar la URL del PDF
  useEffect(() => {
    setPdfUrl(`/api/documents/${documentId}/view`);
  }, [documentId]);

  // Función para ajustar la escala automáticamente
  const adjustScale = () => {
    if (
      !containerRef.current ||
      !pdfContainerRef.current ||
      !autoScale ||
      !pdfPageDimensions
    )
      return;

    const containerWidth = containerRef.current?.clientWidth || 0;
    const pageViewport =
      pdfContainerRef.current.querySelector('.react-pdf__Page');

    if (pageViewport) {
      // Calcular nueva escala para que el PDF se ajuste al ancho del contenedor
      // Dejamos un margen del 5% para evitar scroll horizontal
      const newScale = (containerWidth * 0.95) / pdfPageDimensions.width;

      // Evitar bucles de cambio de escala limitando la frecuencia de cambios
      if (Math.abs(newScale - scale) > 0.05) {
        setScale(newScale);
      }
    }
  };

  // Inicializar la posición
  useEffect(() => {
    if (pdfPageDimensions && scale > 0) {
      // Posicionar inicialmente cerca del centro-derecha de la página, ajustado por la escala
      const initialX = Math.max(
        0,
        pdfPageDimensions.width * scale - signatureSize.width - 100 * scale,
      );
      const initialY = Math.max(0, (pdfPageDimensions.height * scale) / 3);
      setPosition({ x: initialX, y: initialY });
    }
  }, [pdfPageDimensions, scale, signatureSize.width]);

  // Ajustar escala automáticamente cuando cambie el tamaño de la ventana
  useEffect(() => {
    window.addEventListener('resize', adjustScale);
    return () => window.removeEventListener('resize', adjustScale);
  }, [scale, autoScale, pdfPageDimensions]); // Añadir dependencias

  // Manejar evento de mouse down en la firma
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Efectos para agregar/remover listeners globales
  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveGlobal = (e: MouseEvent) => {
        if (!pdfContainerRef.current || !signatureRef.current) return;

        const container = pdfContainerRef.current.getBoundingClientRect();
        const signature = signatureRef.current.getBoundingClientRect();

        // Calcular nuevas coordenadas relativas al contenedor
        let newX = e.clientX - container.left - signature.width / 2;
        let newY = e.clientY - container.top - 20;

        // Limitar al área del contenedor
        newX = Math.max(0, Math.min(newX, container.width - signature.width));
        newY = Math.max(0, Math.min(newY, container.height - signature.height));

        // Ajustar a la cuadrícula si está habilitado
        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        setPosition({ x: newX, y: newY });
      };

      const handleMouseUpGlobal = () => {
        setIsDragging(false);
      };

      window.addEventListener('mousemove', handleMouseMoveGlobal);
      window.addEventListener('mouseup', handleMouseUpGlobal);

      return () => {
        window.removeEventListener('mousemove', handleMouseMoveGlobal);
        window.removeEventListener('mouseup', handleMouseUpGlobal);
      };
    }
  }, [isDragging, snapToGrid, gridSize, scale]); // Añadir scale como dependencia

  // Manejar clic en el documento para posicionar la firma
  const handleDocumentClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const container = pdfContainerRef.current?.getBoundingClientRect();
    if (!container) return;

    let newX = e.clientX - container.left - signatureSize.width / 2;
    let newY = e.clientY - container.top - signatureSize.height / 2;

    // Limitar al área del contenedor
    newX = Math.max(0, Math.min(newX, container.width - signatureSize.width));
    newY = Math.max(0, Math.min(newY, container.height - signatureSize.height));

    // Ajustar a la cuadrícula si está habilitado
    if (snapToGrid) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    setPosition({ x: newX, y: newY });
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
    if (onPositionSelected && pdfPageDimensions && scale > 0) {
      // Desescalar las coordenadas y tamaño a las dimensiones originales del PDF
      const pdfX = position.x / scale;
      const pdfWidth = signatureSize.width / scale;

      // Calcular la coordenada Y en el sistema frontend (parte inferior de la firma)
      const pdfY_frontend_scaled = position.y + signatureSize.height;
      // Desescalar la coordenada Y
      const pdfY_frontend_original_scale = pdfY_frontend_scaled / scale;

      // Invertir la coordenada Y para el sistema de coordenadas de pdf-lib (origen abajo a la izquierda)
      const pdfY = pdfPageDimensions.height - pdfY_frontend_original_scale;
      const pdfHeight = signatureSize.height / scale; // Desescalar Altura

      console.log('Frontend: Posición en escala original PDF:', {
        page: activePage,
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
      });

      onPositionSelected({
        page: activePage,
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
      });
    } else {
      console.error(
        'Frontend: No se puede confirmar posición. pdfPageDimensions o scale no válidos.',
      );
    }
  };

  // Manejar carga del PDF
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    if (totalPages < numPages) {
      setNumPages(numPages);
    }

    // Ajustar escala después de cargar el documento
    setTimeout(adjustScale, 100);
  }

  // Manejar carga de página
  function onPageLoadSuccess(page: any) {
    // Obtener las dimensiones originales de la página del PDF
    const originalWidth = page.originalWidth;
    const originalHeight = page.originalHeight;
    setPdfPageDimensions({ width: originalWidth, height: originalHeight });

    // Ajustar escala después de cargar la página
    setTimeout(adjustScale, 100);
  }

  return (
    <div className='p-4 bg-white rounded-lg shadow-xl'>
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
            title={showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 6h16M4 12h16m-7 6h7'
              />
            </svg>
          </button>
          <button
            className={`p-1.5 rounded-md ${
              snapToGrid
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => setSnapToGrid(!setSnapToGrid)}
            title={
              snapToGrid
                ? 'Desactivar ajuste a cuadrícula'
                : 'Activar ajuste a cuadrícula'
            }>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'
              />
            </svg>
          </button>
          <button
            className={`p-1.5 rounded-md ${
              autoScale
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => setAutoScale(!autoScale)}
            title={
              autoScale
                ? 'Desactivar ajuste automático'
                : 'Activar ajuste automático'
            }>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
              />
            </svg>
          </button>
          <button
            className='p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200'
            onClick={() => {
              setScale((prev) => Math.max(0.5, prev - 0.1));
              setAutoScale(false);
            }}
            title='Reducir'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M20 12H4'
              />
            </svg>
          </button>
          <button
            className='p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200'
            onClick={() => {
              setScale((prev) => Math.min(2, prev + 0.1));
              setAutoScale(false);
            }}
            title='Ampliar'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 6v6m0 0v6m0-6h6m-6 0H6'
              />
            </svg>
          </button>
        </div>
      </div>

      <div className='flex justify-center mb-4'>
        <div className='flex items-center space-x-4'>
          <button
            onClick={() => changePage(-1)}
            disabled={activePage <= 1}
            className='p-1 bg-gray-100 rounded-full disabled:opacity-50'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-6 h-6 text-gray-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 19l-7-7 7-7'
              />
            </svg>
          </button>
          <span className='text-sm font-medium'>
            Página {activePage} de {numPages || totalPages}
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={activePage >= (numPages || totalPages)}
            className='p-1 bg-gray-100 rounded-full disabled:opacity-50'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-6 h-6 text-gray-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 5l7 7-7 7'
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        className='relative mb-4 border border-gray-300 rounded-md'
        style={{ height: '500px' }}
        ref={containerRef}>
        {/* Contenedor de documento con ajuste automático */}
        <div
          ref={pdfContainerRef}
          className={`relative w-full h-full overflow-auto bg-white ${
            showGrid ? 'bg-grid' : ''
          }`}
          style={{
            transformOrigin: 'center',
            transition: 'transform 0.2s ease-out',
            cursor: isDragging ? 'grabbing' : 'pointer',
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
          onClick={handleDocumentClick}>
          {/* Visualización del PDF */}
          {pdfUrl && (
            <div className='flex justify-center'>
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                className='w-full h-full'
                loading={
                  <div className='flex items-center justify-center w-full h-full'>
                    <div className='w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin'></div>
                  </div>
                }
                error={
                  <div className='flex flex-col items-center justify-center w-full h-full'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='w-12 h-12 text-red-500'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                      />
                    </svg>
                    <p className='mt-2 text-red-600'>Error al cargar el PDF</p>
                  </div>
                }>
                <Page
                  pageNumber={activePage}
                  scale={scale}
                  onLoadSuccess={onPageLoadSuccess}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={(containerRef.current?.clientWidth || 0) * 0.95}
                />
              </Document>
            </div>
          )}

          {/* Componente de firma arrastrable */}
          <div
            ref={signatureRef}
            className={`absolute bg-white border-2 rounded px-3 py-2 ${
              isDragging
                ? 'border-blue-500 shadow-lg cursor-grabbing'
                : 'border-blue-300 shadow cursor-grab'
            }`}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${signatureSize.width}px`,
              height: `${signatureSize.height}px`,
              touchAction: 'none',
              zIndex: 10,
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}>
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

            {/* Indicadores de arrastre */}
            <div
              className='absolute top-0 right-0 w-4 h-4 cursor-se-resize'
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
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-4 h-4 text-blue-500'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path d='M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z' />
              </svg>
            </div>

            {isDragging && (
              <div className='absolute inset-0 flex items-center justify-center bg-blue-500 border-2 border-blue-500 pointer-events-none bg-opacity-10'>
                <span className='px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md'>
                  Arrastrando
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='mb-4 text-sm text-gray-500'>
        <p className='flex items-center mb-1'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-4 h-4 mr-1 text-blue-500'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122'
            />
          </svg>
          Haga clic en cualquier lugar del documento para posicionar la firma
        </p>
        <p className='flex items-center mb-1'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-4 h-4 mr-1 text-blue-500'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M7 11.5V14m0-2.5v-6a2.5 2.5 0 015 0v6a2.5 2.5 0 01-5 0z'
            />
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M2 9h4m0 0v6a5 5 0 0010 0V9m4 0H2'
            />
          </svg>
          Arrastre la firma para ajustar su posición con precisión
        </p>
        <p className='flex items-center'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-4 h-4 mr-1 text-blue-500'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
            />
          </svg>
          Use el controlador en la esquina inferior derecha para ajustar el
          tamaño
        </p>
      </div>

      <div className='grid grid-cols-2 gap-4 sm:flex sm:justify-between'>
        <div className='col-span-2 sm:col-auto'>
          <div className='flex items-center space-x-2'>
            <label className='text-sm text-gray-700'>Tamaño:</label>
            <input
              type='range'
              min='150'
              max='400'
              value={signatureSize.width}
              onChange={(e) =>
                setSignatureSize((_) => ({
                  width: Number(e.target.value),
                  height: Number(e.target.value) / 2,
                }))
              }
              className='w-24'
            />
            <span className='text-xs text-gray-500'>
              {signatureSize.width}×{signatureSize.height}px
            </span>
          </div>
        </div>

        <div className='flex justify-end col-span-2 sm:col-auto'>
          <Button
            variant='secondary'
            onClick={onCancel}
            className='mr-2'>
            Cancelar
          </Button>
          <Button
            variant='primary'
            onClick={confirmPosition}>
            Confirmar posición
          </Button>
        </div>
      </div>

      <style>{`
        .bg-grid {
          background-image:
            linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
};

export default SignaturePositioning;
