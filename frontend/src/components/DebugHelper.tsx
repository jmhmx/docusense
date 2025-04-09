// src/components/DebugHelper.tsx
import { useState } from 'react';
import { api } from '../api/client';

const DebugHelper = () => {
  const [showing, setShowing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [endpoint, setEndpoint] = useState('/api/health');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [payload, setPayload] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('token') || '');
  
  const testEndpoint = async () => {
    try {
      setError(null);
      let response;
      
      // Configurar headers manualmente para depuración
      const headers = {
        'Authorization': `Bearer ${authToken}`
      };
      
      if (method === 'GET') {
        response = await api.get(endpoint, { headers });
      } else {
        const payloadObj = payload ? JSON.parse(payload) : {};
        response = await api.post(endpoint, payloadObj, { headers });
      }
      
      setResult({
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      });
    } catch (err: any) {
      console.error('Error en prueba:', err);
      setError(`Error: ${err.message}`);
      
      if (err.response) {
        setResult({
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers
        });
      }
    }
  };
  
  if (!showing) {
    return (
      <button 
        onClick={() => setShowing(true)}
        className="fixed p-2 text-xs text-white bg-gray-800 rounded-md opacity-50 bottom-4 right-4 hover:opacity-100"
      >
        Debug
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 bg-white border border-gray-300 rounded-tl-lg shadow-lg w-96">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold">API Debugger</h3>
        <button onClick={() => setShowing(false)} className="text-gray-500 hover:text-gray-700">
          Close
        </button>
      </div>
      
      <div className="space-y-3 text-xs">
        <div>
          <label className="block mb-1">Endpoint:</label>
          <input 
            type="text" 
            value={endpoint} 
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full p-1 border border-gray-300 rounded"
          />
        </div>
        
        <div>
          <label className="block mb-1">Auth Token:</label>
          <textarea 
            value={authToken} 
            onChange={(e) => setAuthToken(e.target.value)}
            className="w-full h-16 p-1 border border-gray-300 rounded"
          />
          <div className="flex justify-end mt-1">
            <button 
              onClick={() => localStorage.setItem('token', authToken)}
              className="px-2 py-1 text-xs text-white bg-blue-500 rounded"
            >
              Save to localStorage
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input 
              type="radio" 
              checked={method === 'GET'} 
              onChange={() => setMethod('GET')}
              className="mr-1"
            />
            GET
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              checked={method === 'POST'} 
              onChange={() => setMethod('POST')}
              className="mr-1"
            />
            POST
          </label>
        </div>
        
        {method === 'POST' && (
          <div>
            <label className="block mb-1">Payload (JSON):</label>
            <textarea 
              value={payload} 
              onChange={(e) => setPayload(e.target.value)}
              className="w-full h-16 p-1 border border-gray-300 rounded"
            />
          </div>
        )}
        
        <button 
          onClick={testEndpoint}
          className="w-full p-2 text-white bg-blue-600 rounded"
        >
          Test Endpoint
        </button>
        
        {error && (
          <div className="p-2 text-red-800 bg-red-100 rounded">
            {error}
          </div>
        )}
        
        {result && (
          <div className="p-2 mt-2 overflow-auto bg-gray-100 rounded max-h-40">
            <p><strong>Status:</strong> {result.status} {result.statusText}</p>
            <p className="mt-1"><strong>Response:</strong></p>
            <pre className="mt-1 text-xs">{JSON.stringify(result.data, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugHelper;