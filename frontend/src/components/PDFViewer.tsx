import { useState, useEffect, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

interface Annotation {
  id: string;
  position: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  user: {
    name: string;
    email?: string;
  };
  signedAt: string;
  valid: boolean;
  reason?: string;
}

interface PDFViewerProps {
  documentId: string;
  onSelectionChange?: (selection: { text: string; start: number; end: number }) => void;
  onPageChange?: (page: number) => void;
  annotations?: Annotation[];
  onAnnotationCreate?: (annotation: Omit<Annotation, 'id'>) => void;
}

const PDFViewer = ({ 
  documentId, 
  onSelectionChange, 
  onPageChange,
  annotations = [],
  onAnnotationCreate,
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<'none' | 'highlight' | 'underline' | 'note'>('none');
  const [selectedText, setSelectedText] = useState<{text: string, position: any} | null>(null);
  const [annotationColor, setAnnotationColor] = useState<string>('#FFEB3B'); // Default yellow
  
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    setPdfUrl(`/api/documents/${documentId}/view`);
    setLoading(true);
  }, [documentId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setLoading(false);
    setError('Failed to load the PDF. Please try downloading it instead.');
  };

  const handlePreviousPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1;
      setPageNumber(newPage);
      if (onPageChange) onPageChange(newPage);
    }
  };

  const handleNextPage = () => {
    if (numPages && pageNumber < numPages) {
      const newPage = pageNumber + 1;
      setPageNumber(newPage);
      if (onPageChange) onPageChange(newPage);
    }
  };

  const handleZoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 3));
  const handleZoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  const handleResetZoom = () => setScale(1.2);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText(null);
      return;
    }

    const text = selection.toString().trim();
    if (text) {
      // Get the bounding client rect of the selection
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      
      if (rects.length > 0) {
        // Transform client rect to page coordinates
        const pageContainer = pageContainerRef.current;
        if (pageContainer) {
          const containerRect = pageContainer.getBoundingClientRect();
          
          // Calculate bounding box for the selection
          let x1 = Infinity, y1 = Infinity, x2 = 0, y2 = 0;
          
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            x1 = Math.min(x1, rect.left - containerRect.left);
            y1 = Math.min(y1, rect.top - containerRect.top);
            x2 = Math.max(x2, rect.right - containerRect.left);
            y2 = Math.max(y2, rect.bottom - containerRect.top);
          }
          
          const position = {
            pageNumber: pageNumber,
            boundingRect: {
              x1: x1 / scale,
              y1: y1 / scale,
              x2: x2 / scale,
              y2: y2 / scale,
              width: (x2 - x1) / scale,
              height: (y2 - y1) / scale
            }
          };
          
          setSelectedText({ text, position });
          
          // Call onSelectionChange if provided
          if (onSelectionChange) {
            onSelectionChange({
              text,
              start: 0, // Placeholder, need better way to get character positions
              end: text.length
            });
          }
          
          // Create annotation if tool is active
          if (activeAnnotationTool !== 'none' && onAnnotationCreate) {
            // onAnnotationCreate({
            //   type: activeAnnotationTool,
            //   position,
            //   color: annotationColor,
            //   content: activeAnnotationTool === 'note' ? '' : undefined
            // });
            
            // Clear selection after creating annotation
            window.getSelection()?.removeAllRanges();
            setSelectedText(null);
          }
        }
      }
    }
  };

  const renderAnnotations = () => {
    if (!annotations) return [];
    
    // Filtrar anotaciones para la página actual
    const pageAnnotations = annotations.filter(ann => ann.position.page === pageNumber);
    
    return pageAnnotations.map(annotation => {
      const { x, y, width, height } = annotation.position;
      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${x * scale}px`,
        top: `${y * scale}px`,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        backgroundColor: annotation.valid ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)',
        border: `2px solid ${annotation.valid ? 'rgb(46, 204, 113)' : 'rgb(231, 76, 60)'}`,
        zIndex: 2,
        cursor: 'pointer'
      };
      
      return (
        <div 
          key={annotation.id} 
          style={style}
          onClick={() => handleAnnotationClick(annotation)}
          title={annotation.reason || 'Signature'}
        >
          <div className="flex items-center p-2">
            <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full">
              <span className="text-xs font-bold text-blue-800">
                {annotation.user.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      );
    });
  };

  const handleAnnotationClick = (annotation: Annotation) => {
  console.log('Annotation clicked:', annotation);
};

  return (
    <div className="flex flex-col p-4 bg-white rounded-lg shadow">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 space-x-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviousPage}
            disabled={pageNumber <= 1}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Previous page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm">
            Page {pageNumber} of {numPages || '-'}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Next page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
            title="Zoom out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          
          <button
            onClick={handleZoomIn}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
            title="Zoom in"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button
            onClick={handleResetZoom}
            className="p-1 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
            title="Reset zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Annotation tools */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveAnnotationTool(activeAnnotationTool === 'highlight' ? 'none' : 'highlight')}
            className={`p-1 rounded ${activeAnnotationTool === 'highlight' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="Highlight text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          
          <button
            onClick={() => setActiveAnnotationTool(activeAnnotationTool === 'underline' ? 'none' : 'underline')}
            className={`p-1 rounded ${activeAnnotationTool === 'underline' ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="Underline text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <button
            onClick={() => setActiveAnnotationTool(activeAnnotationTool === 'note' ? 'none' : 'note')}
            className={`p-1 rounded ${activeAnnotationTool === 'note' ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="Add note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </button>
          
          {activeAnnotationTool !== 'none' && (
            <div className="flex items-center">
              <label className="mr-1 text-xs text-gray-500">Color:</label>
              <input
                type="color"
                value={annotationColor}
                onChange={(e) => setAnnotationColor(e.target.value)}
                className="w-6 h-6 p-0 bg-transparent border-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* PDF viewer */}
      <div 
        className="relative p-4 overflow-auto bg-gray-100 rounded-lg"
        style={{ height: '600px' }}
        onMouseUp={handleTextSelection}
        ref={pageContainerRef}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <svg className="w-10 h-10 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="mt-2 text-red-600">{error}</p>
          </div>
        )}

        <div className="relative flex justify-center">
          <Document
            file={{
              url: pdfUrl,
              httpHeaders: {
                'Authorization': `Bearer ${token}`
              }
            }}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            className="relative"
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
            
            {/* Render annotations */}
            {renderAnnotations()}
            
            {/* Render active selection */}
            {selectedText && activeAnnotationTool === 'none' && (
              <div
                style={{
                  position: 'absolute',
                  left: `${selectedText.position.boundingRect.x1 * scale}px`,
                  top: `${selectedText.position.boundingRect.y1 * scale}px`,
                  width: `${selectedText.position.boundingRect.width * scale}px`,
                  height: `${selectedText.position.boundingRect.height * scale}px`,
                  backgroundColor: 'rgba(0, 123, 255, 0.2)',
                  border: '1px solid rgba(0, 123, 255, 0.5)',
                  zIndex: 3
                }}
              ></div>
            )}
          </Document>
        </div>
      </div>
      
      {/* Selection tools */}
      {selectedText && activeAnnotationTool === 'none' && (
        <div className="absolute p-2 bg-white border rounded-md shadow-lg" style={{
          left: `${selectedText.position.boundingRect.x1 * scale}px`,
          top: `${(selectedText.position.boundingRect.y2 * scale) + 10}px`,
          zIndex: 10
        }}>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (onAnnotationCreate) {
                  onAnnotationCreate({
                    position: selectedText.position,
                    user: { name: 'Current User' },
                    signedAt: new Date().toISOString(),
                    valid: true,
                    reason: 'Annotation'
                  });
                  window.getSelection()?.removeAllRanges();
                  setSelectedText(null);
                }
              }}
              className="p-1 text-yellow-800 bg-yellow-100 rounded hover:bg-yellow-200"
              title="Highlight"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (onAnnotationCreate) {
                  onAnnotationCreate({
                    position: selectedText.position,
                    user: { name: 'Current User' },
                    signedAt: new Date().toISOString(),
                    valid: true,
                    reason: 'Annotation'
                  });
                  window.getSelection()?.removeAllRanges();
                  setSelectedText(null);
                }
              }}
              className="p-1 text-blue-800 bg-blue-100 rounded hover:bg-blue-200"
              title="Underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (onAnnotationCreate) {
                  onAnnotationCreate({
                    position: selectedText.position,
                    user: { name: 'Current User' },
                    signedAt: new Date().toISOString(),
                    valid: true,
                    reason: 'Annotation'
                  });
                  window.getSelection()?.removeAllRanges();
                  setSelectedText(null);
                }
              }}
              className="p-1 text-green-800 bg-green-100 rounded hover:bg-green-200"
              title="Add note"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;