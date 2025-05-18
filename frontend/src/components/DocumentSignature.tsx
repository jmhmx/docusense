import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from './Button';
import FirmaAutografa from './FirmaAutografa';
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
  metadata?: {
    signatureType?: string;
    [key: string]: any;
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
  onSignSuccess,
}: DocumentSignatureProps) => {
  // Estado base
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  // @ts-ignore
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canSign, setCanSign] = useState(true);
  const [cannotSignReason, setCannotSignReason] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Estado para visualización
  // @ts-ignore
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Estado para flujos de firma específicos
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [showFirmaAutografaModal, setShowFirmaAutografaModal] = useState(false);

  // Estado para datos pendientes de firma
  const [pendingSignatureData, setPendingSignatureData] = useState<{
    type: string;
    reason: string;
    position?: SignaturePosition;
    sealData?: any;
    firmaAutografaSvg?: string;
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
        const response = await api.get(
          `/api/signatures/can-sign/${documentId}`,
        );
        setCanSign(response.data.canSign);
        if (!response.data.canSign) {
          setCannotSignReason(response.data.reason);
        }
      } catch (err: any) {
        console.error('Error checking if user can sign:', err);
        let errorMsg = 'Error checking signature permissions';
        if (err.response) {
          errorMsg += `: ${err.response.status} - ${
            err.response.data?.message || 'Unknown error'
          }`;
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

      try {
        const response = await api.get(
          `/api/signatures/document/${documentId}`,
        );
        setSignatures(response.data);
      } catch (err) {
        console.error('Error loading signatures:', err);
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

  // Manejar solicitud de firma con diferentes métodos
  const handleSignRequest = async (
    signatureType: string,
    reason: string,
    position?: SignaturePosition,
    sealData?: any,
  ) => {
    if (!position) {
      setError('Posición de firma no especificada');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Almacenar datos pendientes para todos los tipos
      const signatureData = {
        type: signatureType,
        reason: reason.trim() || 'Firma de documento',
        position,
        sealData,
      };

      // Manejar según el tipo de firma
      switch (signatureType) {
        case 'standard':
          // Para firma estándar, mostrar modal 2FA primero
          setPendingSignatureData(signatureData);
          setShowTwoFactorModal(true);
          setShowSignModal(false); // Cerrar el modal de firma
          break;

        case 'autograph':
          // Para firma autógrafa, mostrar modal de firma autógrafa primero
          setPendingSignatureData(signatureData);
          setShowFirmaAutografaModal(true);
          setShowSignModal(false); // Cerrar el modal de firma
          break;

        default:
          throw new Error('Tipo de firma no válido');
      }
    } catch (err: any) {
      console.error('Error al firmar documento:', err);
      setError(err?.response?.data?.message || 'Error al firmar documento');
      setIsLoading(false);
    }
  };

  // Manejar éxito de verificación 2FA
  const handleTwoFactorSuccess = async () => {
    if (!pendingSignatureData) {
      setError('No hay datos de firma pendientes');
      return;
    }

    // Para firma estándar, completar después de la verificación 2FA
    if (pendingSignatureData.type === 'standard') {
      await completeStandardSignature();
    }
    // Para firma autógrafa que ya tiene SVG, completar después de 2FA
    else if (
      pendingSignatureData.type === 'autograph' &&
      pendingSignatureData.firmaAutografaSvg
    ) {
      await completeFirmaAutografaConAutenticacion();
    } else {
      setError('Falta información para completar la firma');
    }
  };

  // Firmar documento con método estándar
  const completeStandardSignature = async () => {
    if (!pendingSignatureData) {
      setError('No hay datos de firma pendientes');
      return;
    }

    setIsLoading(true);

    try {
      // Realizar petición de firma real
      await api.post(`/api/signatures/${documentId}`, {
        position: pendingSignatureData.position,
        reason: pendingSignatureData.reason,
      });

      handleSignatureSuccess();
    } catch (err: any) {
      console.error('Error al firmar documento:', err);
      setError(err?.response?.data?.message || 'Error al firmar documento');
    } finally {
      setIsLoading(false);
      setShowTwoFactorModal(false);
      setPendingSignatureData(null);
    }
  };

  // Manejar guardado de firma autógrafa
  const handleFirmaAutografaSave = async (firmaAutografaSvg: string) => {
    if (!pendingSignatureData) {
      setError('No hay datos de firma pendientes');
      return;
    }

    // Actualizar los datos pendientes con la firma autógrafa
    setPendingSignatureData({
      ...pendingSignatureData,
      firmaAutografaSvg,
    });

    // Después de guardar la firma autógrafa, mostrar verificación 2FA
    setShowFirmaAutografaModal(false);
    setShowTwoFactorModal(true);
  };

  // Completar proceso de firma autógrafa con autenticación
  const completeFirmaAutografaConAutenticacion = async () => {
    if (!pendingSignatureData || !pendingSignatureData.firmaAutografaSvg) {
      setError('Faltan datos de firma autógrafa');
      return;
    }

    setIsLoading(true);

    try {
      // Enviar la firma autógrafa al servidor
      await api.post(`/api/signatures/${documentId}/autografa`, {
        position: pendingSignatureData.position,
        reason: pendingSignatureData.reason,
        firmaAutografaSvg: pendingSignatureData.firmaAutografaSvg,
      });

      handleSignatureSuccess();
    } catch (err: any) {
      console.error('Error al procesar firma autógrafa:', err);
      setError(
        err?.response?.data?.message || 'Error al procesar firma autógrafa',
      );
    } finally {
      setIsLoading(false);
      setShowTwoFactorModal(false);
      setPendingSignatureData(null);
    }
  };

  // Manejar éxito de firma
  const handleSignatureSuccess = async () => {
    // Actualizar lista de firmas
    const signaturesResponse = await api.get(
      `/api/signatures/document/${documentId}`,
    );
    setSignatures(signaturesResponse.data);

    // Determinar tipo de firma usado para el mensaje
    const signatureType = pendingSignatureData?.type || 'estándar';

    let tipoFirma = 'digital';
    if (signatureType === 'autograph') {
      tipoFirma = 'autógrafa con autenticación 2FA';
    } else if (signatureType === 'standard') {
      tipoFirma = 'digital con autenticación 2FA';
    }

    // Mostrar mensaje de éxito
    setSuccessMessage(`Documento firmado exitosamente con firma ${tipoFirma}`);

    // Resetear estados
    setIsLoading(false);
    setPendingSignatureData(null);

    // Callback de éxito si existe
    if (onSignSuccess) {
      onSignSuccess();
    }
  };

  // Función para manejar errores de verificación
  const handleVerificationError = (errorMsg: string) => {
    setError(errorMsg);
    setIsLoading(false);
    setPendingSignatureData(null);
  };

  return (
    <div className='mt-6'>
      <div className='p-6 bg-white rounded-lg shadow'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-medium text-gray-900'>
            Firmas del Documento
          </h3>

          <Button
            onClick={() => setShowSignModal(true)}
            variant='primary'
            disabled={!canSign || documentStatus !== 'completed'}
            size='small'
            title={
              cannotSignReason ||
              (documentStatus !== 'completed'
                ? 'El documento debe estar procesado primero'
                : '')
            }>
            Firmar Documento
          </Button>
        </div>

        {/* Lista de firmas existentes */}
        {signatures.length === 0 ? (
          <div className='py-6 text-center'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-12 h-12 mx-auto text-gray-400'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13'
              />
            </svg>
            <h3 className='mt-2 text-sm font-medium text-gray-900'>
              Sin firmas
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              Este documento aún no ha sido firmado.
            </p>
          </div>
        ) : (
          <div className='mt-4 overflow-hidden bg-white shadow sm:rounded-md'>
            <ul className='divide-y divide-gray-200'>
              {signatures.map((signature) => (
                <li
                  key={signature.id}
                  className='px-4 py-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='flex items-center'>
                        <div className='flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full'>
                          <span className='text-sm font-medium text-blue-800'>
                            {signature.user?.name
                              ?.substring(0, 2)
                              .toUpperCase() || 'US'}
                          </span>
                        </div>
                        <div className='ml-4'>
                          <h4 className='text-sm font-medium text-gray-900'>
                            {signature.user?.name || 'Usuario'}
                          </h4>
                          <p className='text-sm text-gray-500'>
                            {signature.user?.email || signature.userId}
                          </p>
                        </div>
                      </div>
                      <div className='mt-2'>
                        <p className='text-sm text-gray-500'>
                          Firmado el{' '}
                          {new Date(signature.signedAt).toLocaleString()}
                        </p>
                        {signature.reason && (
                          <p className='mt-1 text-sm text-gray-500'>
                            Motivo: {signature.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className='flex flex-col items-end'>
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          signature.valid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                        {signature.valid ? 'Válida' : 'Inválida'}
                      </span>
                      {signature.metadata?.signatureType === 'autografa' && (
                        <span className='inline-flex px-2 py-1 mt-1 text-xs font-semibold leading-5 text-blue-800 bg-blue-100 rounded-full'>
                          Firma Autógrafa
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mensaje si no puede firmar */}
        {!canSign && cannotSignReason && (
          <div className='p-4 mt-4 rounded-md bg-yellow-50'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-5 text-yellow-400'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h3 className='text-sm font-medium text-yellow-800'>
                  No se puede firmar el documento
                </h3>
                <div className='mt-2 text-sm text-yellow-700'>
                  <p>{cannotSignReason}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mostrar mensaje de éxito */}
        {successMessage && (
          <div className='p-4 mt-4 rounded-md bg-green-50'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='w-5 h-5 text-green-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <p className='text-sm font-medium text-green-800'>
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mostrar mensaje de error */}
        {error && (
          <div className='p-4 mt-4 rounded-md bg-red-50'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='w-5 h-5 text-red-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <p className='text-sm font-medium text-red-800'>{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de SignatureUI unificado */}
      {showSignModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50'>
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

      {/* Modal de firma autógrafa */}
      {showFirmaAutografaModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50'>
          <FirmaAutografa
            onSave={handleFirmaAutografaSave}
            onCancel={() => {
              setShowFirmaAutografaModal(false);
              setPendingSignatureData(null);
              setIsLoading(false);
            }}
            userName={currentUser?.name || 'Usuario'}
          />
        </div>
      )}

      {/* Modal de verificación de dos factores */}
      {showTwoFactorModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50'>
          <TwoFactorVerification
            onVerificationSuccess={handleTwoFactorSuccess}
            onVerificationFailure={handleVerificationError}
            onCancel={() => {
              setShowTwoFactorModal(false);
              setPendingSignatureData(null);
              setIsLoading(false);
            }}
            actionType='firma'
          />
        </div>
      )}
    </div>
  );
};

export default DocumentSignature;
