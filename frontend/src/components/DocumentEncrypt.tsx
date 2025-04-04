import { useState } from 'react';
import { api } from '../api/client';
import Button from './Button';

interface DocumentEncryptProps {
  documentId: string;
  isEncrypted: boolean;
  onEncryptSuccess?: () => void;
}

const DocumentEncrypt = ({ documentId, isEncrypted, onEncryptSuccess }: DocumentEncryptProps) => {
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Si la verificación es exitosa, proceder con el cifrado
      encryptDocument();
    } catch (err: any) {
      console.error('Error al verificar código:', err);
      setError(err?.response?.data?.message || 'Código de verificación inválido');
    } finally {
      setIsLoading(false);
    }
  };

  // Cifrar documento
  const encryptDocument = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await api.post(`/api/documents/${documentId}/encrypt`);
      
      setShowEncryptModal(false);
      setShowVerification(false);
      setVerificationCode('');
      
      if (onEncryptSuccess) {
        onEncryptSuccess();
      }
    } catch (err: any) {
      console.error('Error al cifrar documento:', err);
      setError(err?.response?.data?.message || 'Error al cifrar el documento');
    } finally {
      setIsLoading(false);
    }
  };

  // Si ya está cifrado, mostrar un mensaje
  if (isEncrypted) {
    return (
      <div className="p-4 mt-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="font-medium text-blue-800">Este documento está cifrado</span>
        </div>
        <p className="mt-2 text-sm text-blue-700">
          El contenido de este documento está protegido con cifrado AES-256.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Button
        onClick={() => setShowEncryptModal(true)}
        variant="secondary"
        className="flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Cifrar documento
      </Button>

      {/* Modal de cifrado */}
      {showEncryptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="w-full max-w-md p-8 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Cifrar documento</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEncryptModal(false);
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
                <div className="p-4 mb-6 rounded-md bg-yellow-50">
                  <p className="text-sm text-yellow-700">
                    <strong>Importante:</strong> Al cifrar este documento, su contenido quedará protegido y solo los usuarios autorizados podrán acceder a él.
                  </p>
                  <p className="mt-2 text-sm text-yellow-700">
                    Esta acción no se puede deshacer. ¿Está seguro de querer continuar?
                  </p>
                </div>
                
                <div className="flex justify-end mt-6 space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowEncryptModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={requestVerificationCode}
                    disabled={isLoading}
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
                    {isLoading ? 'Verificando...' : 'Cifrar documento'}
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

export default DocumentEncrypt;