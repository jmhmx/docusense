import { useState, useEffect } from 'react';
import BiometricCapture from './BiometricCapture';
import Button from './Button';
import useAuth from '../hooks/UseAuth';
import { api } from '../api/client';

// Componente para integrar el flujo de firma biométrica
const BiometricSignatureWorkflow = ({ 
  documentId, 
  documentTitle, 
  onSuccess, 
  onCancel,
  navigateToRegistration
}) => {
  const [step, setStep] = useState('intro'); // intro, capture, processing, success, error
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const { user } = useAuth();

  // Verificar si el usuario ya tiene biometría registrada
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const response = await api.get('/api/biometry/status');
        setHasBiometrics(response.data.registered);
      } catch (err) {
        console.error('Error al verificar estado biométrico:', err);
        setError('Error al verificar el estado biométrico');
      }
    };

    if (user) {
      checkBiometrics();
    }
  }, [user]);

  // Manejar éxito de captura biométrica
  const handleBiometricSuccess = async (result) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Construir payload con información biométrica
      const payload = {
        position: { page: 1, x: 100, y: 100 }, // Posición por defecto
        reason: 'Firma con verificación biométrica',
        biometricVerification: {
          timestamp: Date.now(),
          challenge: result.challenge || 'blink',
          score: result.score || 0.9,
          method: 'facial-recognition'
        }
      };
      
      // Llamar al endpoint específico para firma biométrica
      const response = await api.post(`/api/signatures/${documentId}/biometric`, payload);
      
      // Si la firma fue exitosa, avanzar al paso de éxito
      if (response.data.signatureId) {
        setStep('success');
        
        // Si hay callback de éxito, llamarlo después de un retraso
        setTimeout(() => {
          if (onSuccess) onSuccess(response.data);
        }, 1500);
      }
    } catch (err) {
      console.error('Error al firmar con biometría:', err);
      setError(err?.response?.data?.message || 'Error al procesar firma biométrica');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Redireccionar a registro biométrico
  const handleSetupBiometrics = () => {
    if (navigateToRegistration) {
      navigateToRegistration();
    }
  };

  // Renderizar el paso actual
  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="p-6">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Firma biométrica de documento</h3>
            <p className="mb-4 text-gray-600">
              Está a punto de firmar <span className="font-medium">{documentTitle}</span> utilizando verificación biométrica.
            </p>
            
            {!hasBiometrics ? (
              <div className="p-4 mb-4 rounded-md bg-yellow-50">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Registro biométrico requerido</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Para firmar con biometría, primero debe registrar sus datos biométricos.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-gray-500">
                La firma biométrica proporciona mayor seguridad y validez legal al documento al verificar su identidad mediante reconocimiento facial.
              </p>
            )}
            
            <div className="flex justify-end mt-6 space-x-3">
              <Button variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
              
              {hasBiometrics ? (
                <Button variant="primary" onClick={() => setStep('capture')}>
                  Continuar con verificación biométrica
                </Button>
              ) : (
                <Button variant="primary" onClick={handleSetupBiometrics}>
                  Configurar biometría
                </Button>
              )}
            </div>
          </div>
        );
        
      case 'capture':
        return (
          <div className="p-4">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Verificación biométrica</h3>
            <BiometricCapture 
              mode="verify"
              onSuccess={handleBiometricSuccess}
              challengeType="blink"
            />
            {isProcessing && (
              <div className="flex items-center justify-center mt-4">
                <svg className="w-8 h-8 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={onCancel} disabled={isProcessing}>
                Cancelar
              </Button>
            </div>
          </div>
        );
        
      case 'success':
        return (
          <div className="p-6 text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
              <svg className="w-8 h-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">¡Documento firmado correctamente!</h3>
            <p className="mt-2 text-gray-500">
              La firma biométrica ha sido aplicada exitosamente al documento.
            </p>
            <div className="mt-6">
              <Button onClick={onCancel}>Cerrar</Button>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div className="p-6">
            <div className="p-4 mb-4 rounded-md bg-red-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error en la firma biométrica</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error || "Se produjo un error al procesar la firma biométrica."}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6 space-x-3">
              <Button variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => setStep('capture')}>
                Intentar nuevamente
              </Button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-3xl p-6 mx-auto bg-white rounded-lg shadow-lg">
      {renderStep()}
    </div>
  );
};

export default BiometricSignatureWorkflow;