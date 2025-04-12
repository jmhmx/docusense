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
  position?: string;
  user?: {
    name: string;
    email: string;
  };
}

interface DocumentSignatureProps {
  documentId: string;
  documentTitle: string;
  documentStatus: string;
  onSignSuccess?: () => void;
}

const DocumentSignature = ({ 
  documentId, 
  documentTitle,
  documentStatus,
  onSignSuccess 
}: DocumentSignatureProps) => {
  const [showSignModal, setShowSignModal] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [canSign, setCanSign] = useState(true);
  const [cannotSignReason, setCannotSignReason] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{id: string, name: string} | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<{
  intact: boolean;
  verifiedAt: string;
  signatures?: Array<{
    id: string;
    userId: string;
    userName?: string;
    signedAt: string;
    isValid: boolean;
  }>;
  hashAlgorithm?: string;
} | null>(null);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(true);
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawSignature, setDrawSignature] = useState(false);

  // Load current user
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setCurrentUser(JSON.parse(userData));
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    }
  }, []);

  // Check if user can sign
  useEffect(() => {
    const checkCanSign = async () => {
      if (!documentId || !currentUser) return;
      
      try {
        console.log("Checking if user can sign document:", documentId);
        // Make sure this URL matches the endpoint in your backend controller
        const response = await api.get(`/api/signatures/can-sign/${documentId}`);
        console.log("Can sign response:", response.data);
        
        setCanSign(response.data.canSign);
        if (!response.data.canSign) {
          setCannotSignReason(response.data.reason);
        }
      } catch (err:any) {
        console.error('Error checking if user can sign:', err);
        // Show more detailed error
        let errorMsg = 'Error checking signature permissions';
        if (err.response) {
          errorMsg += `: ${err.response.status} - ${err.response.data?.message || 'Unknown error'}`;
        } else if (err.message) {
          errorMsg += `: ${err.message}`;
        }
        setCanSign(false);
        setCannotSignReason(errorMsg);
      }
    };
    
    checkCanSign();
  }, [documentId, currentUser]);

  // Load existing signatures
  useEffect(() => {
    const fetchSignatures = async () => {
      if (!documentId) return;
      
      setIsLoadingSignatures(true);
      try {
        const response = await api.get(`/api/signatures/document/${documentId}`);
        setSignatures(response.data);
      } catch (err) {
        console.error('Error loading signatures:', err);
      } finally {
        setIsLoadingSignatures(false);
      }
    };

    fetchSignatures();
  }, [documentId]);

  // Initialize drawing canvas when signature modal opens
  useEffect(() => {
    if (canvasRef.current && showSignModal) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0040A0';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#0040A0';
        
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.stroke();
        
        ctx.fillText('Haga clic para colocar su firma', 10, 20);
      }
    }
  }, [showSignModal]);

  // Draw signature preview
  useEffect(() => {
    if (canvasRef.current && drawSignature) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set styles
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0040A0';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#0040A0';
        
        // Draw signature box
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.stroke();
        
        // Draw signature content
        const date = new Date().toLocaleDateString();
        const userName = currentUser?.name || 'Usuario';
        
        ctx.fillText(`Firmado digitalmente por:`, 10, 20);
        ctx.fillText(userName, 10, 40);
        ctx.fillText(`Fecha: ${date}`, 10, 60);
        if (reason) {
          ctx.fillText(`Motivo: ${reason}`, 10, 80);
        }
      }
    }
  }, [drawSignature, reason, currentUser]);

  // Verify document integrity
  const verifyDocumentIntegrity = async () => {
    if (!documentId) return;
    
    setIsVerifyingIntegrity(true);
    
    try {
      const response = await api.get(`/api/signatures/document/${documentId}/integrity`);
      setIntegrityStatus({
        intact: response.data.intact,
        verifiedAt: response.data.verifiedAt,
        signatures: response.data.signatures,
        hashAlgorithm: response.data.hashAlgorithm
      });
      
      // Guardar alerta en auditoría si el documento fue modificado
      if (!response.data.intact) {
        await api.post('/api/audit', {
          action: 'integrity_alert',
          resourceId: documentId,
          details: {
            verifiedAt: response.data.verifiedAt,
            signatureCount: response.data.signatures.length
          }
        });
      }
    } catch (err) {
      console.error('Error verificando integridad:', err);
      setError('No se pudo verificar la integridad');
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  // Request 2FA verification code
  const requestVerificationCode = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/api/auth/2fa/generate');
      setVerificationId(response.data.code);
      setShowVerification(true);
    } catch (err: any) {
      console.error('Error requesting verification code:', err);
      setError(err?.response?.data?.message || 'Error requesting verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify 2FA code
  const verifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await api.post('/api/auth/2fa/verify', { code: verificationCode });
      signDocument();
    } catch (err: any) {
      console.error('Error verifying code:', err);
      setError(err?.response?.data?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign document
  const signDocument = async () => {
    if (!signaturePosition) {
    setError('Por favor seleccione una posición para la firma');
    return;
    }
    
    // Verificar si el usuario tiene biometría configurada
    if (hasBiometrics) {
      // Mostrar modal de verificación biométrica
      setShowBiometricVerification(true);
    } else {
      // Proceder con verificación de 2FA estándar
      await requestVerificationCode();
    }
  
  };

  const handleBiometricSuccess = async (result: any) => {
  // Resultado contiene datos de verificación biométrica
  setIsLoading(true);
  setError(null);
  
  try {
    // Asegurarse de tener toda la información necesaria
    if (!documentId || !signaturePosition) {
      throw new Error('Información de firma incompleta');
    }
    
    // Crear payload con información biométrica
    const payload = {
      position: signaturePosition,
      reason: reason.trim() || 'Document signature',
      biometricVerification: {
        timestamp: Date.now(),
        challenge: result.challenge || 'blink',
        score: result.score || 0.9,
        method: result.method || 'facial-recognition'
      }
    };
    
    // Enviar solicitud de firma con verificación biométrica
    const response = await api.post(`/api/signatures/${documentId}/biometric`, payload);
    
    // Recargar firmas
    const signaturesResponse = await api.get(`/api/signatures/document/${documentId}`);
    setSignatures(signaturesResponse.data);
    
    // Resetear estado y cerrar modales
    setShowBiometricVerification(false);
    setSignaturePosition(null);
    setReason('');
    setDrawSignature(false);
    
    // Mostrar mensaje de éxito
    setSuccessMessage('Documento firmado exitosamente con verificación biométrica');
    
    if (onSignSuccess) {
      onSignSuccess();
    }
  } catch (err: any) {
    console.error('Error al firmar el documento con biometría:', err);
    setError(err?.response?.data?.message || 'Error al firmar el documento');
  } finally {
    setIsLoading(false);
  }
};

  // Handle signature position selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSignaturePosition({
      page: 1, // Default to first page
      x: Math.round(x),
      y: Math.round(y),
    });
    
    setDrawSignature(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get signature position display
  const getPositionDisplay = (positionJson?: string) => {
    if (!positionJson) return 'No position data';
    
    try {
      const position = JSON.parse(positionJson);
      return `Page ${position.page}, X:${position.x}, Y:${position.y}`;
    } catch (e) {
      return 'Invalid position data';
    }
  };

  // Verify a specific signature
  const verifySignature = async (signatureId: string) => {
    try {
      const response = await api.get(`/api/signatures/${signatureId}/verify`);
      
      // Update the signature in the list
      setSignatures(signatures.map(sig => 
        sig.id === signatureId 
          ? { ...sig, valid: response.data.valid } 
          : sig
      ));
      
      return response.data.valid;
    } catch (err) {
      console.error('Error verifying signature:', err);
      return false;
    }
  };

  const handleDownloadIntegrityReport = () => {
    if (!integrityStatus) return;
    
    // Crear reporte JSON bonito
    const report = {
      documento: documentTitle,
      fechaVerificacion: formatDate(integrityStatus.verifiedAt),
      integridad: integrityStatus.intact ? "Verificada" : "Documento modificado",
      algoritmo: integrityStatus.hashAlgorithm,
      firmas: integrityStatus.signatures?.map(sig => ({
        firmante: sig.userName || sig.userId,
        fechaFirma: formatDate(sig.signedAt),
        valida: sig.isValid ? "Válida" : "Inválida"
      }))
    };
    
    // Generar archivo
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-integridad-${documentId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Document Signatures</h3>
          <div className="flex space-x-2">
            <Button
              onClick={verifyDocumentIntegrity}
              variant="secondary"
              disabled={isVerifyingIntegrity || signatures.length === 0}
              size="small"
            >
              {isVerifyingIntegrity ? 'Verifying...' : 'Verify Integrity'}
            </Button>
            
            <Button 
              onClick={() => setShowSignModal(true)}
              variant="primary"
              disabled={!canSign || documentStatus !== 'completed'}
              size="small"
              title={cannotSignReason || (documentStatus !== 'completed' ? 'Document must be processed first' : '')}
            >
              Sign Document
            </Button>
          </div>
        </div>
        
        {/* Visualización mejorada de integridad */}
        {integrityStatus && (
          <div className={`mb-4 p-4 rounded-md ${integrityStatus.intact ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {integrityStatus.intact ? (
                  <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${integrityStatus.intact ? 'text-green-800' : 'text-red-800'}`}>
                  {integrityStatus.intact ? 'Integridad del documento verificada' : 'El documento ha sido modificado después de la firma'}
                </h3>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Verificado: {formatDate(integrityStatus.verifiedAt)}</p>
                  <p>Método: {integrityStatus.hashAlgorithm}</p>
                  {integrityStatus.signatures && (
                    <p>Firmas verificadas: {integrityStatus.signatures.length}</p>
                  )}
                </div>
                
                {/* Mostrar alerta importante si está modificado */}
                {!integrityStatus.intact && (
                  <div className="p-2 mt-2 text-xs font-medium text-red-800 bg-red-100 rounded-md">
                    ⚠️ La modificación del documento después de la firma podría invalidar su valor legal.
                    Contacte al firmante para una nueva versión firmada.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Botón de descarga de reporte de integridad */}
        
        {integrityStatus && (
          <div className="mt-2 text-right">
            <button
              onClick={handleDownloadIntegrityReport}
              className="px-3 py-1 text-xs text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
            >
              Descargar reporte de verificación
            </button>
          </div>
        )}
        
        {/* Signature list */}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No signatures yet</h3>
            <p className="mt-1 text-sm text-gray-500">This document hasn't been signed yet.</p>
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
                          <h4 className="text-sm font-medium text-gray-900">{signature.user?.name || 'User'}</h4>
                          <p className="text-sm text-gray-500">{signature.user?.email || signature.userId}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Signed on {formatDate(signature.signedAt)}
                        </p>
                        {signature.reason && (
                          <p className="mt-1 text-sm text-gray-500">
                            Reason: {signature.reason}
                          </p>
                        )}
                        {signature.position && (
                          <p className="mt-1 text-sm text-gray-500">
                            Position: {getPositionDisplay(signature.position)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        signature.valid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {signature.valid ? 'Valid' : 'Invalid'}
                      </span>
                      <button
                        onClick={() => verifySignature(signature.id)}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {!canSign && cannotSignReason && (
          <div className="p-4 mt-4 rounded-md bg-yellow-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Cannot sign document</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{cannotSignReason}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="w-full max-w-md p-8 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Sign Document: {documentTitle}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowSignModal(false);
                  setShowVerification(false);
                  setVerificationCode('');
                  setError(null);
                  setDrawSignature(false);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
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
                    Reason for signing (optional)
                  </label>
                  <input
                    type="text"
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="E.g., Approval, Review, Agreement"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Signature position
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
                    Click in the area to place your signature
                  </p>
                </div>
                
                <div className="flex justify-end mt-6 space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowSignModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={requestVerificationCode}
                    disabled={isLoading || !drawSignature}
                  >
                    {isLoading ? 'Processing...' : 'Continue'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="p-4 mb-6 rounded-md bg-blue-50">
                  <p className="text-sm text-blue-700">
                    For security, two-factor verification is required.
                    We've sent a code to your email address.
                  </p>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="verification-code" className="block mb-1 text-sm font-medium text-gray-700">
                    Verification code
                  </label>
                  <input
                    type="text"
                    id="verification-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                  {verificationId && (
                    <p className="mt-1 text-xs text-gray-500">
                      For testing purposes, the code is: {verificationId}
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
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={verifyCode}
                    disabled={isLoading || verificationCode.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Sign Document'}
                  </Button>
                </div>
              </div>
            )}
            
            {showBiometricVerification && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
                <div className="w-full max-w-md p-8 bg-white rounded-lg">
                  <BiometricAuthVerify
                    onSuccess={handleBiometricSuccess}
                    onCancel={() => setShowBiometricVerification(false)}
                  />
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