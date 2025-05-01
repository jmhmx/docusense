// frontend/src/components/PDFSearch.tsx
import { useState, useEffect } from 'react';
import { pdfjs } from 'react-pdf';

interface PDFSearchProps {
  documentId: string;
  numPages: number;
  onResultClick: (page: number) => void;
}

interface SearchResult {
  pageNumber: number;
  text: string;
  position: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

const PDFSearch = ({ documentId, numPages, onResultClick }: PDFSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem('token');

  // Load the PDF document
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const loadingTask = pdfjs.getDocument({
          url: `/api/documents/${documentId}/view`,
          httpHeaders: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const doc = await loadingTask.promise;
        setPdfDocument(doc);
      } catch (err) {
        console.error('Error loading PDF for search:', err);
        setError('No se pudo cargar el documento para buscar');
      }
    };

    loadPDF();
  }, [documentId, token]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !pdfDocument) return;
    
    setSearching(true);
    setResults([]);
    setError(null);
    
    try {
      const searchResults: SearchResult[] = [];
      
      // Search in each page
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        
        // Simple search implementation
        if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
          // For each match in the page
          let lastIndex = 0;
          const query = searchQuery.toLowerCase();
          const lowerText = text.toLowerCase();
          
          while ((lastIndex = lowerText.indexOf(query, lastIndex)) !== -1) {
            // Get some context
            const start = Math.max(0, lastIndex - 40);
            const end = Math.min(text.length, lastIndex + query.length + 40);
            const context = text.substring(start, end);
            
            // Add to results
            searchResults.push({
              pageNumber: i,
              text: context,
              position: {
                left: 0, // Actual positioning would require more complex logic
                top: 0,
                right: 0,
                bottom: 0
              }
            });
            
            lastIndex += query.length;
          }
        }
      }
      
      setResults(searchResults);
    } catch (err) {
      console.error('Error searching in PDF:', err);
      setError('Error al buscar en el documento');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mb-4 bg-white rounded-lg shadow">
      <div className="p-4">
        <div className="flex mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Buscar en el documento..."
          />
          <button
            onClick={handleSearch}
            disabled={searching || !pdfDocument}
            className="px-4 py-2 text-white bg-blue-600 border border-blue-600 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {searching ? (
              <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
        
        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}
        
        {results.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              {results.length} {results.length === 1 ? 'resultado' : 'resultados'} encontrados
            </h3>
            <div className="overflow-y-auto max-h-60">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className="p-2 mb-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                  onClick={() => onResultClick(result.pageNumber)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">
                      Página {result.pageNumber}
                    </span>
                    <button
                      className="p-1 text-xs text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResultClick(result.pageNumber);
                      }}
                    >
                      Ir a la página
                    </button>
                  </div>
                  <p className="text-sm text-gray-800">
                    {result.text.substring(0, result.text.toLowerCase().indexOf(searchQuery.toLowerCase()))}
                    <span className="px-1 font-bold bg-yellow-200">
                      {result.text.substring(
                        result.text.toLowerCase().indexOf(searchQuery.toLowerCase()), 
                        result.text.toLowerCase().indexOf(searchQuery.toLowerCase()) + searchQuery.length
                      )}
                    </span>
                    {result.text.substring(result.text.toLowerCase().indexOf(searchQuery.toLowerCase()) + searchQuery.length)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !searching && searchQuery && (
            <div className="p-4 text-sm text-center text-gray-500">
              No se encontraron resultados para "{searchQuery}"
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PDFSearch;