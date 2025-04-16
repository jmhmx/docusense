// frontend/src/components/EfirmaManager.tsx
import { useState } from 'react';
import { api } from '../api/client';
import Button from './Button';

const EfirmaManager = () => {
  const [certificados, setCertificados] = useState<any[]>([]);
  const [llaves, setLlaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [llaveFile, setLlaveFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  
  const handleUploadCertificado = async () => {
    if (!certificadoFile) {
      setError('Por favor seleccione un archivo de certificado');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('certificado', certificadoFile);
    
    try {
      const response = await api.post('/api/sat/efirma/subir-certificado', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setSuccess('Certificado subido correctamente');
        await fetchCertificados();
      } else {
        setError(response.data.error || 'Error al subir certificado');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al subir certificado');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUploadLlave = async () => {
    if (!llaveFile) {
      setError('Por favor seleccione un archivo de llave privada');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('llave', llaveFile);
    
    try {
      const response = await api.post('/api/sat/efirma/subir-llave', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setSuccess('Llave privada subida correctamente');
        await fetchLlaves();
      } else {
        setError(response.data.error || 'Error al subir llave privada');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al subir llave privada');
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchCertificados = async () => {
    try {
      // Simulado para el ejemplo
      setCertificados([
        { id: 1, nombre: 'certificado_prueba.cer', rfc: 'TEST010101ABC', vigencia: '2027-01-01' }
      ]);
    } catch (err) {
      console.error('Error al cargar certificados:', err);
    }
  };
  
  const fetchLlaves = async () => {
    try {
      // Simulado para el ejemplo
      setLlaves([
        { id: 1, nombre: 'llave_prueba.key' }
      ]);
    } catch (err) {
      console.error('Error al cargar llaves privadas:', err);
    }
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">Gestor de e.firma (antes FIEL)</h3>
      
      {error && (
        <div className="p-4 mb-4 border-l-4 border-red-400 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="p-4 mb-4 border-l-4 border-green-400 bg-green-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid gap-6 mb-6 md:grid-cols-2">
        <div className="p-4 border rounded-md">
          <h4 className="mb-4 font-medium">Subir Certificado (.cer)</h4>
          
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Seleccionar Certificado (.cer)
            </label>
            <input
              type="file"
              accept=".cer"
              onChange={(e) => setCertificadoFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          <Button
            onClick={handleUploadCertificado}
            disabled={isLoading || !certificadoFile}
          >
            {isLoading ? 'Subiendo...' : 'Subir Certificado'}
          </Button>
        </div>
        
        <div className="p-4 border rounded-md">
          <h4 className="mb-4 font-medium">Subir Llave Privada (.key)</h4>
          
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Seleccionar Llave Privada (.key)
            </label>
            <input
              type="file"
              accept=".key"
              onChange={(e) => setLlaveFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Contraseña de la Llave Privada
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Contraseña"
            />
          </div>
          
          <Button
            onClick={handleUploadLlave}
            disabled={isLoading || !llaveFile || !password}
          >
            {isLoading ? 'Subiendo...' : 'Subir Llave Privada'}
          </Button>
        </div>
      </div>
      
      <div className="mt-8">
        <h4 className="mb-4 font-medium">Certificados Disponibles</h4>
        
        {certificados.length === 0 ? (
          <p className="text-sm text-gray-500">No hay certificados disponibles</p>
        ) : (
          <div className="overflow-hidden border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    RFC
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Vigencia
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {certificados.map((cert) => (
                  <tr key={cert.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {cert.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {cert.rfc}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {cert.vigencia}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="mt-8">
        <h4 className="mb-4 font-medium">Llaves Privadas Disponibles</h4>
        
        {llaves.length === 0 ? (
          <p className="text-sm text-gray-500">No hay llaves privadas disponibles</p>
        ) : (
          <div className="overflow-hidden border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Nombre
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {llaves.map((llave) => (
                  <tr key={llave.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {llave.nombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="p-4 mt-8 text-blue-700 rounded-md bg-blue-50">
        <h4 className="mb-2 font-medium">Información Importante</h4>
        <ul className="ml-6 list-disc">
          <li className="mb-1">La e.firma (antes FIEL) y los Certificados de Sello Digital (CSD) son archivos emitidos por el SAT.</li>
          <li className="mb-1">Los archivos se almacenan de manera segura y cifrada en el servidor.</li>
          <li className="mb-1">Estos certificados se utilizan para la firma y timbrado de CFDIs.</li>
          <li className="mb-1">Asegúrese de mantener su contraseña de llave privada en un lugar seguro.</li>
        </ul>
      </div>
    </div>
  );
};

export default EfirmaManager;