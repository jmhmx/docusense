// frontend/src/components/EfirmaManager.tsx
import { useState, useRef } from 'react';
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
  const [isValidatingCer, setIsValidatingCer] = useState(false);
  const [certificadoInfo, setCertificadoInfo] = useState<any>(null);
  
  // Refs para resetear los inputs de archivo
  const certificadoInputRef = useRef<HTMLInputElement>(null);
  const llaveInputRef = useRef<HTMLInputElement>(null);

  // Validar archivo de certificado
  const validateCerFile = (file: File | null) => {
    if (!file) return false;
    
    // Verificar extensión
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'cer') {
      setError('El archivo debe tener extensión .cer');
      return false;
    }
    
    // Verificar tamaño (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('El archivo no debe exceder 1MB');
      return false;
    }
    
    return true;
  };
  
  // Validar archivo de llave privada
  const validateKeyFile = (file: File | null) => {
    if (!file) return false;
    
    // Verificar extensión
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'key') {
      setError('El archivo debe tener extensión .key');
      return false;
    }
    
    // Verificar tamaño (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('El archivo no debe exceder 1MB');
      return false;
    }
    
    return true;
  };
  
  const handleUploadCertificado = async () => {
    if (!validateCerFile(certificadoFile)) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setIsValidatingCer(true);
    
    const formData = new FormData();
    formData.append('certificado', certificadoFile!);
    
    try {
      const response = await api.post('/api/sat/efirma/subir-certificado', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setSuccess('Certificado subido y validado correctamente');
        setCertificadoInfo(response.data);
        await fetchCertificados();
        
        // Limpiar el input de archivo
        if (certificadoInputRef.current) {
          certificadoInputRef.current.value = '';
        }
        setCertificadoFile(null);
      } else {
        setError(response.data.error || 'Error al validar certificado');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al subir certificado');
    } finally {
      setIsLoading(false);
      setIsValidatingCer(false);
    }
  };
  
  const handleUploadLlave = async () => {
    if (!validateKeyFile(llaveFile)) return;
    
    if (!password || password.length < 6) {
      setError('Debe ingresar una contraseña válida (mínimo 6 caracteres)');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('llave', llaveFile!);
    formData.append('password', password);
    
    try {
      const response = await api.post('/api/sat/efirma/subir-llave', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setSuccess('Llave privada subida correctamente');
        await fetchLlaves();
        
        // Limpiar el input de archivo y contraseña
        if (llaveInputRef.current) {
          llaveInputRef.current.value = '';
        }
        setLlaveFile(null);
        setPassword('');
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
      const response = await api.get('/api/sat/efirma/certificados');
      setCertificados(response.data || []);
    } catch (err: any) {
      console.error('Error al cargar certificados:', err);
    }
  };
  
  const fetchLlaves = async () => {
    try {
      const response = await api.get('/api/sat/efirma/llaves');
      setLlaves(response.data || []);
    } catch (err: any) {
      console.error('Error al cargar llaves privadas:', err);
    }
  };
  
  // Cargar certificados y llaves al montar el componente
  useEffect(() => {
    fetchCertificados();
    fetchLlaves();
  }, []);
  
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
              ref={certificadoInputRef}
              accept=".cer"
              onChange={(e) => setCertificadoFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Solo archivos .cer con un tamaño máximo de 1MB
            </p>
          </div>
          
          {isValidatingCer && certificadoInfo && (
            <div className="p-3 mb-4 border border-blue-200 rounded-md bg-blue-50">
              <h5 className="text-sm font-medium text-blue-800">Información del certificado</h5>
              <p className="mt-1 text-xs text-blue-700">RFC: {certificadoInfo.rfc}</p>
              <p className="text-xs text-blue-700">Vigencia: {new Date(certificadoInfo.fechaVigenciaInicio).toLocaleDateString()} - {new Date(certificadoInfo.fechaVigenciaFin).toLocaleDateString()}</p>
            </div>
          )}
          
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
              ref={llaveInputRef}
              accept=".key"
              onChange={(e) => setLlaveFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Solo archivos .key con un tamaño máximo de 1MB
            </p>
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
              placeholder="Contraseña (mínimo 6 caracteres)"
              minLength={6}
            />
            <p className="mt-1 text-xs text-gray-500">
              La contraseña no se almacena y solo se utiliza para desencriptar la llave
            </p>
          </div>
          
          <Button
            onClick={handleUploadLlave}
            disabled={isLoading || !llaveFile || !password || password.length < 6}
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
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Acciones
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
                      {new Date(cert.vigenciaInicio).toLocaleDateString()} - {new Date(cert.vigenciaFin).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      <button 
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => {/* Implementar vista detallada */}}
                      >
                        Ver detalles
                      </button>
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
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Fecha de subida
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {llaves.map((llave) => (
                  <tr key={llave.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {llave.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(llave.fechaSubida).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        Verificada
                      </span>
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
          <li className="mb-1">La e.firma (antes FIEL) es personal e intransferible.</li>
          <li className="mb-1">Los archivos se almacenan de manera segura y cifrada temporalmente.</li>
          <li className="mb-1">Los archivos se eliminan automáticamente después de 24 horas.</li>
          <li className="mb-1">La contraseña nunca se almacena en nuestros servidores.</li>
          <li className="mb-1">Asegúrese de tener la contraseña correcta para su e.firma.</li>
        </ul>
      </div>
    </div>
  );
};

export default EfirmaManager;