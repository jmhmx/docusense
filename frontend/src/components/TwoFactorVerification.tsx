import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import Button from './Button';

interface TwoFactorVerificationProps {
  onVerificationSuccess: () => void;
  onVerificationFailure?: (error: string) => void;
  onCancel: () => void;
  actionType?: string;
}

const TwoFactorVerification = ({
  onVerificationSuccess,
  onVerificationFailure,
  onCancel,
  actionType = 'firma',
}: TwoFactorVerificationProps) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isGeneratingCode, setIsGeneratingCode] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // Generar código de verificación al montar el componente
  useEffect(() => {
    generateVerificationCode();
  }, []);

  // Calcular tiempo restante cuando se actualiza expiresAt
  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = expiresAt.getTime() - now.getTime();
      const secondsLeft = Math.max(0, Math.floor(difference / 1000));
      return secondsLeft;
    };

    setCountdown(calculateTimeLeft());

    const timer = setInterval(() => {
      const secondsLeft = calculateTimeLeft();
      setCountdown(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(timer);
        setError('El código ha expirado. Genera uno nuevo.');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  // Generar un nuevo código de verificación
  const generateVerificationCode = useCallback(async () => {
    setIsGeneratingCode(true);
    setError(null);

    try {
      const response = await api.post('/api/auth/2fa/generate', {
        action: actionType,
      });

      // En producción, no enviamos el código de vuelta por seguridad,
      // pero podemos mostrar la fecha de expiración
      setExpiresAt(new Date(response.data.expiresAt));
      setGeneratedCode(null); // En producción no se muestra el código

      // Informar al usuario que el código ha sido enviado
      setError(null);
    } catch (err: any) {
      console.error('Error al generar código de verificación:', err);
      const errorMsg =
        err?.response?.data?.message ||
        'Error al generar código de verificación';
      setError(errorMsg);
      if (onVerificationFailure) {
        onVerificationFailure(errorMsg);
      }
    } finally {
      setIsGeneratingCode(false);
    }
  }, [actionType, onVerificationFailure]);

  // Verificar el código ingresado
  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setError('Por favor ingresa el código de verificación');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.post('/api/auth/2fa/verify', {
        code: verificationCode,
        action: actionType,
      });

      onVerificationSuccess();
    } catch (err: any) {
      console.error('Error al verificar código:', err);
      const errorMsg =
        err?.response?.data?.message || 'Código de verificación inválido';
      setError(errorMsg);
      if (onVerificationFailure) {
        onVerificationFailure(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Formatear tiempo restante
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatear código para mejor visualización
  const formatVerificationCode = (code: string) => {
    // Insertar un espacio después de 3 caracteres para mejor legibilidad
    if (code.length > 3) {
      return `${code.substring(0, 3)} ${code.substring(3)}`;
    }
    return code;
  };

  return (
    <div className='p-6 bg-white rounded-lg shadow-xl'>
      <h2 className='mb-4 text-xl font-medium text-gray-900'>
        Verificación de dos factores
      </h2>

      {error && (
        <div className='p-4 mb-4 border-l-4 border-red-400 bg-red-50'>
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
              <p className='text-sm text-red-700'>{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className='mb-6'>
        <p className='mb-4 text-gray-600'>
          Se ha enviado un código de verificación a tu correo electrónico.
          Introduce el código para continuar con el proceso de firma.
        </p>

        <div className='p-4 mb-4 border border-blue-200 rounded-md bg-blue-50'>
          <div className='flex items-center'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5 mr-2 text-blue-500'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span className='text-sm text-blue-700'>
              El código expirará en:{' '}
              <span className='font-medium'>{formatTime(countdown)}</span>
            </span>
          </div>
        </div>

        <label
          htmlFor='verification-code'
          className='block mb-2 text-sm font-medium text-gray-700'>
          Código de verificación
        </label>
        <div className='flex'>
          <input
            id='verification-code'
            type='text'
            value={verificationCode}
            onChange={(e) =>
              setVerificationCode(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
              )
            }
            placeholder='Ingresa el código de 6 dígitos'
            className='block w-full px-3 py-2 mr-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
            maxLength={6}
            autoComplete='one-time-code'
          />
          <Button
            variant='secondary'
            onClick={generateVerificationCode}
            disabled={isGeneratingCode}>
            {isGeneratingCode ? 'Enviando...' : 'Nuevo código'}
          </Button>
        </div>
      </div>

      <div className='flex justify-end space-x-3'>
        <Button
          variant='secondary'
          onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant='primary'
          onClick={handleVerify}
          disabled={
            isLoading || !verificationCode.trim() || verificationCode.length < 6
          }>
          {isLoading ? 'Verificando...' : 'Verificar'}
        </Button>
      </div>
    </div>
  );
};

export default TwoFactorVerification;
