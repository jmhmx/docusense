import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';
import Button from './Button';

interface SignaturePosition {
  page: number;
  x: number;
  y: number;
}

interface Signature {
  id: string;
  userId: string;
  signedAt: string;
  reason?: string;
  valid: boolean;
  user?: {
    name: string;
    email: string;
  };
}

interface DocumentSignatureProps {
  documentId: string;
  onSignSuccess?: () => void;
}

const DocumentSignature = ({ documentId, onSignSuccess }: DocumentSignatureProps) => {
  const [showSignModal, setShowSignModal] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawSignature, setDrawSignature] = useState(false);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(true);

  // Cargar firmas existentes
  useEffect(() => {
    const fetchSignatures = async () => {
      setIsLoadingSignatures(true);
      try {
        const response = await api.get(`/api/signatures/document/${documentId}`);
        setSignatures(response.data);
      } catch (err: any) {
        console.error('Error al cargar firmas:', err);
      } finally {
        setIsLoadingSignatures(false);
      }
    };

    fetchSignatures();
  }, [documentId]);

  // Dibujar firma en canvas
  useEffect(() => {
    if (canvasRef.current && drawSignature) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0040A0';
        ctx.font = '16px Arial';
        ctx.fillStyle = '#0040A0';
        
        const date = new Date().toLocaleDateString();
        ctx.fillText(`Firmado digitalmente`, 10, 20);
        ctx.fillText(`Fecha: ${date}`, 10, 40);
        
        // Dibujar borde
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.stroke();
      }
    }
  }, [drawSignature]);

  // Solicitar código de verificación
  const requestVerificationCode = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/api/auth/2fa/generate');
      setVerificationId(response.data.code);
      setShowVerification(true);
    } catch (err: any) {
      console.error('Error al solicitar código de verificación:', err);
      setError(err?.response?.data?.message || 'Error al solicitar código de verificación');
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar código
  const verifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Debe ingresar el código de 6 dígitos');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await api.post('/api/auth/2fa/verify', { code: verificationCode });
      // Si la verificación es exitosa, proceder con la firma
      signDocument();
    } catch (err: any) {
      console.error('Error al verificar código:', err);
      setError(err?.response?.data?.message || 'Código de verificación inválido');
    } finally {
      setIsLoading(false);
    }
  };

  // Firmar documento
  const signDocument = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        reason: reason.trim() || 'Firma de documento',
        position: signaturePosition,
      };
      
      await api.post(`/api/signatures/${documentId}`, payload);
      
      // Actualizar la lista de firmas
      const response = await api.get(`/api/signatures/document/${documentId}`);
      setSignatures(response.data);
      
      // Cerrar modal
      setShowSignModal(false);
      setShowVerification(false);
      setVerificationCode('');
      setSignaturePosition(null);
      setReason('');
      
      if (onSignSuccess) {
        onSignSuccess();
      }
    } catch (err: any) {
      console.error('Error al firmar documento:', err);
      setError(err?.response?.data?.message || 'Error al firmar el documento');
    } finally {
      setIsLoading(false);
    }
  };

  // Establecer posición de firma
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSignaturePosition({
      page: 1, // Por defecto, primera página
      x,
      y,
    });
    
    setDrawSignature(true);
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mt-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Firmas del documento</h3>
        
        {isLoadingSignatures ? (
          <div className="flex justify-center py-8">
            <svg className="w-8 h-8 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : signatures.length === 0 ? (
          <div className="py-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay firmas</h3>
            <p className="mt-1 text-sm text-gray-500">Este documento aún no ha sido firmado.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden bg-white shadow sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {signatures.map((signature) => (
                <li key={signature.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                          <span className="text-sm font-medium text-blue-800">
                            {signature.user?.name?.substring(0, 2).toUpperCase() || 'US'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <h4 className="text-sm font-medium text-gray-900">{signature.user?.name || 'Usuario'}</h4>
                          <p className="text-sm text-gray-500">{signature.user?.email || signature.userId}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Firmado el {formatDate(signature.signedAt)}
                        </p>
                        {signature.reason && (
                          <p className="mt-1 text-sm text-gray-500">
                            Motivo: {signature.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        signature.valid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {signature.valid ? 'Válida' : 'Inválida'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="flex justify-center mt-6">
          <Button 
            onClick={() => setShowSignModal(true)}
            variant="primary"
          >
            Firmar documento
          </Button>
        </div>
      </div>

      {/* Modal de firma */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="w-full max-w-md p-8 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Firmar documento</h3>
              <button
                type="button"
                onClick={() => {
                  setShowSignModal(false);
                  setShowVerification(false);
                  setVerificationCode('');
                  setError(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Cerrar</span>
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

            {!showVerification ? (
              <div>
                <div className="mb-4">
                  <label htmlFor="reason" className="block mb-1 text-sm font-medium text-gray-700">
                    Motivo de la firma (opcional)
                  </label>
                  <input
                    type="text"
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Ej: Aprobación del documento"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Posición de la firma
                  </label>
                  <div className="overflow-hidden border border-gray-300 rounded-md">
                    <canvas 
                      ref={canvasRef}
                      width={400}
                      height={100}
                      onClick={handleCanvasClick}
                      className="w-full cursor-pointer"
                    ></canvas>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Haga clic en el área para colocar su firma
                  </p>
                </div>
                
                <div className="flex justify-end mt-6 space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowSignModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={requestVerificationCode}
                    disabled={isLoading || !drawSignature}
                  >
                    {isLoading ? 'Procesando...' : 'Continuar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="p-4 mb-6 rounded-md bg-blue-50">
                  <p className="text-sm text-blue-700">
                    Por seguridad, se requiere verificación en dos pasos.
                    Hemos enviado un código a su correo electrónico.
                  </p>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="verification-code" className="block mb-1 text-sm font-medium text-gray-700">
                    Código de verificación
                  </label>
                  <input
                    type="text"
                    id="verification-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Ingrese el código de 6 dígitos"
                    maxLength={6}
                  />
                  {verificationId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Para propósitos de prueba, el código es: {verificationId}
                    </p>
                  )}
                </div>
                
                <div className="flex justify-end mt-6 space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowVerification(false);
                      setVerificationCode('');
                    }}
                  >
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={verifyCode}
                    disabled={isLoading || verificationCode.length !== 6}
                  >
                    {isLoading ? 'Verificando...' : 'Firmar documento'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSignature;