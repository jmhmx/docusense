import { useState, useEffect, useRef } from 'react';
import { pdfjs } from 'react-pdf';

interface SearchResult {
  pageNumber: number;
  text: string;
  matchIndex: number;
  position?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  preview: string; // Contexto alrededor del resultado
}

interface DocumentSearchProps {
  documentId: string;
  pdfDocument: pdfjs.PDFDocumentProxy | null;
  currentPage: number;
  onSearchResultClick: (result: SearchResult) => void;
}

const DocumentSearch: React.FC<DocumentSearchProps> = ({
  documentId,
  pdfDocument,
  currentPage,
  onSearchResultClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [totalPages, setTotalPages] = useState(0);
  const [pagesSearched, setPagesSearched] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (pdfDocument) {
      setTotalPages(pdfDocument.numPages);
    }
    console.log(documentId)
  }, [pdfDocument]);

  // Función para extraer texto de contexto alrededor de un resultado
  const getMatchPreview = (text: string, matchIndex: number, query: string): string => {
    const previewLength = 50; // Caracteres a cada lado del resultado
    const start = Math.max(0, matchIndex - previewLength);
    const end = Math.min(text.length, matchIndex + query.length + previewLength);
    
    let preview = text.substring(start, end);
    
    // Agregar elipsis si el texto se trunca
    if (start > 0) preview = '...' + preview;
    if (end < text.length) preview = preview + '...';
    
    return preview;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !pdfDocument) return;
    
    // Cancelar búsqueda anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsSearching(true);
    setResults([]);
    setPagesSearched(0);
    setCurrentResultIndex(-1);
    
    const foundResults: SearchResult[] = [];
    
    try {

      // Buscar en cada página
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        // Verificar si la búsqueda fue cancelada
        if (abortControllerRef.current.signal.aborted) {
          break;
        }
        
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
        
        // Buscar todas las ocurrencias
        const regex = new RegExp(searchQuery, 'gi');
        let match;
        
        while ((match = regex.exec(pageText)) !== null) {
          // Añadir resultado encontrado
          foundResults.push({
            pageNumber: i,
            text: match[0],
            matchIndex: match.index,
            preview: getMatchPreview(pageText, match.index, searchQuery),
          });
        }
        
        // Actualizar progreso
        setPagesSearched(i);
      }
      
      setResults(foundResults);
      
      // Seleccionar el primer resultado si hay alguno
      if (foundResults.length > 0) {
        setCurrentResultIndex(0);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error durante la búsqueda:', err);
      }
    } finally {
      setIsSearching(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSearching(false);
  };

  const navigateToResult = (index: number) => {
    if (index >= 0 && index < results.length) {
      setCurrentResultIndex(index);
      onSearchResultClick(results[index]);
    }
  };

  const isResultInCurrentPage = (result: SearchResult) => {
    return result.pageNumber === currentPage;
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Buscar en el documento</h3>
      
      <div className="flex mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Texto a buscar..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={isSearching}
        />
        
        {isSearching ? (
          <button
            onClick={handleCancelSearch}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200"
          >
            Cancelar
          </button>
        ) : (
          <button
            onClick={handleSearch}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-l-0 border-blue-600 rounded-r-md hover:bg-blue-700"
            disabled={!searchQuery.trim() || !pdfDocument}
          >
            Buscar
          </button>
        )}
      </div>
      
      {isSearching && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Buscando...</span>
            <span className="text-xs text-gray-500">{pagesSearched} de {totalPages} páginas</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div 
              className="h-2 bg-blue-600 rounded-full" 
              style={{ width: `${(pagesSearched / totalPages) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {results.length > 0 && !isSearching && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {results.length} resultados encontrados
            </span>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateToResult(currentResultIndex - 1)}
                disabled={currentResultIndex <= 0}
                className="p-1 text-gray-600 bg-gray-100 rounded disabled:opacity-50"
                title="Resultado anterior"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              <span className="text-xs text-gray-600">
                {currentResultIndex + 1} de {results.length}
              </span>
              
              <button
                onClick={() => navigateToResult(currentResultIndex + 1)}
                disabled={currentResultIndex >= results.length - 1}
                className="p-1 text-gray-600 bg-gray-100 rounded disabled:opacity-50"
                title="Resultado siguiente"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto border border-gray-200 rounded-md max-h-64">
            <ul className="divide-y divide-gray-200">
              {results.map((result, index) => (
                <li 
                  key={`${result.pageNumber}-${result.matchIndex}`}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                    index === currentResultIndex ? 'bg-blue-50' : ''
                  } ${isResultInCurrentPage(result) ? 'border-l-4 border-blue-500' : ''}`}
                  onClick={() => navigateToResult(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="px-2 py-1 mr-2 text-xs font-medium text-gray-600 bg-gray-200 rounded-full">
                        Pág. {result.pageNumber}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">
                    {result.preview.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                      part.toLowerCase() === searchQuery.toLowerCase() 
                        ? <mark key={i} className="bg-yellow-200">{part}</mark> 
                        : <span key={i}>{part}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {results.length === 0 && !isSearching && searchQuery && (
        <div className="p-4 text-center">
          <p className="text-gray-600">No se encontraron resultados para "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};

export default DocumentSearch;