import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import SignaturePositioning from './SignaturePositioning';
import CustomSignatureSeal from './CustomSignatureSeal';
import SignatureAnimation from './SignatureAnimation';

interface SignatureUIProps {
  documentTitle: string;
  onSign: (type: string, reason: string, position?: any, sealData?: any) => void;
  onCancel: () => void;
  documentPreviewUrl: string;
  currentPage?: number;
  totalPages?: number;
}

interface SignaturePosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SealData {
  text?: string;
  image?: string;
  style?: Record<string, any>;
  content?: Record<string, any>;
}

const SignatureUI = ({
  documentTitle,
  onSign,
  onCancel,
  documentPreviewUrl,
  currentPage = 1,
  totalPages = 1,
}: SignatureUIProps) => {
  const [step, setStep] = useState<'type' | 'position' | 'customize' | 'processing' | 'complete'>('type');
  const [signatureType, setSignatureType] = useState<'standard' | 'biometric' | 'efirma'>('standard');
  const [reason, setReason] = useState('');
  const [position, setPosition] = useState<SignaturePosition | null>(null);
  const [sealData, setSealData] = useState<SealData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const currentUserName = localStorage.getItem('user')
    ? JSON.parse(localStorage.getItem('user') || '{}').name || 'Usuario'
    : 'Usuario';
  
  const signatureOptions = {
    standard: {
      icon: "🔑",
      title: "Firma Estándar",
      description: "Firma con verificación 2FA vía correo",
      color: "bg-blue-100 text-blue-800 border-blue-300"
    },
    biometric: {
      icon: "👤",
      title: "Firma Biométrica",
      description: "Firma con reconocimiento facial",
      color: "bg-green-100 text-green-800 border-green-300"
    },
    efirma: {
      icon: "🔐",
      title: "e.firma (FIEL)",
      description: "Firma con certificado del SAT",
      color: "bg-purple-100 text-purple-800 border-purple-300"
    }
  };
  
  // Limpiar cualquier error cuando cambia el paso
  useEffect(() => {
    setError(null);
  }, [step]);
  
  // Ir al siguiente paso
  const goToNextStep = () => {
    switch (step) {
      case 'type':
        setStep('position');
        break;
      case 'position':
        if (signatureType === 'standard') {
          setStep('customize');
        } else {
          handleFinalizeSignature();
        }
        break;
      case 'customize':
        handleFinalizeSignature();
        break;
      default:
        break;
    }
  };
  
  // Ir al paso anterior
  const goToPreviousStep = () => {
    switch (step) {
      case 'position':
        setStep('type');
        break;
      case 'customize':
        setStep('position');
        break;
      default:
        break;
    }
  };
  
  // Manejar selección de tipo de firma
  const handleSelectType = (type: 'standard' | 'biometric' | 'efirma') => {
    setSignatureType(type);
  };
  
  // Manejar confirmación de firma (llamada desde signaturePositioning)
  const handleConfirmSignature = () => {
    if (!position) {
      setError('Debe seleccionar una posición para la firma');
      return;
    }
    
    if (signatureType === 'standard') {
      setStep('customize');
    } else {
      handleFinalizeSignature();
    }
  };
  
  // Manejar selección de posición
  const handlePositionSelected = (pos: SignaturePosition) => {
    setPosition(pos);
    
    // Si es firma biométrica o e.firma, finalizar directamente
    if (signatureType === 'biometric' || signatureType === 'efirma') {
      handleFinalizeSignature();
    } else {
      goToNextStep();
    }
  };
  
  // Manejar guardado de sello personalizado
  const handleSealSaved = (sealConfig: SealData) => {
    setSealData(sealConfig);
    handleFinalizeSignature();
  };
  
  // Finalizar proceso de firma
  const handleFinalizeSignature = () => {
    setStep('processing');
    setProcessing(true);
    
    // Simular proceso de firma (esto sería reemplazado por la llamada real)
    setTimeout(() => {
      try {
        if (!position) {
          throw new Error('No se ha seleccionado una posición para la firma');
        }
        
        // Llamar a onSign con los datos correspondientes
        onSign(signatureType, reason, position, sealData);
        
        setProcessing(false);
        setSuccess(true);
        setStep('complete');
      } catch (err) {
        setProcessing(false);
        setError(err instanceof Error ? err.message : 'Error al procesar la firma');
      }
    }, 2000);
  };
  
  // Reiniciar proceso en caso de error
  const handleRetry = () => {
    setError(null);
    setStep('type');
  };
  
  // Renderizar contenido según el paso actual
  const renderStepContent = () => {
    switch (step) {
      case 'type':
        return (
          <div className="p-6">
            <h2 className="mb-6 text-xl font-semibold text-center text-gray-800">
              Firmar Documento: <span className="text-blue-600">{documentTitle}</span>
            </h2>
            
            <h3 className="mb-4 text-lg font-medium text-gray-700">Seleccione método de firma</h3>
            <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
              {Object.entries(signatureOptions).map(([type, details]) => (
                <motion.div
                  key={type}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${signatureType === type
                      ? `${details.color} border-current shadow-md`
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  onClick={() => handleSelectType(type as 'standard' | 'biometric' | 'efirma')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex flex-col items-center text-center">
                    <span className="mb-2 text-3xl">{details.icon}</span>
                    <h4 className="font-medium text-gray-800">{details.title}</h4>
                    <p className="mt-1 text-xs text-gray-500">{details.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Motivo de la firma (opcional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo: Aprobación, Revisión, etc."
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div className="flex justify-end mt-6 space-x-3">
              <Button variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={goToNextStep}>
                Continuar
              </Button>
            </div>
          </div>
        );
        
      case 'position':
        return (
          <SignaturePositioning
            documentId={documentPreviewUrl.split('/').pop() || ''}
            currentPage={currentPage}
            totalPages={totalPages}
            onPositionSelected={handlePositionSelected}
            onCancel={goToPreviousStep}
            signatureData={{
              name: currentUserName,
              date: new Date().toLocaleDateString(),
              reason: reason || undefined
            }}
          />
        );
        
      case 'customize':
        return (
          <CustomSignatureSeal
            name={currentUserName}
            date={new Date().toLocaleDateString()}
            reason={reason || undefined}
            onSave={handleSealSaved}
            onCancel={goToPreviousStep}
          />
        );
        
      case 'processing':
      case 'complete':
        return (
          <div className="p-6">
            <SignatureAnimation
              status={processing ? 'processing' : error ? 'error' : 'success'}
              onComplete={() => { }}
            />
            
            {error && (
              <div className="p-4 mt-4 border-l-4 border-red-400 bg-red-50">
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
            
            <div className="flex justify-center mt-6 space-x-3">
              {error ? (
                <>
                  <Button variant="secondary" onClick={onCancel}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={handleRetry}>
                    Reintentar
                  </Button>
                </>
              ) : success ? (
                <Button variant="primary" onClick={onCancel}>
                  Cerrar
                </Button>
              ) : null}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Obtener el porcentaje de progreso según el paso actual
  const getProgressPercentage = () => {
    switch (step) {
      case 'type':
        return 25;
      case 'position':
        return 50;
      case 'customize':
        return 75;
      case 'processing':
      case 'complete':
        return 100;
      default:
        return 0;
    }
  };
  
  // Obtener el nombre del paso actual
  const getStepName = () => {
    switch (step) {
      case 'type':
        return 'Seleccionar método';
      case 'position':
        return 'Posicionar firma';
      case 'customize':
        return 'Personalizar sello';
      case 'processing':
        return 'Procesando';
      case 'complete':
        return 'Completado';
      default:
        return '';
    }
  };
  
  return (
    <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="overflow-auto max-h-[calc(90vh-60px)]"
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>
      
      {/* Barra de progreso */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex justify-between mb-1 text-xs text-gray-500">
          <span>Paso {step === 'type' ? 1 : step === 'position' ? 2 : step === 'customize' ? 3 : 4} de 4</span>
          <span>{getStepName()}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 transition-all duration-500 ease-in-out bg-blue-600 rounded-full"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SignatureUI;