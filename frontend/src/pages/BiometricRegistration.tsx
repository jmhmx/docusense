import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BiometricCapture from '../components/BiometricCapture';
import { api } from '../api/client';
import useAuth from '../hooks/UseAuth';
import Button from '../components/Button';

// Define los tipos necesarios
/* interface BiometricRegistrationResult {
  success: boolean;
  message: string;
  id?: string;
  type?: string;
  timestamp?: string;
  descriptorData?: string;
  challenge?: string;
} */

const BiometricRegistration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'intro' | 'capture' | 'complete'>('intro');
  
  const navigate = useNavigate();
  const { user, updateUserBiometrics } = useAuth();
  
  // Verificar si ya tiene biometría registrada
  useEffect(() => {
    const checkExistingBiometrics = async () => {
      try {
        const response = await api.get('/api/biometry/status');
        if (response.data.registered) {
          // Si ya tiene biometría registrada, mostrar mensaje y redirigir
          setError('Ya tienes biometría registrada. Serás redirigido al dashboard.');
          setTimeout(() => navigate('/dashboard'), 3000);
        }
      } catch (err) {
        // Ignorar errores aquí, simplemente continuamos con el registro
        console.log('Verificando biometría:', err);
      }
    };
    
    if (user?.id) {
      checkExistingBiometrics();
    }
  }, [user, navigate]);
  
  const startRegistration = () => {
    setStep('capture');
    setError(null);
  };
  
  const handleRegistrationSuccess = async (result: any) => {
    console.log("Resultado del registro biométrico:", result);
    
    if (!user?.id) {
      setError('Usuario no identificado. Por favor, inicia sesión nuevamente.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Completando registro biométrico para usuario:", user.id);
      
      await api.post('/api/users/biometrics/setup-complete', {
        userId: user.id,
        setupMethod: 'facial'
      });
      
      // Actualizar estado local - IMPORTANTE
      localStorage.setItem('hasBiometrics', 'true');
      if (updateUserBiometrics) {
        updateUserBiometrics(true);
      }
      
      setStep('complete');
    } catch (err: any) {
      console.error('Error en registro biométrico:', err);
      setError(err?.response?.data?.message || 'Error al completar el registro biométrico');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Registro Biométrico
        </h1>
        <p className="mt-2 text-gray-600">
          Configure su biometría para firmar documentos con mayor seguridad
        </p>
      </div>
      
      {error && (
        <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}
      
      {step === 'intro' && (
        <div className="p-8 mb-8 bg-white rounded-lg shadow">
          <h2 className="mb-4 text-xl font-medium text-gray-900">Bienvenido al registro biométrico</h2>
          <p className="mb-6 text-gray-700">
            Para mejorar la seguridad de sus firmas digitales, utilizamos verificación biométrica
            facial. El proceso es simple:
          </p>
          <ul className="mb-6 ml-6 text-gray-700 list-disc">
            <li className="mb-2">Posicione su rostro frente a la cámara</li>
            <li className="mb-2">Siga las instrucciones para completar el desafío (giro de cabeza)</li>
            <li className="mb-2">Confirme y guarde sus datos biométricos</li>
          </ul>
          <div className="p-4 mb-6 rounded-md bg-blue-50">
            <p className="text-blue-700">
              <strong>Nota:</strong> Sus datos biométricos se cifran y almacenan de forma segura.
              Puede eliminarlos en cualquier momento desde su perfil.
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              onClick={startRegistration}
              disabled={loading}
            >
              Comenzar registro biométrico
            </Button>
          </div>
        </div>
      )}
      
      {step === 'capture' && (
        <BiometricCapture 
          mode="register" 
          onSuccess={handleRegistrationSuccess}
          challengeType="head-turn"
        />
      )}
      
      {step === 'complete' && (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
            <svg className="w-8 h-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-medium text-gray-900">
            Registro biométrico completado
          </h2>
          <p className="mt-2 text-gray-500">
            Su biometría ha sido registrada exitosamente. Ahora puede usar la verificación biométrica para firmar documentos.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate('/dashboard')}>
              Ir al Dashboard
            </Button>
          </div>
        </div>
      )}
      
      <div className="p-6 mt-8 rounded-lg bg-blue-50">
        <h3 className="text-lg font-medium text-blue-900">
          Información importante
        </h3>
        <ul className="mt-2 ml-6 text-sm text-blue-700 list-disc">
          <li className="mt-1">Sus datos biométricos se almacenan de forma cifrada</li>
          <li className="mt-1">Puede eliminar sus datos biométricos en cualquier momento</li>
          <li className="mt-1">La verificación biométrica cumple con los requisitos de firma electrónica avanzada</li>
          <li className="mt-1">Sus datos biométricos nunca se comparten con terceros</li>
        </ul>
      </div>
    </div>
  );
};

export default BiometricRegistration;