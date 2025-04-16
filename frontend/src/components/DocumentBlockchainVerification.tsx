import { useState } from 'react';
import { api } from '../api/client';
import Button from './Button';

interface DocumentBlockchainVerificationProps {
  documentId: string;
  documentTitle: string;
}

const DocumentBlockchainVerification = ({ documentId, documentTitle }: DocumentBlockchainVerificationProps) => {
  const [verification, setVerification] = useState<any>(null);
  const [certificate, setCertificate] = useState<any>(null);
  //const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFetchingCertificate, setIsFetchingCertificate] = useState(false);

  const verifyDocument = async () => {
    setIsVerifying(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/documents/${documentId}/blockchain/verify`);
      setVerification(response.data);
    } catch (err: any) {
      console.error('Error verifying document on blockchain:', err);
      setError(err?.response?.data?.message || 'Error verifying document on blockchain');
    } finally {
      setIsVerifying(false);
    }
  };

  const getCertificate = async () => {
    setIsFetchingCertificate(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/documents/${documentId}/blockchain/certificate`);
      setCertificate(response.data);
    } catch (err: any) {
      console.error('Error fetching blockchain certificate:', err);
      setError(err?.response?.data?.message || 'Error fetching blockchain certificate');
    } finally {
      setIsFetchingCertificate(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const downloadCertificatePDF = () => {
    if (!certificate) return;
    
    // Create PDF content
    const content = `
      BLOCKCHAIN VERIFICATION CERTIFICATE
      ----------------------------------
      
      Document ID: ${certificate.documentId}
      Document Title: ${documentTitle}
      Transaction ID: ${certificate.transactionId || 'N/A'}
      Timestamp: ${formatDate(certificate.timestamp)}
      Registered By: ${certificate.registeredBy || 'N/A'}
      Document Hash: ${certificate.documentHash || 'N/A'}
      Block Height: ${certificate.blockHeight || 'N/A'}
      Certificate ID: ${certificate.certificateId || 'N/A'}
      
      This document has been verified and registered on the blockchain.
      
      Verification Date: ${new Date().toLocaleString()}
    `;
    
    // Create a Blob from the content
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockchain-certificate-${documentId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">Verificación Blockchain</h3>
      
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
      
      <div className="flex justify-between mb-6">
        <Button
          onClick={verifyDocument}
          disabled={isVerifying}
          variant="primary"
        >
          {isVerifying ? 'Verificando...' : 'Verificar en Blockchain'}
        </Button>
        
        <Button
          onClick={getCertificate}
          disabled={isFetchingCertificate}
          variant="secondary"
        >
          {isFetchingCertificate ? 'Generando...' : 'Obtener Certificado'}
        </Button>
      </div>
      
      {verification && (
        <div className={`p-4 rounded-md ${verification.verified ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {verification.verified ? (
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
              <h3 className={`text-sm font-medium ${verification.verified ? 'text-green-800' : 'text-red-800'}`}>
                {verification.verified ? 'Document verified on blockchain' : 'Document failed blockchain verification'}
              </h3>
              <div className="mt-2 text-sm text-gray-600">
                {verification.reason && <p>Reason: {verification.reason}</p>}
                {verification.lastUpdate && <p>Last Update: {formatDate(verification.lastUpdate)}</p>}
                {verification.registeredHash && <p>Registered Hash: {verification.registeredHash.substring(0, 16)}...</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {certificate && (
        <div className="p-4 mt-6 border border-blue-200 rounded-md bg-blue-50">
          <h4 className="mb-2 font-medium text-blue-900 text-md">Blockchain Certificate</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-blue-700">Transaction ID</p>
              <p className="text-xs text-blue-600">{certificate.transactionId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Timestamp</p>
              <p className="text-xs text-blue-600">{formatDate(certificate.timestamp)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Block Height</p>
              <p className="text-xs text-blue-600">{certificate.blockHeight || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Registered By</p>
              <p className="text-xs text-blue-600">{certificate.registeredBy || 'N/A'}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <button
              onClick={downloadCertificatePDF}
              className="inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar certificado
            </button>
          </div>
        </div>
      )}
      
      <div className="mt-6 text-sm text-gray-500">
        <p>
          La verificación en blockchain proporciona un registro inmutable de la autenticidad e integridad de los documentos. El hash del documento se almacena en un registro distribuido para garantizar que no se haya modificado desde su registro.
        </p>
      </div>
    </div>
  );
};

export default DocumentBlockchainVerification;