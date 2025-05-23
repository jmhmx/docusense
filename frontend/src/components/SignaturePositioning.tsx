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
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize] = useState(20);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [realDocumentBounds, setRealDocumentBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Cargar la URL del PDF
  useEffect(() => {
    setPdfUrl(`/api/documents/${documentId}/view`);
  }, [documentId]);

  // Función para calcular la escala automática
  const calculateOptimalScale = () => {
    if (!containerRef.current || !pdfPageDimensions) return 1;

    const containerWidth = containerRef.current.clientWidth - 40; // Margen
    const containerHeight = 500 - 40; // Altura fija menos margen

    const scaleX = containerWidth / pdfPageDimensions.width;
    const scaleY = containerHeight / pdfPageDimensions.height;

    // Usar la escala menor para que quepa completamente
    return Math.min(scaleX, scaleY, 1.5); // Máximo 1.5x
  };

  // Ajustar escala cuando cambian las dimensiones
  useEffect(() => {
    if (pdfPageDimensions) {
      const newScale = calculateOptimalScale();
      setScale(newScale);
    }
  }, [pdfPageDimensions]);

  // Posicionar firma inicialmente
  useEffect(() => {
    if (realDocumentBounds && pdfPageDimensions) {
      const initialDocX = realDocumentBounds.width - signatureSize.width - 20;
      const initialDocY = realDocumentBounds.height / 3;

      const clampedPos = clampToDocument(
        initialDocX,
        initialDocY,
        signatureSize.width,
        signatureSize.height,
      );

      const containerX = clampedPos.x + realDocumentBounds.x;
      const containerY = clampedPos.y + realDocumentBounds.y;

      setPosition({ x: containerX, y: containerY });
    }
  }, [realDocumentBounds, signatureSize, pdfPageDimensions]);

  // Manejar evento de mouse down en la firma
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!signatureRef.current) return;

    const signatureRect = signatureRef.current.getBoundingClientRect();
    const containerRect = pdfContainerRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    setDragOffset({
      x: e.clientX - signatureRect.left,
      y: e.clientY - signatureRect.top,
    });

    setIsDragging(true);
  };

  // Efectos para manejar arrastre
  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveGlobal = (e: MouseEvent) => {
        if (!realDocumentBounds || !signatureRef.current) return;

        const containerRect = pdfContainerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        const newX = e.clientX - containerRect.left - dragOffset.x;
        const newY = e.clientY - containerRect.top - dragOffset.y;

        const docCoords = containerToDocumentCoords(newX, newY);

        let finalDocX = docCoords.x;
        let finalDocY = docCoords.y;

        if (snapToGrid) {
          finalDocX = Math.round(finalDocX / gridSize) * gridSize;
          finalDocY = Math.round(finalDocY / gridSize) * gridSize;
        }

        const clampedPos = clampToDocument(
          finalDocX,
          finalDocY,
          signatureSize.width,
          signatureSize.height,
        );

        const finalX = clampedPos.x + realDocumentBounds.x;
        const finalY = clampedPos.y + realDocumentBounds.y;

        setPosition({ x: finalX, y: finalY });
      };

      const handleMouseUpGlobal = () => {
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });
      };

      window.addEventListener('mousemove', handleMouseMoveGlobal);
      window.addEventListener('mouseup', handleMouseUpGlobal);

      return () => {
        window.removeEventListener('mousemove', handleMouseMoveGlobal);
        window.removeEventListener('mouseup', handleMouseUpGlobal);
      };
    }
  }, [
    isDragging,
    snapToGrid,
    gridSize,
    realDocumentBounds,
    signatureSize,
    dragOffset,
  ]);

  // Manejar clic en el documento
  const handleDocumentClick = (e: React.MouseEvent) => {
    if (isDragging || !realDocumentBounds) return;

    const containerRect = pdfContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const containerX = e.clientX - containerRect.left;
    const containerY = e.clientY - containerRect.top;

    const docCoords = containerToDocumentCoords(containerX, containerY);

    let newX = docCoords.x - signatureSize.width / 2;
    let newY = docCoords.y - signatureSize.height / 2;

    if (
      isWithinDocument(newX, newY, signatureSize.width, signatureSize.height)
    ) {
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      const clampedPos = clampToDocument(
        newX,
        newY,
        signatureSize.width,
        signatureSize.height,
      );

      const finalX = clampedPos.x + (realDocumentBounds?.x || 0);
      const finalY = clampedPos.y + (realDocumentBounds?.y || 0);

      setPosition({ x: finalX, y: finalY });
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
    const canvas = pdfContainerRef.current?.querySelector(
      '.react-pdf__Page canvas',
    ) as HTMLCanvasElement;

    if (!pdfPageDimensions || !canvas || !realDocumentBounds) {
      console.error('Dimensiones del PDF o canvas no disponibles');
      return;
    }

    const docX = position.x - realDocumentBounds.x;
    const docY = position.y - realDocumentBounds.y;

    const scaleX = pdfPageDimensions.width / realDocumentBounds.width;
    const scaleY = pdfPageDimensions.height / realDocumentBounds.height;

    const pdfX = docX * scaleX;
    const pdfWidth = signatureSize.width * scaleX;
    const pdfHeight = signatureSize.height * scaleY;
    const pdfY = pdfPageDimensions.height - docY * scaleY - pdfHeight;

    const finalPosition = {
      page: activePage,
      x: Math.round(pdfX),
      y: Math.round(pdfY),
      width: Math.round(pdfWidth),
      height: Math.round(pdfHeight),
    };

    if (
      finalPosition.x < 0 ||
      finalPosition.y < 0 ||
      finalPosition.x + finalPosition.width > pdfPageDimensions.width ||
      finalPosition.y + finalPosition.height > pdfPageDimensions.height
    ) {
      finalPosition.x = Math.max(
        0,
        pdfPageDimensions.width - finalPosition.width - 20,
      );
      finalPosition.y = Math.max(0, 20);
    }

    onPositionSelected(finalPosition);
  };

  // Manejar carga del PDF
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  // Manejar carga de página
  function onPageLoadSuccess(page: any) {
    const originalWidth = page.originalWidth;
    const originalHeight = page.originalHeight;
    setPdfPageDimensions({ width: originalWidth, height: originalHeight });
  }

  // Obtener bounds del documento
  const getRealDocumentBounds = (): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null => {
    const pdfPageElement = pdfContainerRef.current?.querySelector(
      '.react-pdf__Page canvas',
    );
    if (!pdfPageElement) return null;

    const containerRect = pdfContainerRef.current?.getBoundingClientRect();
    const canvasRect = pdfPageElement.getBoundingClientRect();

    if (!containerRect) return null;

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    return {
      x: offsetX,
      y: offsetY,
      width: canvasRect.width,
      height: canvasRect.height,
    };
  };

  useEffect(() => {
    const updateBounds = () => {
      const bounds = getRealDocumentBounds();
      setRealDocumentBounds(bounds);
    };

    const timer = setTimeout(updateBounds, 300);
    return () => clearTimeout(timer);
  }, [scale, activePage, numPages, pdfPageDimensions]);

  // Funciones auxiliares
  const containerToDocumentCoords = (
    containerX: number,
    containerY: number,
  ) => {
    if (!realDocumentBounds) return { x: containerX, y: containerY };
    return {
      x: containerX - realDocumentBounds.x,
      y: containerY - realDocumentBounds.y,
    };
  };

  const isWithinDocument = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean => {
    if (!realDocumentBounds) return false;
    return (
      x >= 0 &&
      y >= 0 &&
      x + width <= realDocumentBounds.width &&
      y + height <= realDocumentBounds.height
    );
  };

  const clampToDocument = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    if (!realDocumentBounds) return { x, y };
    const clampedX = Math.max(0, Math.min(x, realDocumentBounds.width - width));
    const clampedY = Math.max(
      0,
      Math.min(y, realDocumentBounds.height - height),
    );
    return { x: clampedX, y: clampedY };
  };

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
            title={showGrid ? 'Ocultar guías' : 'Mostrar guías'}>
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
            onClick={() => setSnapToGrid(!snapToGrid)}
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
        </div>
      </div>

      {/* Controles de página */}
      <div className='flex justify-center mb-4'>
        <div className='flex items-center space-x-4'>
          <button
            onClick={() => changePage(-1)}
            disabled={activePage <= 1}
            className='p-2 bg-gray-100 rounded-full disabled:opacity-50 hover:bg-gray-200'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5 text-gray-600'
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

          <div className='px-4 py-2 bg-white border border-gray-300 rounded-md'>
            <span className='text-sm font-medium'>
              Página {activePage} de {numPages || totalPages}
            </span>
          </div>

          <button
            onClick={() => changePage(1)}
            disabled={activePage >= (numPages || totalPages)}
            className='p-2 bg-gray-100 rounded-full disabled:opacity-50 hover:bg-gray-200'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5 text-gray-600'
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

      {/* Contenedor principal - Altura fija, sin scroll */}
      <div
        className='relative mb-4 border border-gray-300 rounded-md bg-gray-50'
        style={{ height: '500px' }}
        ref={containerRef}>
        <div
          ref={pdfContainerRef}
          className={`relative w-full h-full flex items-center justify-center bg-white overflow-hidden ${
            showGrid ? 'bg-grid' : ''
          }`}
          style={{
            cursor: isDragging ? 'grabbing' : 'crosshair',
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
          onClick={handleDocumentClick}>
          {/* Visualización del PDF - Centrado y ajustado */}
          {pdfUrl && (
            <div className='flex items-center justify-center'>
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
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
                />
              </Document>
            </div>
          )}

          {/* Componente de firma arrastrable */}
          <div
            ref={signatureRef}
            className={`absolute bg-white border-2 rounded px-3 py-2 transition-all duration-200 ${
              isDragging
                ? 'border-blue-500 shadow-lg cursor-grabbing scale-105'
                : 'border-blue-300 shadow cursor-grab hover:border-blue-400'
            }`}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
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
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-3 h-3 text-white'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path d='M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z' />
              </svg>
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
                d='M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122'
              />
            </svg>
            Clic para posicionar la firma
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
                d='M7 11.5V14m0-2.5v-6a2.5 2.5 0 015 0v6a2.5 2.5 0 01-5 0z'
              />
            </svg>
            Arrastrar para ajustar posición
          </p>
        </div>
        {realDocumentBounds && (
          <div className='p-2 mt-2 text-xs text-green-700 border border-green-200 rounded bg-green-50'>
            ✓ Documento ajustado al contenedor sin scroll
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
            disabled={!realDocumentBounds}>
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
