// Mejorado el componente para generar una imagen de mejor calidad

import { useState, useRef, useEffect } from 'react';
import Button from './Button';

interface FirmaAutografaProps {
  onSave: (firmaBase64: string) => void;
  onCancel: () => void;
  userName: string;
}

const FirmaAutografa = ({
  onSave,
  onCancel,
  userName,
}: FirmaAutografaProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Inicializar canvas con una resolución alta para mejor calidad de firma
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Obtener el contexto del canvas con alta calidad
      const context = canvas.getContext('2d', {
        alpha: true,
        desynchronized: false,
        colorSpace: 'srgb',
      });

      if (context) {
        // Escalar y configurar el canvas para alta resolución
        const setupCanvas = () => {
          const container = canvas.parentElement;
          if (container) {
            // Usar un factor de escala alto para mejorar calidad (2x o 3x típicamente)
            const scale = 3; // Aumentamos la escala para mayor resolución
            const containerWidth = container.clientWidth;
            const containerHeight = 200; // Altura fija

            // Configurar el tamaño físico del canvas (pixels reales)
            canvas.width = containerWidth * scale;
            canvas.height = containerHeight * scale;

            // Ajustar el estilo CSS para que se muestre del tamaño correcto
            canvas.style.width = `${containerWidth}px`;
            canvas.style.height = `${containerHeight}px`;

            // Escalar el contexto para compensar
            context.scale(scale, scale);

            // Configurar el estilo para trazos de alta calidad
            context.lineWidth = strokeWidth;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = strokeColor;

            // Mejorar la suavidad de las líneas
            context.shadowBlur = 1;
            context.shadowColor = strokeColor;
          }
        };

        setupCanvas();
        window.addEventListener('resize', setupCanvas);
        setCtx(context);

        return () => window.removeEventListener('resize', setupCanvas);
      }
    }
  }, [strokeColor, strokeWidth]);

  // Función para generar trazos más suaves
  const drawSmoothLine = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    if (!ctx) return;

    // Dibujar una curva Bezier suave entre los puntos
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    // Usar un punto de control simple para una curva suave
    const controlX = (startX + endX) / 2;
    const controlY = (startY + endY) / 2;

    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
  };

  // Manejar eventos de dibujo con movimientos más suaves
  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!ctx) return;

    setIsDrawing(true);

    // Obtener posición inicial
    const position = getPosition(e);
    if (position) {
      setLastPoint({ x: position.x, y: position.y });
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);

      // Dibujar un pequeño punto para iniciar (mejor para firmas)
      ctx.arc(position.x, position.y, strokeWidth / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing || !ctx || !lastPoint) return;

    // Prevenir scroll en dispositivos móviles
    if (e.type === 'touchmove') {
      e.preventDefault();
    }

    // Obtener posición actual
    const position = getPosition(e);
    if (position) {
      // Dibujar línea suave entre último punto y actual
      drawSmoothLine(lastPoint.x, lastPoint.y, position.x, position.y);

      // Actualizar último punto
      setLastPoint({ x: position.x, y: position.y });
      setHasSignature(true);
    }
  };

  const endDrawing = () => {
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
    setLastPoint(null);
  };

  // Obtener posición del ratón o toque
  const getPosition = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    let clientX: number;
    let clientY: number;

    // Manejar diferentes tipos de eventos
    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convertir a coordenadas relativas al canvas
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Limpiar firma
  const clearSignature = () => {
    if (ctx && canvasRef.current) {
      // Obtener dimensiones reales del canvas
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Limpiar todo el área
      ctx.clearRect(0, 0, width, height);
      setHasSignature(false);
    }
  };

  // Guardar firma como imagen PNG base64 con fondo transparente
  const saveSignature = () => {
    if (!canvasRef.current || !hasSignature) return;

    try {
      // Recortar la firma para eliminar espacio en blanco excesivo
      const imageData = trimCanvas(canvasRef.current);

      // Convertir a formato PNG con alta calidad y fondo transparente
      const dataUrl = imageData.toDataURL('image/png', 1.0);

      console.log('Firma convertida a base64, longitud:', dataUrl.length);
      onSave(dataUrl);
    } catch (error) {
      console.error('Error al guardar la firma:', error);
      // Si falla el recorte, usar el canvas completo
      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      onSave(dataUrl);
    }
  };

  // Función optimizada para recortar el canvas y eliminar espacio en blanco
  const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const context = canvas.getContext('2d');
    if (!context) return canvas;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const l = pixels.data.length;
    const bound = {
      top: null as number | null,
      left: null as number | null,
      right: null as number | null,
      bottom: null as number | null,
    };

    // Iterate over every pixel to find the highest and lowest x and y
    for (let i = 0; i < l; i += 4) {
      if (pixels.data[i + 3] !== 0) {
        const x = (i / 4) % canvas.width;
        const y = ~~(i / 4 / canvas.width);

        if (bound.top === null) {
          bound.top = y;
        }

        if (bound.left === null) {
          bound.left = x;
        } else if (x < bound.left) {
          bound.left = x;
        }

        if (bound.right === null) {
          bound.right = x;
        } else if (bound.right < x) {
          bound.right = x;
        }

        if (bound.bottom === null) {
          bound.bottom = y;
        } else if (bound.bottom < y) {
          bound.bottom = y;
        }
      }
    }

    // Si no hay firma, devolver el canvas original
    if (bound.top === null) {
      return canvas;
    }

    // Añadir un margen proporcional al tamaño del canvas
    const margin = Math.min(canvas.width, canvas.height) * 0.05;
    bound.top = Math.max(0, (bound.top || 0) - margin);
    bound.left = Math.max(0, (bound.left || 0) - margin);
    bound.right = Math.min(canvas.width, (bound.right || 0) + margin);
    bound.bottom = Math.min(canvas.height, (bound.bottom || 0) + margin);

    const trimWidth = (bound.right || 0) - (bound.left || 0);
    const trimHeight = (bound.bottom || 0) - (bound.top || 0);

    // Crear un nuevo canvas con las dimensiones recortadas
    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimWidth;
    trimmedCanvas.height = trimHeight;

    // Obtener contexto con fondo transparente
    const trimmedContext = trimmedCanvas.getContext('2d');
    if (!trimmedContext) return canvas;

    // Mantener la transparencia
    trimmedContext.clearRect(0, 0, trimWidth, trimHeight);

    // Copiar la región recortada al nuevo canvas
    trimmedContext.drawImage(
      canvas,
      bound.left || 0,
      bound.top || 0,
      trimWidth,
      trimHeight,
      0,
      0,
      trimWidth,
      trimHeight,
    );

    return trimmedCanvas;
  };

  return (
    <div className='max-w-2xl p-6 bg-white rounded-lg shadow-xl'>
      <h2 className='mb-4 text-xl font-semibold text-gray-800'>
        Firma autógrafa
      </h2>
      <p className='mb-4 text-sm text-gray-600'>
        Por favor, dibuje su firma en el recuadro de abajo y luego haga clic en
        "Guardar firma".
      </p>

      {/* Controles de estilo */}
      <div className='flex items-center mb-4 space-x-4'>
        <div className='flex items-center'>
          <label
            htmlFor='stroke-color'
            className='mr-2 text-sm text-gray-700'>
            Color:
          </label>
          <input
            id='stroke-color'
            type='color'
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className='w-8 h-8 border border-gray-300 rounded-md'
          />
        </div>
        <div className='flex items-center'>
          <label
            htmlFor='stroke-width'
            className='mr-2 text-sm text-gray-700'>
            Grosor:
          </label>
          <input
            id='stroke-width'
            type='range'
            min='1'
            max='5'
            step='0.5'
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
            className='w-24'
          />
        </div>
      </div>

      <div className='relative mb-4'>
        <div className='bg-white border-2 border-gray-300 rounded-lg'>
          <canvas
            ref={canvasRef}
            className='w-full cursor-crosshair touch-none'
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={endDrawing}></canvas>

          {/* Guía de firma */}
          {!hasSignature && (
            <div className='absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none'>
              <span className='text-lg italic'>Firme aquí</span>
            </div>
          )}

          {/* Línea de base para guiar la firma */}
          <div className='absolute border-t border-gray-300 pointer-events-none bottom-5 left-5 right-5'></div>

          {/* Nombre del firmante */}
          <div className='absolute text-xs text-gray-500 pointer-events-none bottom-2 right-2'>
            {userName}
          </div>
        </div>
      </div>

      <div className='flex justify-end space-x-3'>
        <Button
          variant='secondary'
          onClick={clearSignature}
          disabled={!hasSignature}>
          Limpiar
        </Button>
        <Button
          variant='secondary'
          onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant='primary'
          onClick={saveSignature}
          disabled={!hasSignature}>
          Guardar firma
        </Button>
      </div>
    </div>
  );
};

export default FirmaAutografa;
