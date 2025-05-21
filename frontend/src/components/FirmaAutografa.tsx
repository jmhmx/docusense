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

  // Inicializar canvas
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
        // Configurar el estilo
        context.lineWidth = strokeWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = strokeColor;

        // Ajustar el tamaño del canvas para que sea responsivo y de alta resolución
        const resizeCanvas = () => {
          const container = canvas.parentElement;
          if (container) {
            // Determinar tamaño del contenedor
            const containerWidth = container.clientWidth;
            const containerHeight = 200; // Altura fija

            // Configurar el canvas con un factor de escala para mayor resolución
            const scale = window.devicePixelRatio || 1;
            canvas.width = containerWidth * scale;
            canvas.height = containerHeight * scale;

            // Ajustar el estilo CSS para que coincida con el tamaño del contenedor
            canvas.style.width = `${containerWidth}px`;
            canvas.style.height = `${containerHeight}px`;

            // Escalar el contexto para compensar la mayor resolución
            context.scale(scale, scale);

            // Restaurar configuración del contexto después de resize
            context.lineWidth = strokeWidth;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = strokeColor;
          }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        setCtx(context);

        return () => window.removeEventListener('resize', resizeCanvas);
      }
    }
  }, [strokeColor, strokeWidth]);

  // Manejar eventos de dibujo
  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!ctx) return;

    setIsDrawing(true);

    // Obtener posición
    const position = getPosition(e);
    if (position) {
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
    }
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing || !ctx) return;

    // Prevenir scroll en dispositivos móviles
    if (e.type === 'touchmove') {
      e.preventDefault();
    }

    // Obtener posición
    const position = getPosition(e);
    if (position) {
      ctx.lineTo(position.x, position.y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const endDrawing = () => {
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
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

  // Guardar firma como imagen PNG base64
  const saveSignature = () => {
    if (!canvasRef.current || !hasSignature) return;

    try {
      // Recortar la firma para eliminar espacio en blanco excesivo
      const imageData = trimCanvas(canvasRef.current);

      // Convertir a formato PNG con alta calidad
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

  // Función para recortar el canvas y eliminar espacio en blanco
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

    // Añadir un pequeño margen
    const margin = 10;
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

    // Copiar la región recortada al nuevo canvas
    const trimmedContext = trimmedCanvas.getContext('2d');
    if (!trimmedContext) return canvas;

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
