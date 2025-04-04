import { useState } from 'react';
import { api } from '../api/client';

interface DocumentType {
  id: string;
  title: string;
  description?: string;
  filename: string;
  fileSize: number;
  status: string;
  mimeType?: string;
  createdAt: string;
  extractedContent?: Record<string, any>;
}

interface ContentSearchProps {
  onResultsFound?: (documents: DocumentType[]) => void;
}

const ContentSearch = ({ onResultsFound }: ContentSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Ingrese un término de búsqueda');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/documents/search/content?q=${encodeURIComponent(searchQuery)}`);
      
      if (onResultsFound) {
        onResultsFound(response.data);
      }
    } catch (err: any) {
      console.error('Error al buscar documentos:', err);
      setError(err?.response?.data?.message || 'Error al buscar documentos');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="mb-4 text-lg font-medium text-gray-900">Búsqueda por contenido</h2>
      <form onSubmit={handleSearch}>
        <div className="relative mt-1 rounded-md shadow-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pr-10 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Buscar texto dentro de documentos..."
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        
        <div className="mt-4">
          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <>
                <svg className="w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Buscando...
              </>
            ) : (
              'Buscar en contenido'
            )}
          </button>
        </div>
      </form>
      
      <div className="mt-4">
        <p className="text-sm text-gray-500">
          Esta búsqueda encuentra texto dentro del contenido extraído de los documentos.
          Solo los documentos procesados aparecerán en los resultados.
        </p>
      </div>
    </div>
  );
};

export default ContentSearch;