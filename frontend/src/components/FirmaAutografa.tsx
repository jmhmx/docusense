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
      console.log('Iniciando guardado de firma...');

      // Obtener canvas y contexto
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('No se pudo obtener contexto 2D');
        return;
      }

      // Verificar que hay contenido en el canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some(
        (channel, index) => index % 4 === 3 && channel > 0, // Canal alpha > 0
      );

      if (!hasContent) {
        console.error('Canvas vacío');
        alert('Por favor dibuje su firma antes de guardar');
        return;
      }

      // Crear canvas temporal para recortar
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        console.error('No se pudo crear canvas temporal');
        return;
      }

      // Encontrar límites del contenido
      const bounds = findImageBounds(imageData, canvas.width, canvas.height);

      if (!bounds) {
        console.error('No se encontró contenido para recortar');
        return;
      }

      // Añadir margen
      const margin = 10;
      const finalX = Math.max(0, bounds.minX - margin);
      const finalY = Math.max(0, bounds.minY - margin);
      const finalWidth = Math.min(
        canvas.width - finalX,
        bounds.width + 2 * margin,
      );
      const finalHeight = Math.min(
        canvas.height - finalY,
        bounds.height + 2 * margin,
      );

      // Configurar canvas temporal
      tempCanvas.width = finalWidth;
      tempCanvas.height = finalHeight;

      // Copiar contenido recortado
      tempCtx.drawImage(
        canvas,
        finalX,
        finalY,
        finalWidth,
        finalHeight,
        0,
        0,
        finalWidth,
        finalHeight,
      );

      // Generar base64 en PNG de alta calidad
      const dataUrl = tempCanvas.toDataURL('image/png', 1.0);

      console.log('Firma generada:', {
        originalSize: `${canvas.width}x${canvas.height}`,
        croppedSize: `${finalWidth}x${finalHeight}`,
        dataUrlLength: dataUrl.length,
        dataUrlPrefix: dataUrl.substring(0, 50),
      });

      // Verificar que la imagen no esté vacía
      if (
        dataUrl ===
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      ) {
        console.error('Canvas resultó en imagen vacía');
        alert('Error: la firma está vacía');
        return;
      }

      onSave(dataUrl);
    } catch (error) {
      console.error('Error al guardar la firma:', error);
      alert('Error al procesar la firma. Intente nuevamente.');
    }
  };

  // Función auxiliar para encontrar límites del contenido
  const findImageBounds = (
    imageData: ImageData,
    width: number,
    height: number,
  ) => {
    const data = imageData.data;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          hasContent = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasContent) return null;

    return {
      minX,
      minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
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
