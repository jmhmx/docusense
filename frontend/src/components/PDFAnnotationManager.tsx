import React, { useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../api/client';

interface Annotation {
  id: string;
  type: 'highlight' | 'underline' | 'note';
  content?: string;
  position: {
    pageNumber: number;
    boundingRect: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    };
  };
  color: string;
}

interface PDFAnnotationManagerProps {
  documentId: string;
  children: ReactNode;
}

interface ChildProps {
  annotations: Annotation[];
  onAnnotationCreate: (newAnnotation: Omit<Annotation, 'id'>) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationUpdate: (updatedAnnotation: Annotation) => void;
}

const PDFAnnotationManager = ({ documentId, children }: PDFAnnotationManagerProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  //@ts-ignore
  const [, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Annotation | null>(null);

  // Fetch annotations when the component mounts
  useEffect(() => {
    fetchAnnotations();
  }, [documentId]);

  const fetchAnnotations = async () => {
    try {
      // Usar el endpoint correcto para obtener anotaciones
      const response = await api.get(`/api/annotations/document/${documentId}`);
      setAnnotations(response.data);
    } catch (err) {
      console.error('Error fetching annotations:', err);
      // Si hay un error, intenta usar localStorage
      const storedAnnotations = localStorage.getItem(`annotations-${documentId}`);
      if (storedAnnotations) {
        try {
          setAnnotations(JSON.parse(storedAnnotations));
        } catch (e) {
          console.error('Error parsing stored annotations:', e);
          setAnnotations([]);
        }
      } else {
        setAnnotations([]);
      }
    }
  };

  const saveAnnotations = async (updatedAnnotations: Annotation[]) => {
    try {
      // Guardar en localStorage como respaldo
      localStorage.setItem(`annotations-${documentId}`, JSON.stringify(updatedAnnotations));
      
      // Intentar enviar al backend en batch
      await api.post(`/api/annotations/document/${documentId}/batch`, updatedAnnotations);
    } catch (err) {
      console.error('Error saving annotations:', err);
    }
  };

  const handleCreateAnnotation = (newAnnotation: Omit<Annotation, 'id'>) => {
    const annotation = {
      ...newAnnotation,
      id: uuidv4()
    };
    
    const updatedAnnotations = [...annotations, annotation];
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    // También intentar guardar individualmente
    try {
      api.post(`/api/annotations/document/${documentId}`, newAnnotation);
    } catch (err) {
      console.error('Error creating single annotation:', err);
    }
    
    // If it's a note, open the editor
    if (annotation.type === 'note') {
      setActiveNote(annotation);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    const updatedAnnotations = annotations.filter(ann => ann.id !== id);
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    try {
      // Intentar eliminar en el backend
      await api.delete(`/api/annotations/${id}`);
    } catch (err) {
      console.error('Error deleting annotation:', err);
    }
    
    if (activeNote?.id === id) {
      setActiveNote(null);
    }
  };

  const handleUpdateAnnotation = async (updatedAnnotation: Annotation) => {
    const updatedAnnotations = annotations.map(ann => 
      ann.id === updatedAnnotation.id ? updatedAnnotation : ann
    );
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    try {
      // Intentar actualizar en el backend
      await api.patch(`/api/annotations/${updatedAnnotation.id}`, {
        content: updatedAnnotation.content,
        position: updatedAnnotation.position,
        color: updatedAnnotation.color,
        type: updatedAnnotation.type
      });
    } catch (err) {
      console.error('Error updating annotation:', err);
    }
    
    if (activeNote?.id === updatedAnnotation.id) {
      setActiveNote(null);
    }
  };

  // Clone the children and pass the necessary props
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        annotations,
        onAnnotationCreate: handleCreateAnnotation,
        onAnnotationDelete: handleDeleteAnnotation,
        onAnnotationUpdate: handleUpdateAnnotation
      } as ChildProps);
    }
    return child;
  });

  return (
    <div className="relative">
      {childrenWithProps}
      
      {/* Note editor modal */}
      {activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Editar Nota</h3>
            <textarea
              className="w-full p-2 mb-4 border border-gray-300 rounded"
              rows={5}
              value={activeNote.content || ''}
              onChange={(e) => setActiveNote({...activeNote, content: e.target.value})}
              placeholder="Escribe tu nota..."
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setActiveNote(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (activeNote) {
                    handleUpdateAnnotation(activeNote);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFAnnotationManager;