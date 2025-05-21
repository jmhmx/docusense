import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';
import { twoFactor } from '../api/client';

interface TwoFactorVerificationProps {
  onVerificationSuccess: () => void;
  onVerificationFailure: (message: string) => void;
  onCancel: () => void;
  actionType?: string;
}

const TwoFactorVerification = ({
  onVerificationSuccess,
  onVerificationFailure,
  onCancel,
  actionType = 'firma',
}: TwoFactorVerificationProps) => {
  const [code, setCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [codeGenerated, setCodeGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solicitar código al montar
  useEffect(() => {
    generateCode();
  }, []);

  // Actualizar el temporizador
  useEffect(() => {
    if (!expiresAt) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const expTime = expiresAt.getTime();
      const remaining = Math.max(
        0,
        Math.floor((expTime - now.getTime()) / 1000),
      );

      setRemainingTime(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        setCodeGenerated(false);
        setError('El código ha expirado. Solicite uno nuevo.');
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt]);

  // Formatear tiempo restante
  const formatRemainingTime = () => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generar código
  const generateCode = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await twoFactor.generateVerificationCode(actionType);
      setCodeGenerated(true);
      setExpiresAt(new Date(response.data.expiresAt));

      // Calcular tiempo restante inicial
      const now = new Date();
      const expTime = new Date(response.data.expiresAt).getTime();
      setRemainingTime(
        Math.max(0, Math.floor((expTime - now.getTime()) / 1000)),
      );
    } catch (err: any) {
      console.error('Error generating verification code:', err);
      setError(err?.response?.data?.message || 'Error al generar código');
    } finally {
      setIsGenerating(false);
    }
  };

  // Verificar código
  const verifyCode = async () => {
    if (!code.trim()) {
      setError('Por favor ingrese el código');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      await twoFactor.verifyCode(code.trim(), actionType);
      onVerificationSuccess();
    } catch (err: any) {
      console.error('Error verifying code:', err);
      const errorMsg =
        err?.response?.data?.message || 'Error al verificar código';
      setError(errorMsg);
      onVerificationFailure(errorMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className='max-w-md p-6 bg-white rounded-lg shadow-xl'>
      <h2 className='mb-4 text-xl font-semibold text-gray-800'>
        Verificación de dos factores
      </h2>

      {codeGenerated ? (
        <>
          <p className='mb-4 text-sm text-gray-600'>
            Hemos enviado un código de verificación a su correo electrónico para
            completar la {actionType}.
          </p>

          <p className='mb-2 text-sm text-gray-600'>
            Por favor ingrese el código:
          </p>

          <div className='mb-4'>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder='Ingrese el código de 6 dígitos'
              fullWidth
              autoFocus
            />
          </div>

          {remainingTime > 0 && (
            <p className='mb-4 text-sm text-gray-500'>
              Tiempo restante:{' '}
              <span className='font-medium text-blue-600'>
                {formatRemainingTime()}
              </span>
            </p>
          )}

          {error && (
            <div className='p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md'>
              {error}
            </div>
          )}

          <div className='flex justify-between'>
            <div>
              <Button
                variant='secondary'
                size='small'
                onClick={generateCode}
                disabled={isGenerating || remainingTime > 0}>
                {isGenerating ? 'Enviando...' : 'Reenviar código'}
              </Button>
            </div>

            <div className='flex space-x-3'>
              <Button
                variant='secondary'
                onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                variant='primary'
                onClick={verifyCode}
                disabled={isVerifying || !code.trim()}>
                {isVerifying ? 'Verificando...' : 'Verificar'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className='mb-4 text-sm text-gray-600'>
            Para continuar con la {actionType}, necesitamos enviar un código de
            verificación a su correo electrónico.
          </p>

          {error && (
            <div className='p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md'>
              {error}
            </div>
          )}

          <div className='flex justify-end space-x-3'>
            <Button
              variant='secondary'
              onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              variant='primary'
              onClick={generateCode}
              disabled={isGenerating}>
              {isGenerating ? 'Enviando...' : 'Enviar código'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default TwoFactorVerification;
