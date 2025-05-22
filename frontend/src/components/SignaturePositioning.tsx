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
  const [gridSize] = useState(20);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [autoScale, setAutoScale] = useState(true);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  useEffect(() => {
    if (realDocumentBounds && pdfPageDimensions) {
      // Posicionar en la esquina inferior derecha del área real del documento
      const initialDocX = realDocumentBounds.width - signatureSize.width - 20;
      const initialDocY = realDocumentBounds.height / 3;

      // Clampar al área del documento
      const clampedPos = clampToDocument(
        initialDocX,
        initialDocY,
        signatureSize.width,
        signatureSize.height,
      );

      // Convertir a coordenadas del contenedor
      const containerX = clampedPos.x + realDocumentBounds.x;
      const containerY = clampedPos.y + realDocumentBounds.y;

      setPosition({ x: containerX, y: containerY });
    }
  }, [realDocumentBounds, signatureSize, pdfPageDimensions]);

  // Función para ajustar la escala automáticamente
  const adjustScale = () => {
    if (!containerRef.current || !pdfContainerRef.current || !autoScale) return;

    const containerWidth = containerRef.current.clientWidth;
    const pdfPageElement = pdfContainerRef.current.querySelector(
      '.react-pdf__Page canvas',
    );

    if (pdfPageElement && pdfPageDimensions) {
      // Calcular nueva escala para que el PDF se ajuste al ancho del contenedor
      const newScale = (containerWidth * 0.9) / pdfPageDimensions.width;

      // Solo actualizar si hay un cambio significativo
      if (Math.abs(newScale - scale) > 0.05) {
        setScale(newScale);
      }
    }
  };

  // Manejar evento de mouse down en la firma
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!signatureRef.current) return;

    const signatureRect = signatureRef.current.getBoundingClientRect();
    const containerRect = pdfContainerRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    // Calcular offset del mouse relativo a la esquina superior izquierda de la firma
    setDragOffset({
      x: e.clientX - signatureRect.left,
      y: e.clientY - signatureRect.top,
    });

    setIsDragging(true);
  };

  // Efectos para agregar/remover listeners globales
  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveGlobal = (e: MouseEvent) => {
        if (!realDocumentBounds || !signatureRef.current) return;

        const containerRect = pdfContainerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        // Calcular nueva posición usando el offset guardado
        const newX = e.clientX - containerRect.left - dragOffset.x;
        const newY = e.clientY - containerRect.top - dragOffset.y;

        // Convertir a coordenadas del documento
        const docCoords = containerToDocumentCoords(newX, newY);

        // Ajustar a cuadrícula si está habilitado
        let finalDocX = docCoords.x;
        let finalDocY = docCoords.y;

        if (snapToGrid) {
          finalDocX = Math.round(finalDocX / gridSize) * gridSize;
          finalDocY = Math.round(finalDocY / gridSize) * gridSize;
        }

        // Clampar al área del documento
        const clampedPos = clampToDocument(
          finalDocX,
          finalDocY,
          signatureSize.width,
          signatureSize.height,
        );

        // Convertir de vuelta a coordenadas del contenedor
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

  // Manejar clic en el documento para posicionar la firma
  const handleDocumentClick = (e: React.MouseEvent) => {
    if (isDragging || !realDocumentBounds) return;

    const containerRect = pdfContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Coordenadas relativas al contenedor
    const containerX = e.clientX - containerRect.left;
    const containerY = e.clientY - containerRect.top;

    // Convertir a coordenadas del documento
    const docCoords = containerToDocumentCoords(containerX, containerY);

    // Centrar la firma en el punto de clic
    let newX = docCoords.x - signatureSize.width / 2;
    let newY = docCoords.y - signatureSize.height / 2;

    // Verificar que está dentro del documento
    if (
      isWithinDocument(newX, newY, signatureSize.width, signatureSize.height)
    ) {
      // Ajustar a cuadrícula si está habilitado
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      // Clampar al área del documento
      const clampedPos = clampToDocument(
        newX,
        newY,
        signatureSize.width,
        signatureSize.height,
      );

      // Convertir de vuelta a coordenadas del contenedor para el posicionamiento visual
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

    const currentCanvasWidth = canvas.width;
    const currentCanvasHeight = canvas.height;

    if (!currentCanvasWidth || !currentCanvasHeight) {
      console.error('Canvas sin dimensiones válidas');
      return;
    }

    // Convertir posición del contenedor a coordenadas del documento
    const docX = position.x - realDocumentBounds.x;
    const docY = position.y - realDocumentBounds.y;

    // Calcular escalas entre canvas renderizado y PDF original
    const scaleX = pdfPageDimensions.width / realDocumentBounds.width;
    const scaleY = pdfPageDimensions.height / realDocumentBounds.height;

    // Convertir coordenadas del canvas a coordenadas PDF
    const pdfX = docX * scaleX;
    const pdfWidth = signatureSize.width * scaleX;
    const pdfHeight = signatureSize.height * scaleY;

    // Convertir Y de sistema DOM (top=0) a sistema PDF (bottom=0)
    const pdfY = pdfPageDimensions.height - docY * scaleY - pdfHeight;

    console.log('=== DEBUG CONFIRMACIÓN POSICIÓN ===');
    console.log('Container position:', position);
    console.log('Document coords:', { x: docX, y: docY });
    console.log('Document bounds:', realDocumentBounds);
    console.log('PDF original size:', pdfPageDimensions);
    console.log('Scales:', { x: scaleX, y: scaleY });
    console.log('Final PDF coords:', {
      x: Math.round(pdfX),
      y: Math.round(pdfY),
      width: Math.round(pdfWidth),
      height: Math.round(pdfHeight),
    });

    const finalPosition = {
      page: activePage,
      x: Math.round(pdfX),
      y: Math.round(pdfY),
      width: Math.round(pdfWidth),
      height: Math.round(pdfHeight),
    };

    // Verificar límites del PDF
    if (
      finalPosition.x < 0 ||
      finalPosition.y < 0 ||
      finalPosition.x + finalPosition.width > pdfPageDimensions.width ||
      finalPosition.y + finalPosition.height > pdfPageDimensions.height
    ) {
      console.warn('Firma fuera de límites del PDF:', finalPosition);

      // Ajustar a esquina inferior derecha si está fuera
      finalPosition.x = Math.max(
        0,
        pdfPageDimensions.width - finalPosition.width - 20,
      );
      finalPosition.y = Math.max(0, 20); // 20pts desde abajo

      console.log('Posición ajustada:', finalPosition);
    }

    onPositionSelected(finalPosition);
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

  // Función para obtener bounds reales del documento PDF
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

    // Calcular offset del canvas dentro del contenedor
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

  // Función para convertir coordenadas del contenedor a coordenadas del documento
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

  // Función para validar que las coordenadas están dentro del documento
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

  // Función para limitar coordenadas al área del documento
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

  // Indicador visual del área real del documento
  const renderDocumentBounds = () => {
    if (!realDocumentBounds || !showGrid) return null;

    return (
      <div
        className='absolute border-2 border-red-200 pointer-events-none'
        style={{
          left: realDocumentBounds.x,
          top: realDocumentBounds.y,
          width: realDocumentBounds.width,
          height: realDocumentBounds.height,
          zIndex: 5,
        }}
        title='Área real del documento'
      />
    );
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

          <div className='flex border border-gray-300 rounded-md'>
            <button
              className='p-1.5 rounded-l-md bg-gray-100 text-gray-600 hover:bg-gray-200'
              onClick={() => {
                setScale((prev) => Math.max(0.5, prev - 0.1));
                setAutoScale(false);
              }}
              title='Reducir zoom'>
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

            <span className='px-2 py-1.5 text-xs bg-white border-l border-r border-gray-300 min-w-16 text-center'>
              {Math.round(scale * 100)}%
            </span>

            <button
              className='p-1.5 rounded-r-md bg-gray-100 text-gray-600 hover:bg-gray-200'
              onClick={() => {
                setScale((prev) => Math.min(2, prev + 0.1));
                setAutoScale(false);
              }}
              title='Aumentar zoom'>
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

          <button
            className={`p-1.5 rounded-md ${
              autoScale
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => setAutoScale(!autoScale)}
            title={autoScale ? 'Zoom manual' : 'Zoom automático'}>
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

      {/* Información del área del documento */}
      {realDocumentBounds && pdfPageDimensions && (
        <div className='p-3 mb-4 border border-blue-200 rounded-md bg-blue-50'>
          <div className='text-xs text-blue-800'>
            <div className='flex justify-between'>
              <span>
                Área del documento: {Math.round(realDocumentBounds.width)} ×{' '}
                {Math.round(realDocumentBounds.height)}px
              </span>
              <span>
                Original: {Math.round(pdfPageDimensions.width)} ×{' '}
                {Math.round(pdfPageDimensions.height)}pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor principal con área real del documento */}
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
                />
              </Document>
            </div>
          )}

          {/* Indicador del área real del documento */}
          {renderDocumentBounds()}

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
            ✓ Área del documento detectada correctamente
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
