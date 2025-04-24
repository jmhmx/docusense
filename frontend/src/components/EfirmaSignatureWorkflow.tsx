import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from './Button';

interface EfirmaSignatureWorkflowProps {
  documentId: string;
  documentTitle: string;
  position: {
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  reason: string;
  onSuccess: (result: any) => void;
  onCancel: () => void;
}

interface Certificate {
  id: string;
  nombre: string;
  rfc: string;
  vigenciaInicio: string;
  vigenciaFin: string;
}

const EfirmaSignatureWorkflow = ({
  documentId,
  documentTitle,
  position,
  reason,
  onSuccess,
  onCancel
}: EfirmaSignatureWorkflowProps) => {
  const [step, setStep] = useState<'certificates' | 'password' | 'processing' | 'success' | 'error'>('certificates');
  const [availableCertificates, setAvailableCertificates] = useState<Certificate[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar certificados disponibles
  useEffect(() => {
    const fetchCertificates = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/api/sat/efirma/certificados');
        setAvailableCertificates(response.data || []);
      } catch (err: any) {
        console.error('Error al cargar certificados:', err);
        setError(err?.response?.data?.message || 'Error al cargar certificados disponibles');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCertificates();
  }, []);
  
  // Manejar selección de certificado
  const handleSelectCertificate = (certificateId: string) => {
    setSelectedCertificate(certificateId);
    setStep('password');
  };
  
  // Manejar verificación de contraseña
  const handlePasswordVerification = async () => {
    if (!selectedCertificate || !password) {
      setError('Debe seleccionar un certificado e ingresar la contraseña');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setStep('processing');
    
    try {
      const response = await api.post(`/api/signatures/${documentId}/efirma`, {
        tokenId: selectedCertificate,
        password,
        position,
        reason
      });
      
      if (response.data.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess(response.data);
        }, 1500);
      } else {
        throw new Error(response.data.message || 'Error al firmar con e.firma');
      }
    } catch (err: any) {
      console.error('Error al firmar con e.firma:', err);
      setError(err?.response?.data?.message || 'Error al verificar contraseña o firmar documento');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  return (
    <div className="w-full max-w-3xl p-6 bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-4 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Firma con e.firma (FIEL)</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
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
      
      {step === 'certificates' && (
        <div>
          <p className="mb-4 text-gray-600">
            Seleccione el certificado que desea utilizar para firmar el documento <span className="font-medium">{documentTitle}</span>.
          </p>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <svg className="w-8 h-8 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : availableCertificates.length === 0 ? (
            <div className="py-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay certificados disponibles</h3>
              <p className="mt-1 text-sm text-gray-500">
                Debe cargar su certificado .cer y llave privada .key antes de continuar.
              </p>
              <div className="mt-6">
                <Button
                  onClick={() => window.location.href = '/efirma-manager'}
                  variant="primary"
                >
                  Ir a Gestor de e.firma
                </Button>
              </div>
            </div>
          ) : (
            <div className="pr-2 space-y-4 overflow-y-auto max-h-64">
              {availableCertificates.map((cert) => (
                <div 
                  key={cert.id}
                  className={`border p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedCertificate === cert.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                  onClick={() => handleSelectCertificate(cert.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{cert.nombre}</h4>
                      <p className="text-sm text-gray-500">RFC: {cert.rfc}</p>
                      <p className="text-sm text-gray-500">
                        Vigencia: {formatDate(cert.vigenciaInicio)} - {formatDate(cert.vigenciaFin)}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      selectedCertificate === cert.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedCertificate === cert.id && (
                        <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 13L9 17L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end mt-6 space-x-3">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            {availableCertificates.length > 0 && (
              <Button 
                variant="primary" 
                onClick={() => setStep('password')}
                disabled={!selectedCertificate}
              >
                Continuar
              </Button>
            )}
          </div>
        </div>
      )}
      
      {step === 'password' && (
        <div>
          <p className="mb-4 text-gray-600">
            Ingrese la contraseña de su llave privada para firmar el documento.
          </p>
          
          <div className="mb-4">
            <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700">
              Contraseña de la llave privada
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Contraseña"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-gray-500">
              La contraseña no se almacena y solo se utiliza para firmar este documento.
            </p>
          </div>
          
          <div className="p-4 mb-4 rounded-md bg-blue-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Información importante</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Al continuar, está firmando digitalmente el documento &quot;{documentTitle}&quot; 
                    con su e.firma (FIEL). Esta acción tiene validez legal de acuerdo con la 
                    Ley de Firma Electrónica Avanzada.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6 space-x-3">
            <Button variant="secondary" onClick={() => setStep('certificates')}>
              Atrás
            </Button>
            <Button 
              variant="primary" 
              onClick={handlePasswordVerification}
              disabled={!password}
            >
              Firmar Documento
            </Button>
          </div>
        </div>
      )}
      
      {step === 'processing' && (
        <div className="py-8 text-center">
          <svg className="w-12 h-12 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900">Procesando firma digital</p>
          <p className="mt-2 text-sm text-gray-500">
            Estamos firmando el documento con su e.firma. Por favor, espere...
          </p>
        </div>
      )}
      
      {step === 'success' && (
        <div className="py-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
            <svg className="w-10 h-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-3 text-lg font-medium text-gray-900">¡Documento firmado correctamente!</h3>
          <p className="mt-2 text-sm text-gray-500">
            El documento ha sido firmado exitosamente con su e.firma (FIEL).
          </p>
        </div>
      )}
      
      {step === 'error' && (
        <div className="py-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full">
            <svg className="w-10 h-10 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="mt-3 text-lg font-medium text-gray-900">Error al firmar documento</h3>
          <p className="mt-2 text-sm text-gray-500">
            {error || 'Se produjo un error al firmar el documento. Por favor, intente nuevamente.'}
          </p>
          <div className="flex justify-center mt-6">
            <Button variant="primary" onClick={() => setStep('password')}>
              Intentar nuevamente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EfirmaSignatureWorkflow;