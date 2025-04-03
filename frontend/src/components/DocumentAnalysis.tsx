import { useState } from 'react';
import { api } from '../api/client';

interface AnalysisResult {
  summary: string;
  keyPhrases: string[];
  entities: Array<{ text: string; type: string }>;
  sentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  statistics: {
    wordCount: number;
    characterCount: number;
    sentenceCount: number;
    paragraphCount: number;
  };
}

interface DocumentAnalysisProps {
  documentId: string;
  onAnalysisComplete?: (result: AnalysisResult) => void;
}

const DocumentAnalysis = ({ documentId, onAnalysisComplete }: DocumentAnalysisProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyzeDocument = async () => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/documents/${documentId}/analyze`);
      setResult(response.data);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(response.data);
      }
    } catch (err: any) {
      console.error('Error al analizar documento:', err);
      setError(err?.response?.data?.message || 'Error al analizar el documento');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="overflow-hidden bg-white rounded-lg shadow">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Análisis de documento
        </h3>
        <p className="max-w-2xl mt-1 text-sm text-gray-500">
          Análisis detallado del contenido del documento.
        </p>
      </div>

      {!result && (
        <div className="p-6 text-center">
          {error ? (
            <div className="p-4 mb-4 rounded-md bg-red-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay análisis disponible</h3>
              <p className="mt-1 text-sm text-gray-500">
                Realiza un análisis para extraer información clave del documento.
              </p>
            </>
          )}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleAnalyzeDocument}
              disabled={isAnalyzing}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <svg className="w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analizando...
                </>
              ) : (
                'Analizar documento'
              )}
            </button>
          </div>
        </div>
      )}
</div>
      