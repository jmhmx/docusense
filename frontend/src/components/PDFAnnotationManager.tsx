import { useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface Annotation {
  id: string;
  type: 'highlight' | 'underline' | 'note';
  content?: string;
  position: Record<string, any>;
  color: string;
  createdAt: string;
}

interface PDFAnnotationManagerProps {
  documentId: string;
  children: ReactNode;
}

const PDFAnnotationManager = ({
  documentId,
  children,
}: PDFAnnotationManagerProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  //@ts-ignore
  const [loading, setLoading] = useState(true);
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<
    string | null
  >(null);
  const [selectedColor, setSelectedColor] = useState('#FFEB3B');
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Cargar anotaciones al montar el componente
  useEffect(() => {
    fetchAnnotations();
  }, [documentId]);

  const fetchAnnotations = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/annotations/document/${documentId}`);
      setAnnotations(response.data);
    } catch (error) {
      console.error('Error al cargar anotaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnotation = async (
    annotationType: 'highlight' | 'underline' | 'note',
    selectedText: string,
    position: any,
  ) => {
    try {
      const newAnnotation = {
        type: annotationType,
        content: selectedText,
        position,
        color: selectedColor,
      };

      const response = await api.post(
        `/api/annotations/document/${documentId}`,
        newAnnotation,
      );
      setAnnotations([...annotations, response.data]);
    } catch (error) {
      console.error('Error al crear anotación:', error);
    }
  };

  // Capturar selección de texto en el PDF (esto se activaría desde el visor)
  const handleTextSelection = () => {
    if (!activeAnnotationTool) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Obtener información de posición
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calcular posición relativa al documento
    const position = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      page: 1, // Esto debería obtenerse del contexto actual
    };

    // Crear la anotación
    handleAddAnnotation(
      activeAnnotationTool as 'highlight' | 'underline' | 'note',
      selectedText,
      position,
    );

    // Limpiar selección
    selection.removeAllRanges();
  };

  // Renderizar barra de herramientas de anotación
  const renderAnnotationToolbar = () => {
    return (
      <div className='flex items-center p-2 mb-4 space-x-2 bg-white border rounded-md shadow-sm'>
        <button
          className={`p-2 rounded-md ${
            activeAnnotationTool === 'highlight'
              ? 'bg-blue-100'
              : 'hover:bg-gray-100'
          }`}
          onClick={() =>
            setActiveAnnotationTool(
              activeAnnotationTool === 'highlight' ? null : 'highlight',
            )
          }
          title='Resaltar texto'>
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
              d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
            />
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${
            activeAnnotationTool === 'underline'
              ? 'bg-blue-100'
              : 'hover:bg-gray-100'
          }`}
          onClick={() =>
            setActiveAnnotationTool(
              activeAnnotationTool === 'underline' ? null : 'underline',
            )
          }
          title='Subrayar texto'>
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
              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            />
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${
            activeAnnotationTool === 'note'
              ? 'bg-blue-100'
              : 'hover:bg-gray-100'
          }`}
          onClick={() =>
            setActiveAnnotationTool(
              activeAnnotationTool === 'note' ? null : 'note',
            )
          }
          title='Añadir nota'>
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
              d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
            />
          </svg>
        </button>

        <div className='w-px h-6 mx-2 bg-gray-300'></div>

        <input
          type='color'
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className='w-8 h-8 border border-gray-300 rounded cursor-pointer'
          title='Seleccionar color'
        />

        <div className='w-px h-6 mx-2 bg-gray-300'></div>

        <button
          className={`p-2 rounded-md ${
            showAnnotations ? 'bg-blue-100' : 'hover:bg-gray-100'
          }`}
          onClick={() => setShowAnnotations(!showAnnotations)}
          title={
            showAnnotations ? 'Ocultar anotaciones' : 'Mostrar anotaciones'
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
              d={
                showAnnotations
                  ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                  : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
              }
            />
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d={
                !showAnnotations
                  ? 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                  : ''
              }
            />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className='pdf-annotation-container'>
      {renderAnnotationToolbar()}

      {/* Renderizar componente hijo (normalmente, el visor de PDF) con capacidades de anotación */}
      <div
        className='pdf-content-area'
        onMouseUp={
          activeAnnotationTool ? () => handleTextSelection() : undefined
        }>
        {children}
      </div>

      {/* Se podrían renderizar las anotaciones existentes aquí, superpuestas al PDF */}
      {showAnnotations && annotations.length > 0 && (
        <div className='mt-4 annotation-list'>
          <h3 className='mb-2 text-sm font-medium text-gray-700'>
            Anotaciones ({annotations.length})
          </h3>
          <div className='space-y-2'>
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className='p-2 border rounded'
                style={{
                  borderColor: annotation.color,
                  backgroundColor: `${annotation.color}20`,
                }}>
                <div className='text-xs text-gray-500'>
                  {new Date(annotation.createdAt).toLocaleString()}
                </div>
                <div className='text-sm'>{annotation.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFAnnotationManager;
