// src/components/MultiSignatureVerification.tsx

import { useState } from 'react';
import { api } from '../api/client';
import Button from './Button';

interface MultiSignatureVerificationProps {
  documentId: string;
  documentTitle: string;
  signatures: any[];
  onUpdate: () => void;
}

const MultiSignatureVerification = ({ 
  documentId, 
  documentTitle, 
  signatures, 
  onUpdate 
}: MultiSignatureVerificationProps) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyAllSignatures = async () => {
    setIsVerifying(true);
    setError(null);
    
    try {
      const response = await api.post(`/api/signatures/${documentId}/verify-all`);
      setVerificationResult(response.data);
      onUpdate();
    } catch (error: any) {
      console.error('Error verificando firmas:', error);
      setError(error?.response?.data?.message || 'Error al verificar firmas múltiples');
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadVerificationReport = () => {
    if (!verificationResult) return;
    
    const reportData = {
      documentId,
      documentTitle,
      verificationDate: new Date().toISOString(),
      signaturesVerified: verificationResult.verifiedCount,
      totalSignatures: verificationResult.totalCount,
      quorumReached: verificationResult.quorumReached,
      requiredSigners: verificationResult.requiredSigners,
      signatures: verificationResult.signatures.map((sig: any) => ({
        signerId: sig.userId,
        signerName: sig.userName || 'Usuario',
        signedAt: sig.signedAt,
        isValid: sig.isValid,
        reason: sig.reason,
      })),
    };
    
    // Crear un blob con los datos del reporte
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Descargar el archivo
    const link = document.createElement('a');
    link.href = url;
    link.download = `verificacion-firmas-${documentId}.json`;
    link.click();
    
    // Limpiar
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 mt-4 bg-white rounded-lg shadow">
      <h3 className="mb-3 text-lg font-medium text-gray-900">
        Verificación de Firmas Múltiples
      </h3>
      
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
      
      {verificationResult ? (
        <div className={`p-4 rounded-md ${verificationResult.quorumReached ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {verificationResult.quorumReached ? (
                <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${verificationResult.quorumReached ? 'text-green-800' : 'text-yellow-800'}`}>
                {verificationResult.quorumReached 
                  ? 'Quórum de firmas alcanzado' 
                  : 'Quórum de firmas no alcanzado'}
              </h3>
              <div className="mt-2 text-sm text-gray-700">
                <p>
                  Firmas verificadas: {verificationResult.verifiedCount} de {verificationResult.totalCount}
                </p>
                <p>
                  Firmas requeridas: {verificationResult.requiredSigners}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <Button 
              onClick={downloadVerificationReport}
              variant="secondary"
              size="small"
            >
              Descargar Reporte de Verificación
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="mb-4 text-gray-600">
            Verifique la validez de todas las firmas y el cumplimiento del quórum requerido.
          </p>
          <Button
            onClick={verifyAllSignatures}
            disabled={isVerifying || signatures.length === 0}
            variant="primary"
          >
            {isVerifying ? 'Verificando...' : 'Verificar Todas las Firmas'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MultiSignatureVerification;