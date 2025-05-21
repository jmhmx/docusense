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

  // Inicializar canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Obtener el contexto del canvas
      const context = canvas.getContext('2d');
      if (context) {
        // Configurar el estilo
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#000000';

        // Ajustar el tamaño del canvas para que sea responsivo
        const resizeCanvas = () => {
          const container = canvas.parentElement;
          if (container) {
            canvas.width = container.clientWidth;
            canvas.height = 200; // Altura fija

            // Mantener configuración del contexto después de resize
            context.lineWidth = 2;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#000000';
          }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        setCtx(context);

        return () => window.removeEventListener('resize', resizeCanvas);
      }
    }
  }, []);

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
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasSignature(false);
    }
  };

  // Guardar firma como SVG base64
  const saveSignature = () => {
    if (!canvasRef.current || !hasSignature) return;

    // Convertir el canvas a data URL (PNG en base64)
    const dataUrl = canvasRef.current.toDataURL('image/png');

    // Convertir a SVG para mantener el formato vectorial
    const svgWidth = canvasRef.current.width;
    const svgHeight = canvasRef.current.height;

    // Crear el SVG con la imagen base64 incrustada
    const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <image width="${svgWidth}" height="${svgHeight}" href="${dataUrl}" />
    </svg>`;

    // Convertir el SVG a base64 para enviarlo al servidor
    const svgBase64 = btoa(svgContent);

    onSave(svgBase64);
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
          <div className='absolute bottom-0 left-0 right-0 border-t border-gray-300 pointer-events-none'></div>

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
