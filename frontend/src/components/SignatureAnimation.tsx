import { useState, useEffect } from 'react';

const SignatureAnimation = ({ status, onComplete }) => {
  const [animationStep, setAnimationStep] = useState(0);
  
  // Etapas de la animación
  useEffect(() => {
    if (status === 'processing') {
      // Inicia la secuencia
      const interval = setInterval(() => {
        setAnimationStep(prev => {
          const nextStep = prev + 1;
          // 5 pasos de animación
          if (nextStep > 4) {
            clearInterval(interval);
            // Notificar que terminó la animación
            if (onComplete) onComplete();
            return 4;
          }
          return nextStep;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (status === 'success') {
      setAnimationStep(5);
    } else if (status === 'error') {
      setAnimationStep(6);
    } else {
      setAnimationStep(0);
    }
  }, [status, onComplete]);
  
  // Renderiza diferentes estados de animación
  const renderAnimationContent = () => {
    switch (animationStep) {
      case 0: // Esperando
        return (
          <div className="p-8 text-center">
            <p className="text-gray-500">Listo para iniciar el proceso de firma</p>
          </div>
        );
      case 1: // Verificando identidad
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 animate-pulse">
              <svg className="w-full h-full text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path>
              </svg>
              <span className="absolute w-full h-full bg-blue-400 rounded-full animate-ping opacity-20"></span>
            </div>
            <p className="mt-4 font-medium text-blue-700">Verificando identidad...</p>
          </div>
        );
      case 2: // Generando hash del documento
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="mt-4 font-medium text-blue-700">Generando hash del documento...</p>
            <div className="w-48 h-2 mt-3 bg-gray-200 rounded-full">
              <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
          </div>
        );
      case 3: // Aplicando firma digital
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></span>
              </div>
            </div>
            <p className="mt-4 font-medium text-blue-700">Aplicando firma digital...</p>
            <div className="w-48 h-2 mt-3 bg-gray-200 rounded-full">
              <div className="h-full bg-blue-600 rounded-full" style={{width: '80%'}}></div>
            </div>
          </div>
        );
      case 4: // Guardando firma en documento
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
              </svg>
              <div className="absolute bottom-0 left-0 right-0 h-0 bg-blue-500 animate-rise"></div>
            </div>
            <p className="mt-4 font-medium text-blue-700">Guardando firma en documento...</p>
            <div className="w-48 h-2 mt-3 bg-gray-200 rounded-full">
              <div className="h-full bg-blue-600 rounded-full" style={{width: '95%'}}></div>
            </div>
          </div>
        );
      case 5: // Éxito
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-16 h-16 text-green-500 bg-green-100 rounded-full animate-bounce-once">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <p className="mt-4 font-medium text-green-700">¡Firma completada con éxito!</p>
            <p className="mt-2 text-sm text-gray-500">El documento ha sido firmado y registrado correctamente</p>
          </div>
        );
      case 6: // Error
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-16 h-16 text-red-500 bg-red-100 rounded-full animate-shake">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <p className="mt-4 font-medium text-red-700">Error al procesar la firma</p>
            <p className="mt-2 text-sm text-gray-500">Hubo un problema durante el proceso. Por favor intente nuevamente.</p>
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="flex items-center justify-center p-6 bg-white rounded-lg shadow-md min-h-64">
      <style jsx>{`
        @keyframes rise {
          from { height: 0; }
          to { height: 100%; }
        }
        .animate-rise {
          animation: rise 1.5s ease-out forwards;
        }
        @keyframes bounce-once {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-20px); }
          60% { transform: translateY(-10px); }
        }
        .animate-bounce-once {
          animation: bounce-once 1s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
      `}</style>
      {renderAnimationContent()}
    </div>
  );
};

export default SignatureAnimation;