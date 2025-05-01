// frontend/src/components/PDFAnnotationManager.tsx
import { useState, useEffect } from 'react';
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
  children: React.ReactNode;
}

const PDFAnnotationManager = ({ documentId, children }: PDFAnnotationManagerProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Annotation | null>(null);

  // Fetch annotations when the component mounts
  useEffect(() => {
    fetchAnnotations();
  }, [documentId]);

  const fetchAnnotations = async () => {
    setLoading(true);
    try {
      // Replace with actual API call when you implement backend
      const response = await api.get(`/api/documents/${documentId}/annotations`);
      setAnnotations(response.data);
    } catch (err) {
      console.error('Error fetching annotations:', err);
      // For now, use local storage as a fallback
      const storedAnnotations = localStorage.getItem(`annotations-${documentId}`);
      if (storedAnnotations) {
        setAnnotations(JSON.parse(storedAnnotations));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAnnotations = async (updatedAnnotations: Annotation[]) => {
    try {
      // Replace with actual API call when you implement backend
      await api.post(`/api/documents/${documentId}/annotations`, updatedAnnotations);
    } catch (err) {
      console.error('Error saving annotations:', err);
      // For now, use local storage as a fallback
      localStorage.setItem(`annotations-${documentId}`, JSON.stringify(updatedAnnotations));
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
    
    // If it's a note, open the editor
    if (annotation.type === 'note') {
      setActiveNote(annotation);
    }
  };

  const handleDeleteAnnotation = (id: string) => {
    const updatedAnnotations = annotations.filter(ann => ann.id !== id);
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    if (activeNote?.id === id) {
      setActiveNote(null);
    }
  };

  const handleUpdateAnnotation = (updatedAnnotation: Annotation) => {
    const updatedAnnotations = annotations.map(ann => 
      ann.id === updatedAnnotation.id ? updatedAnnotation : ann
    );
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
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
      });
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
            <h3 className="mb-4 text-lg font-medium text-gray-900">Edit Note</h3>
            <textarea
              className="w-full p-2 mb-4 border border-gray-300 rounded"
              rows={5}
              value={activeNote.content || ''}
              onChange={(e) => setActiveNote({...activeNote, content: e.target.value})}
              placeholder="Enter your note..."
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setActiveNote(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeNote) {
                    handleUpdateAnnotation(activeNote);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFAnnotationManager;