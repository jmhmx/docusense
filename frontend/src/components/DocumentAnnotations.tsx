import { useState } from 'react';
import Button from './Button';

export interface Annotation {
  id: string;
  type: 'note' | 'highlight' | 'underline';
  page: number;
  position: { x: number; y: number };
  content: string;
  color: string;
  created: Date;
}

interface DocumentAnnotationsProps {
  documentId: string;
  annotations: Annotation[];
  onCreateAnnotation: (annotation: Omit<Annotation, 'id' | 'created'>) => void;
  onUpdateAnnotation: (id: string, content: string) => void;
  onDeleteAnnotation: (id: string) => void;
  currentPage: number;
}

const DocumentAnnotations: React.FC<DocumentAnnotationsProps> = ({
  documentId,
  annotations,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  currentPage,
}) => {
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filterPage, setFilterPage] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Filtrar anotaciones
  const filteredAnnotations = annotations.filter(annotation => {
    const matchesPage = filterPage === 'all' || annotation.page === filterPage;
    const matchesType = filterType === 'all' || annotation.type === filterType;
    return matchesPage && matchesType;
  });

  const handleStartEditing = (annotation: Annotation) => {
    setEditingAnnotation(annotation.id);
    setEditContent(annotation.content);
  };

  const handleSaveEdit = () => {
    if (editingAnnotation && editContent.trim()) {
      onUpdateAnnotation(editingAnnotation, editContent);
      setEditingAnnotation(null);
      setEditContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingAnnotation(null);
    setEditContent('');
  };

  const handleCreateNewAnnotation = () => {
    // Crear una nueva anotación con valores por defecto
    onCreateAnnotation({
      type: 'note',
      page: currentPage,
      position: { x: 50, y: 50 },
      content: 'Nueva nota',
      color: '#ffeb3b'
    });
  };

  console.log(documentId);
  

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Anotaciones</h3>
        <div className="flex space-x-2">
          {/* Agregar botón de nueva anotación */}
          <Button 
            variant="primary" 
            size="small" 
            onClick={handleCreateNewAnnotation}
          >
            Nueva anotación
          </Button>
          <select
            value={filterPage === 'all' ? 'all' : filterPage.toString()}
            onChange={(e) => setFilterPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded"
          >
            <option value="all">Todas las páginas</option>
            <option value={currentPage}>Página actual</option>
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded"
          >
            <option value="all">Todos los tipos</option>
            <option value="note">Notas</option>
            <option value="highlight">Resaltados</option>
            <option value="underline">Subrayados</option>
          </select>
        </div>
      </div>

      {filteredAnnotations.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-gray-500">No hay anotaciones que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnotations.map((annotation) => (
            <div 
              key={annotation.id} 
              className="p-3 border rounded-md hover:shadow"
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: annotation.color
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700">
                      {annotation.type === 'note' && 'Nota'}
                      {annotation.type === 'highlight' && 'Resaltado'}
                      {annotation.type === 'underline' && 'Subrayado'}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      Página {annotation.page}
                    </span>
                  </div>
                  
                  {editingAnnotation === annotation.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-300 rounded"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end mt-2 space-x-2">
                        <Button 
                          variant="secondary" 
                          size="small"
                          onClick={handleCancelEdit}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          variant="primary" 
                          size="small"
                          onClick={handleSaveEdit}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-gray-600">
                        {annotation.content}
                      </p>
                      <div className="mt-2 text-xs text-gray-400">
                        {annotation.created instanceof Date
                          ? annotation.created.toLocaleString()
                          : new Date(annotation.created).toLocaleString()}
                      </div>
                    </>
                  )}
                </div>
                
                {editingAnnotation !== annotation.id && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleStartEditing(annotation)}
                      className="p-1 text-gray-500 rounded hover:bg-gray-100"
                      title="Editar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteAnnotation(annotation.id)}
                      className="p-1 text-red-500 rounded hover:bg-red-100"
                      title="Eliminar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentAnnotations;