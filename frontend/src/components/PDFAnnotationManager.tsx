import React, { useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';
import { log } from 'console';

interface Annotation {
  id: string;
  type: string;
  content?: string;
  position: Record<string, any>;
  color: string;
  createdAt: string;
  userId: string;
}

interface PDFAnnotationManagerProps {
  documentId: string;
  children: ReactNode;
}

interface Signature {
  id: string;
  userId: string;
  signedAt: string;
  reason?: string;
  valid: boolean;
  position?: string;
  user?: {
    name: string;
    email: string;
  };
}

const PDFAnnotationManager: React.FC<PDFAnnotationManagerProps> = ({ documentId, children }) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  //@ts-ignore
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [annotationType, setAnnotationType] = useState<'highlight' | 'note'>('highlight');
  const [signatureOverlayVisible, setSignatureOverlayVisible] = useState(true);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  useEffect(() => {
    // Cargar anotaciones existentes cuando el componente se monta
    fetchAnnotations();
    fetchSignatures();
  }, [documentId]);

  const fetchAnnotations = async () => {
    try {
      const response = await api.get(`/api/annotations/document/${documentId}`);
      setAnnotations(response.data);
    } catch (error) {
      console.error('Error al cargar anotaciones:', error);
    }
  };

  const fetchSignatures = async () => {
    try {
      const response = await api.get(`/api/signatures/document/${documentId}`);
      setSignatures(response.data);
    } catch (err) {
      console.error('Error loading signatures:', err);
    }
  };

  const handleAddAnnotation = () => {
    setIsAddingAnnotation(true);
    // Aquí continuaría la lógica para añadir anotaciones
  };

  const handleDownloadDocument = () => {
    // Crear enlace de descarga
    const link = window.document.createElement('a');
    link.href = `/api/documents/${documentId}/download`;
    link.setAttribute('download', `document-${documentId}`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleDownloadSignedDocument = () => {
    // Crear enlace de descarga para documento firmado
    const link = window.document.createElement('a');
    link.href = `/api/documents/${documentId}/download-signed`;
    link.setAttribute('download', `signed-document-${documentId}`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  return (
    <div className="relative">
      {/* Barra de herramientas de anotaciones */}
      <div className="flex items-center justify-between p-2 mb-4 bg-white rounded-lg shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddAnnotation}
            className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Añadir Anotación
          </button>
          
          {/* Selector de tipo de anotación */}
          <select
            value={annotationType}
            onChange={(e) => setAnnotationType(e.target.value as 'highlight' | 'note')}
            className="block py-1.5 pl-3 pr-10 text-sm border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="highlight">Resaltado</option>
            <option value="note">Nota</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Botón mostrar/ocultar firmas */}
          {signatures.length > 0 && (
            <button 
              onClick={() => setSignatureOverlayVisible(!signatureOverlayVisible)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              {signatureOverlayVisible ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Ocultar firmas
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Mostrar firmas
                </>
              )}
            </button>
          )}
          
          {/* Botón de descarga original */}
          <button
            onClick={handleDownloadDocument}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar original
          </button>
          
          {/* Botón de descarga con firmas */}
          {signatures.length > 0 && (
            <button
              onClick={handleDownloadSignedDocument}
              className="inline-flex items-center px-3 py-1.5 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Descargar con firmas
            </button>
          )}
        </div>
      </div>

      {/* Contenido del visor de PDF (pasado como children) */}
      <div className="relative">
        {children}
        
        {/* Visualización de anotaciones */}
        <div className="absolute inset-0 pointer-events-none">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              style={{
                position: 'absolute',
                left: `${annotation.position.x}px`,
                top: `${annotation.position.y}px`,
                width: `${annotation.position.width}px`,
                height: `${annotation.position.height}px`,
                backgroundColor: annotation.color,
                opacity: 0.3,
                zIndex: 10,
              }}
            ></div>
          ))}
        </div>
      </div>
      
      {/* Flag para componentes hijos que necesitan saber si las firmas están visibles */}
      <input type="hidden" id="signatures-visible" value={signatureOverlayVisible.toString()} />
    </div>
  );
};

export default PDFAnnotationManager;