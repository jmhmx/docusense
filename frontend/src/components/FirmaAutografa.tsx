import { useState, useRef, useEffect } from 'react';
import Button from './Button';

interface FirmaAutografaProps {
  onSave: (firmaSvg: string) => void;
  onCancel: () => void;
  userName: string;
  date?: string;
}

const FirmaAutografa = ({
  onSave,
  onCancel,
  userName,
  date = new Date().toLocaleDateString(),
}: FirmaAutografaProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isLimpiando, setIsLimpiando] = useState(false);

  // Inicializar el canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = 'black';

      // Limpiar canvas
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      setCtx(context);
    }
  }, [canvasRef]);

  // Iniciar trazo
  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!ctx) return;

    setIsDrawing(true);
    setIsEmpty(false);

    // Obtener coordenadas según tipo de evento
    let clientX: number, clientY: number;

    if ('touches' in e) {
      // Es un evento táctil
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Es un evento de mouse
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Dibujar
  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;

    // Prevenir desplazamiento en dispositivos táctiles
    if ('touches' in e) {
      e.preventDefault();
    }

    // Obtener coordenadas según tipo de evento
    let clientX: number, clientY: number;

    if ('touches' in e) {
      // Es un evento táctil
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Es un evento de mouse
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // Finalizar trazo
  const stopDrawing = () => {
    if (!ctx) return;

    setIsDrawing(false);
    ctx.closePath();
  };

  // Limpiar canvas
  const limpiarFirma = () => {
    if (!ctx || !canvasRef.current) return;

    setIsLimpiando(true);

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    setIsEmpty(true);
    setIsLimpiando(false);
  };

  // Guardar firma
  const guardarFirma = () => {
    if (!canvasRef.current) return;

    // Convertir firma a SVG
    const svgData = canvasToSVG(canvasRef.current);
    onSave(svgData);
  };

  // Convertir canvas a SVG para mayor compatibilidad
  const canvasToSVG = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Obtener datos de la imagen
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Recopilar puntos de trazo
    const paths = [];
    let currentPath = '';
    let isDrawing = false;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;

        // Si es un pixel no blanco (parte de la firma)
        if (data[idx] < 255 || data[idx + 1] < 255 || data[idx + 2] < 255) {
          if (!isDrawing) {
            currentPath = `M${x},${y}`;
            isDrawing = true;
          } else {
            currentPath += ` L${x},${y}`;
          }
        } else if (isDrawing) {
          paths.push(currentPath);
          isDrawing = false;
        }
      }
    }

    // Crear SVG
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${
      canvas.height
    }">
        <rect width="100%" height="100%" fill="white"/>
        <g stroke="black" stroke-width="2" fill="none">
          ${paths.map((path) => `<path d="${path}" />`).join('')}
        </g>
        <text x="10" y="${
          canvas.height - 25
        }" font-family="Arial" font-size="12" fill="black">${userName}</text>
        <text x="10" y="${
          canvas.height - 10
        }" font-family="Arial" font-size="10" fill="gray">${date}</text>
      </svg>
    `;

    return svg.trim();
  };

  return (
    <div className='p-6 bg-white rounded-lg shadow-lg'>
      <h3 className='mb-4 text-lg font-medium text-gray-900'>
        Firma Autógrafa
      </h3>

      <p className='mb-4 text-sm text-gray-600'>
        Dibuja tu firma en el recuadro a continuación. Intenta que sea lo más
        parecida posible a tu firma habitual.
      </p>

      <div className='p-2 mb-4 border-2 border-gray-300 border-dashed rounded-md'>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className='bg-white border border-gray-200 cursor-crosshair touch-none'
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className='mb-2 text-xs text-gray-500'>
        Firma de: {userName} - Fecha: {date}
      </div>

      <div className='flex justify-between mt-4'>
        <div>
          <Button
            variant='secondary'
            onClick={limpiarFirma}
            disabled={isLimpiando || isEmpty}>
            {isLimpiando ? 'Limpiando...' : 'Limpiar'}
          </Button>
        </div>

        <div className='space-x-3'>
          <Button
            variant='secondary'
            onClick={onCancel}>
            Cancelar
          </Button>

          <Button
            variant='primary'
            onClick={guardarFirma}
            disabled={isEmpty}>
            Guardar Firma
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FirmaAutografa;
