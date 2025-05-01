// frontend/src/components/PDFThumbnails.tsx
import { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';

interface PDFThumbnailsProps {
  documentId: string;
  numPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const PDFThumbnails = ({ documentId, numPages, currentPage, onPageSelect }: PDFThumbnailsProps) => {
  const [thumbnails, setThumbnails] = useState<number[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    setPdfUrl(`/api/documents/${documentId}/view`);
    
    // Generate array of page numbers to render
    const pages: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      pages.push(i);
    }
    setThumbnails(pages);
  }, [documentId, numPages]);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Páginas del documento</h3>
      <div className="overflow-x-auto">
        <div className="flex pb-2 space-x-2">
          {thumbnails.map((pageNum) => (
            <div 
              key={pageNum}
              onClick={() => onPageSelect(pageNum)}
              className={`relative cursor-pointer border-2 rounded ${
                pageNum === currentPage ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
                <span className="text-xs font-medium text-gray-500">{pageNum}</span>
              </div>
              <Document
                file={{
                  url: pdfUrl,
                  httpHeaders: {
                    'Authorization': `Bearer ${token}`
                  }
                }}
                loading=""
                error=""
              >
                <Page 
                  pageNumber={pageNum} 
                  width={80}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="rounded"
                />
              </Document>
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center p-1 text-xs font-bold bg-white bg-opacity-75">
                {pageNum}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PDFThumbnails;