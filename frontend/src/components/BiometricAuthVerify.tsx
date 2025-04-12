import { useState } from 'react';
import BiometricCapture from './BiometricCapture';
import Button from './Button';
import useAuth from '../hooks/UseAuth';

interface BiometricAuthVerifyProps {
  onSuccess: (result?: any) => void;  // Hacerlo opcional con ?
  onCancel: () => void;
}

const BiometricAuthVerify = ({ onSuccess, onCancel }: BiometricAuthVerifyProps) => {
  const { loginWithBiometrics, user } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modificar la función handleBiometricSuccess
  const handleBiometricSuccess = async (result: any) => {
    setIsVerifying(true);
    setError(null);
    
    try {
      if (!user?.id) throw new Error('Usuario no identificado');
      
      // Añadir más datos para análisis de seguridad
      await loginWithBiometrics(
        user.id, 
        result.descriptorData,
        {
          challenge: result.challenge || 'blink',
          timestamp: Date.now(),
          motionData: result.motionData,
          textureData: result.textureData,
          confidenceScore: result.confidenceScore,
          deviceInfo: {
            screen: {
              width: window.screen.width,
              height: window.screen.height
            },
            userAgent: navigator.userAgent,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
          }
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(`Error de verificación: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="mb-4 text-xl font-semibold text-gray-800">Verificación Biométrica</h2>
      
      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}
      
      <BiometricCapture 
        mode="verify"
        onSuccess={handleBiometricSuccess}
        challengeType="blink"
      />
      
      <div className="flex justify-end mt-4 space-x-2">
        <Button
          onClick={onCancel}
          variant="secondary"
          disabled={isVerifying}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default BiometricAuthVerify;