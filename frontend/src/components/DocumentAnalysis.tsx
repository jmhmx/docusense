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
  const [exportFormat, setExportFormat] = useState<'json' | 'text'>('json');

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

  const handleExportAnalysis = () => {
    if (!result) return;
    
    let content = '';
    let filename = `document-analysis-${documentId}`;
    let mimeType = '';
    
    if (exportFormat === 'json') {
      content = JSON.stringify(result, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    } else {
      // Texto plano formateado
      content = `ANÁLISIS DE DOCUMENTO
===================

RESUMEN
-------
${result.summary}

FRASES CLAVE
-----------
${result.keyPhrases.join('\n')}

ENTIDADES DETECTADAS
------------------
${result.entities.map(e => `- ${e.text} (${e.type})`).join('\n')}

SENTIMIENTO
----------
${result.sentiment.label.toUpperCase()} (Puntuación: ${result.sentiment.score.toFixed(2)})

ESTADÍSTICAS
-----------
- Palabras: ${result.statistics.wordCount}
- Caracteres: ${result.statistics.characterCount}
- Oraciones: ${result.statistics.sentenceCount}
- Párrafos: ${result.statistics.paragraphCount}
`;
      filename += '.txt';
      mimeType = 'text/plain';
    }
    
    // Crear un Blob y descargarlo
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

      {result && (
        <div className="px-4 py-5 sm:px-6">
          {/* Resumen */}
          <div className="mb-6">
            <h4 className="text-base font-medium text-gray-900">Resumen</h4>
            <p className="mt-2 text-sm text-gray-600">{result.summary}</p>
          </div>

          {/* Frases clave */}
          <div className="mb-6">
            <h4 className="text-base font-medium text-gray-900">Frases clave</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {result.keyPhrases.map((phrase, index) => (
                <span 
                  key={index} 
                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full"
                >
                  {phrase}
                </span>
              ))}
            </div>
          </div>

          {/* Entidades */}
          {result.entities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-base font-medium text-gray-900">Entidades detectadas</h4>
              <div className="mt-2 overflow-hidden bg-white shadow sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {result.entities.map((entity, index) => (
                    <li key={index} className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-900">{entity.text}</div>
                        <div className="ml-2 text-xs font-medium text-gray-500">{entity.type}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Sentimiento */}
          <div className="mb-6">
            <h4 className="text-base font-medium text-gray-900">Análisis de sentimiento</h4>
            <div className="flex items-center mt-2">
              <span className={`text-lg font-bold ${getSentimentColor(result.sentiment.label)}`}>
                {result.sentiment.label.toUpperCase()}
              </span>
              <div className="relative w-full h-4 mx-4 bg-gray-200 rounded">
                <div 
                  className={`absolute h-4 rounded ${
                    result.sentiment.label === 'positive' ? 'bg-green-500' : 
                    result.sentiment.label === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                  }`}
                  style={{ 
                    width: `${Math.abs(result.sentiment.score) * 100}%`,
                    left: result.sentiment.score < 0 ? '50%' : result.sentiment.score > 0 ? '50%' : '50%',
                    transform: result.sentiment.score < 0 ? 'translateX(-100%)' : 'none'
                  }}
                ></div>
                <div className="absolute w-px h-4 transform -translate-x-1/2 bg-gray-400 left-1/2"></div>
              </div>
              <span className="text-sm text-gray-600">
                Score: {result.sentiment.score.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mb-6">
            <h4 className="text-base font-medium text-gray-900">Estadísticas</h4>
            <div className="grid grid-cols-2 gap-4 mt-2 sm:grid-cols-4">
              <div className="p-3 rounded-md bg-gray-50">
                <p className="text-sm font-medium text-gray-500">Palabras</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{result.statistics.wordCount}</p>
              </div>
              <div className="p-3 rounded-md bg-gray-50">
                <p className="text-sm font-medium text-gray-500">Caracteres</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{result.statistics.characterCount}</p>
              </div>
              <div className="p-3 rounded-md bg-gray-50">
                <p className="text-sm font-medium text-gray-500">Oraciones</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{result.statistics.sentenceCount}</p>
              </div>
              <div className="p-3 rounded-md bg-gray-50">
                <p className="text-sm font-medium text-gray-500">Párrafos</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{result.statistics.paragraphCount}</p>
              </div>
            </div>
          </div>

          {/* Exportar */}
          <div className="pt-5 mt-6 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="mr-2">
                <select
                  id="export-format"
                  name="export-format"
                  className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'text')}
                >
                  <option value="json">JSON</option>
                  <option value="text">Texto plano</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleExportAnalysis}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar análisis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentAnalysis;