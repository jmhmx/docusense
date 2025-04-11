import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BiometricCapture from '../components/BiometricCapture';
import { api } from '../api/client';
import useAuth from '../hooks/UseAuth';

const BiometricRegistration = () => {
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const navigate = useNavigate();
  const { user, updateUserBiometrics } = useAuth();
  
  const handleRegistrationSuccess = () => {
    setRegistrationComplete(true);
    
    // Guardar flag en localStorage
    localStorage.setItem('hasBiometrics', 'true');
    
    // Actualizar contexto de autenticación
    if (updateUserBiometrics) {
      updateUserBiometrics(true);
    }
    
    // Notificar al backend
    if (user && user.id) {
      api.post('/api/users/biometrics/setup-complete', {
        userId: user.id,
        setupMethod: 'facial'
      }).catch((err: Error) => console.error('Error notificando setup biométrico:', err));
    }
    
    // Redireccionar
    setTimeout(() => {
      navigate('/dashboard');
    }, 3000);
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
      
      {registrationComplete ? (
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
          <p className="mt-4 text-sm text-gray-500">
            Redirigiendo al dashboard...
          </p>
        </div>
      ) : (
        <BiometricCapture 
          mode="register" 
          onSuccess={handleRegistrationSuccess} 
        />
      )}
      
      <div className="p-6 mt-8 rounded-lg bg-blue-50">
        <h3 className="text-lg font-medium text-blue-900">
          Información importante
        </h3>
        <ul className="mt-2 ml-6 text-sm text-blue-700 list-disc">
          <li className="mt-1">Sus datos biométricos se almacenan de forma cifrada en nuestros servidores</li>
          <li className="mt-1">Puede eliminar sus datos biométricos en cualquier momento desde su perfil</li>
          <li className="mt-1">La verificación biométrica cumple con los requisitos de la LFEA para firmas electrónicas avanzadas</li>
          <li className="mt-1">Sus datos biométricos nunca se comparten con terceros</li>
        </ul>
      </div>
    </div>
  );
};

export default BiometricRegistration;