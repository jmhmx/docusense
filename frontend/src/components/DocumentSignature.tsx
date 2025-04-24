import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from './Button';
import BiometricSignatureWorkflow from './BiometricSignatureWorkflow';
import SignatureUI from './SignatureUI';
import TwoFactorVerification from './TwoFactorVerification';

interface SignaturePosition {
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
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
  multiSignatureEnabled?: boolean;
}

const DocumentSignature = ({ 
  documentId, 
  documentTitle,
  documentStatus,
  onSignSuccess 
}: DocumentSignatureProps) => {
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  //@ts-ignore
  const [isLoading, setIsLoading] = useState(false);
  //@ts-ignore
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
  //@ts-ignore
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [pendingSignatureData, setPendingSignatureData] = useState<{
    type: string;
    reason: string;
    position?: SignaturePosition;
    sealData?: any;
  } | null>(null);
  
  // Cargar información del usuario actual
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

  // Verificar si el usuario puede firmar
  useEffect(() => {
    const checkCanSign = async () => {
      if (!documentId || !currentUser) return;
      
      try {
        const response = await api.get(`/api/signatures/can-sign/${documentId}`);
        setCanSign(response.data.canSign);
        if (!response.data.canSign) {
          setCannotSignReason(response.data.reason);
        }
      } catch (err:any) {
        console.error('Error checking if user can sign:', err);
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

  // Cargar firmas existentes
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

  // Cargar información del documento (número de páginas)
  useEffect(() => {
    const fetchDocumentInfo = async () => {
      if (!documentId) return;
      
      try {
        const response = await api.get(`/api/documents/${documentId}/metadata`);
        if (response.data.pageCount) {
          setTotalPages(response.data.pageCount);
        }
      } catch (err) {
        console.error('Error loading document metadata:', err);
      }
    };

    fetchDocumentInfo();
  }, [documentId]);

  // Verificar integridad del documento
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

  // Manejar solicitud de firma con diferentes métodos
  const handleSignRequest = async (
  signatureType: string, 
  reason: string, 
  position?: SignaturePosition, 
  sealData?: any
) => {
  if (!position) {
    setError('Posición de firma no especificada');
    return;
  }

  setIsLoading(true);
  setError(null);
  
  try {
    // Primero, almacenar todos los datos pendientes
    const signatureData = {
      type: signatureType,
      reason: reason.trim() || 'Firma de documento',
      position,
      sealData
    };
    
    // Manejar según el tipo de firma
    switch (signatureType) {
      case 'standard':
        // Con firma estándar, guardar los datos pendientes y mostrar modal 2FA
        setPendingSignatureData(signatureData);
        setShowTwoFactorModal(true);
        setShowSignModal(false); // Cerrar el modal de firma
        break;
        
      case 'biometric':
        // Cerrar el modal de firma
        setShowSignModal(false);
        
        // Mostrar el componente de flujo biométrico
        setIsLoading(true);
        try {
          // Iniciar el proceso de firma biométrica
          const biometricResponse = await api.post(`/api/signatures/${documentId}/biometric-init`, {
            position,
            reason: reason.trim() || 'Firma con verificación biométrica',
            sealData
          });
          
          // Crear contenedor para el flujo biométrico
          const bioModalContainer = document.createElement('div');
          bioModalContainer.id = 'biometric-workflow-container';
          bioModalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50';
          document.body.appendChild(bioModalContainer);
          
          // Importar createRoot dinámicamente
          const { createRoot } = await import('react-dom/client');
          
          // Crear la raíz de React
          const root = createRoot(bioModalContainer);
          
          // Renderizar el componente de flujo biométrico
          root.render(
            <BiometricSignatureWorkflow
              documentId={documentId}
              documentTitle={documentTitle}
              onSuccess={(result) => {
                // Desmontar componente y eliminar contenedor
                root.unmount();
                document.body.removeChild(bioModalContainer);
                
                // Finalizar proceso de firma
                handleSignatureSuccess();
              }}
              onCancel={() => {
                // Desmontar componente y eliminar contenedor
                root.unmount();
                document.body.removeChild(bioModalContainer);
              }}
              navigateToRegistration={() => {
                // Desmontar componente y eliminar contenedor
                root.unmount();
                document.body.removeChild(bioModalContainer);
                
                // Navegar a registro biométrico
                window.location.href = '/biometric-registration';
              }}
            />
          );
        } catch (err: any) {
          console.error('Error iniciando proceso de firma biométrica:', err);
          setError(err?.response?.data?.message || 'Error al iniciar firma biométrica');
          setIsLoading(false);
        }
        break;
        
      case 'efirma':
        // Cerrar el modal de firma
        setShowSignModal(false);
        
        // Mostrar el modal de selección/validación de e.firma
        setIsLoading(true);
        try {
          // Crear contenedor para el flujo de e.firma
          const efirmaModalContainer = document.createElement('div');
          efirmaModalContainer.id = 'efirma-workflow-container';
          efirmaModalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50';
          document.body.appendChild(efirmaModalContainer);
          
          // Importar createRoot
          const { createRoot } = await import('react-dom/client');
          const root = createRoot(efirmaModalContainer);
          
          // Importar EfirmaSignatureWorkflow dinámicamente
          const EfirmaSignatureWorkflow = await import('./EfirmaSignatureWorkflow').then(m => m.default);
          
          // Renderizar el componente de flujo de e.firma
          root.render(
            <EfirmaSignatureWorkflow
              documentId={documentId}
              documentTitle={documentTitle}
              position={position}
              reason={reason.trim() || 'Firma con e.firma (FIEL)'}
              onSuccess={(result) => {
                // Desmontar componente y eliminar contenedor
                root.unmount();
                document.body.removeChild(efirmaModalContainer);
                
                // Finalizar proceso de firma
                handleSignatureSuccess();
              }}
              onCancel={() => {
                // Desmontar componente y eliminar contenedor
                root.unmount();
                document.body.removeChild(efirmaModalContainer);
                setIsLoading(false);
              }}
            />
          );
        } catch (err: any) {
          console.error('Error iniciando proceso de firma con e.firma:', err);
          setError(err?.response?.data?.message || 'Error al iniciar firma con e.firma');
          setIsLoading(false);
        }
        break;
        
      default:
        throw new Error('Tipo de firma no válido');
    }
  } catch (err: any) {
    console.error('Error al firmar documento:', err);
    setError(err?.response?.data?.message || 'Error al firmar documento');
  } finally {
    if (signatureType !== 'standard') {
      setIsLoading(false);
    }
  }
  };
  
  const handleTwoFactorSuccess = async () => {
  if (!pendingSignatureData) {
    setError('No hay datos de firma pendientes');
    return;
  }
  
  setIsLoading(true);
  
  try {
    // Ahora realizar la firma con los datos almacenados
    const response = await api.post(`/api/signatures/${documentId}`, {
      position: pendingSignatureData.position,
      reason: pendingSignatureData.reason,
      sealData: pendingSignatureData.sealData
    });
    
    handleSignatureSuccess();
  } catch (err: any) {
    console.error('Error al firmar documento después de verificación 2FA:', err);
    setError(err?.response?.data?.message || 'Error al firmar documento');
  } finally {
    setIsLoading(false);
    setShowTwoFactorModal(false);
    setPendingSignatureData(null);
  }
  };
  
  const handleSignatureSuccess = async () => {
  // Actualizar lista de firmas
  const signaturesResponse = await api.get(`/api/signatures/document/${documentId}`);
  setSignatures(signaturesResponse.data);
  
  // Mostrar mensaje de éxito
  setSuccessMessage(`Documento firmado exitosamente con ${
    pendingSignatureData?.type === 'standard' ? 'autenticación 2FA' : 
    pendingSignatureData?.type === 'biometric' ? 'verificación biométrica' : 
    'e.firma'
  }`);
  
  if (onSignSuccess) {
    onSignSuccess();
  }
  };
  

  // Verificar una firma específica
  const verifySignature = async (signatureId: string) => {
    try {
      const response = await api.get(`/api/signatures/${signatureId}/verify`);
      
      // Actualizar la firma en la lista
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

  // Descargar reporte de integridad
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

  // Mostrar posición de firma
  const getPositionDisplay = (positionJson?: string) => {
    if (!positionJson) return 'No position data';
    
    try {
      const position = JSON.parse(positionJson);
      return `Page ${position.page}, X:${position.x}, Y:${position.y}`;
    } catch (e) {
      return 'Invalid position data';
    }
  };

  return (
    <div className="mt-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Firmas del Documento</h3>
          <div className="flex space-x-2">
            <Button
              onClick={verifyDocumentIntegrity}
              variant="secondary"
              disabled={isVerifyingIntegrity || signatures.length === 0}
              size="small"
            >
              {isVerifyingIntegrity ? 'Verificando...' : 'Verificar Integridad'}
            </Button>
            
            {/* UN SOLO BOTÓN PARA INICIAR EL PROCESO DE FIRMA */}
            <Button 
              onClick={() => setShowSignModal(true)}
              variant="primary"
              disabled={!canSign || documentStatus !== 'completed'}
              size="small"
              title={cannotSignReason || (documentStatus !== 'completed' ? 'El documento debe estar procesado primero' : '')}
            >
              Firmar Documento
            </Button>
          </div>
        </div>
        
        {/* Visualización de integridad */}
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
                
                {/* Alerta importante si está modificado */}
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
        
        {/* Lista de firmas */}
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">Sin firmas</h3>
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
                        {signature.position && (
                          <p className="mt-1 text-sm text-gray-500">
                            Posición: {getPositionDisplay(signature.position)}
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
                        {signature.valid ? 'Válida' : 'Inválida'}
                      </span>
                      <button
                        onClick={() => verifySignature(signature.id)}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Verificar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Mensaje si no puede firmar */}
        {!canSign && cannotSignReason && (
          <div className="p-4 mt-4 rounded-md bg-yellow-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">No se puede firmar el documento</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{cannotSignReason}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Mostrar mensaje de éxito si es necesario */}
        {successMessage && (
          <div className="p-4 mt-4 rounded-md bg-green-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de SignatureUI unificado */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <SignatureUI 
            documentTitle={documentTitle}
            onSign={handleSignRequest}
            onCancel={() => setShowSignModal(false)}
            documentPreviewUrl={`/api/documents/${documentId}/view`}
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>
      )}
      {showTwoFactorModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
    <TwoFactorVerification
      onVerificationSuccess={handleTwoFactorSuccess}
      onVerificationFailure={(errorMsg) => {
        setError(errorMsg);
        setShowTwoFactorModal(false);
        setPendingSignatureData(null);
      }}
      onCancel={() => {
        setShowTwoFactorModal(false);
        setPendingSignatureData(null);
      }}
    />
  </div>
      )}
      
    </div>
  );
};

export default DocumentSignature;