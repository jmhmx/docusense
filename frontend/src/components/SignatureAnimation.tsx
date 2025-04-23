// src/components/SignatureAnimation.tsx (mejorado)
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignatureAnimationProps {
  status: 'idle' | 'processing' | 'success' | 'error';
  onComplete?: () => void;
  processingSteps?: string[];
}

const SignatureAnimation = ({ 
  status, 
  onComplete,
  processingSteps = [
    'Verificando identidad', 
    'Generando hash del documento', 
    'Aplicando firma digital', 
    'Registrando firma'
  ]
}: SignatureAnimationProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setCurrentStep(prev => {
          const nextStep = prev + 1;
          if (nextStep >= processingSteps.length) {
            clearInterval(interval);
            if (onComplete) setTimeout(onComplete, 500);
            return processingSteps.length - 1;
          }
          return nextStep;
        });
      }, 1200);
      
      return () => clearInterval(interval);
    } else if (status === 'success' || status === 'error') {
      setCurrentStep(processingSteps.length);
    } else {
      setCurrentStep(0);
    }
  }, [status, processingSteps.length, onComplete]);
  
  return (
    <div className="p-8 bg-white rounded-lg shadow-lg">
      <div className="flex flex-col items-center">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-lg font-medium text-gray-700">Listo para iniciar el proceso de firma</p>
            </motion.div>
          )}

          {status === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-20 h-20">
                <motion.div 
                  className="absolute inset-0 rounded-full opacity-25"
                  style={{ 
                    background: `conic-gradient(#3B82F6 ${currentStep * 25}%, transparent ${currentStep * 25}%)` 
                  }}
                  animate={{ 
                    background: `conic-gradient(#3B82F6 ${(currentStep + 1) * 25}%, transparent ${(currentStep + 1) * 25}%)` 
                  }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                ></motion.div>
                
                <div className="z-10 flex items-center justify-center w-16 h-16 bg-white rounded-full">
                  {currentStep === 0 && (
                    <motion.svg 
                      className="w-8 h-8 text-blue-500" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ repeat: Infinity, repeatType: "reverse", duration: 1 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </motion.svg>
                  )}
                  
                  {currentStep === 1 && (
                    <motion.svg 
                      className="w-8 h-8 text-blue-500" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </motion.svg>
                  )}
                  
                  {currentStep === 2 && (
                    <motion.svg 
                      className="w-8 h-8 text-blue-500" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      initial={{ y: -5 }}
                      animate={{ y: 5 }}
                      transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.5 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </motion.svg>
                  )}
                  
                  {currentStep === 3 && (
                    <motion.svg 
                      className="w-8 h-8 text-blue-500" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.7 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </motion.svg>
                  )}
                </div>
              </div>
              
              <motion.p 
                className="mt-4 text-lg font-medium text-blue-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={currentStep}
              >
                {processingSteps[currentStep]}...
              </motion.p>
              
              <div className="flex items-center w-full max-w-md mt-6">
                {processingSteps.map((_stepText, index) => (
                  <div key={index} className="flex-1">
                    <div 
                      className={`h-1 mx-2 rounded-full ${
                        index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                      }`}
                    ></div>
                    <div className="flex justify-center mt-2">
                      <div className={`flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                        index < currentStep 
                          ? 'bg-blue-500 text-white' 
                          : index === currentStep 
                            ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-500' 
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {index < currentStep ? '✓' : index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex flex-col items-center"
            >
              <motion.div 
                className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 10 }}
              >
                <motion.svg 
                  className="w-10 h-10 text-green-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <motion.path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={3} 
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </motion.svg>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="mt-4 text-lg font-medium text-green-700">¡Firma completada con éxito!</p>
                <p className="mt-2 text-sm text-center text-gray-500">
                  El documento ha sido firmado y registrado correctamente
                </p>
              </motion.div>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex flex-col items-center"
            >
              <motion.div 
                className="flex items-center justify-center w-20 h-20 bg-red-100 rounded-full"
                animate={{ 
                  x: [0, -10, 10, -10, 10, 0],
                  transition: { duration: 0.5 }
                }}
              >
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="mt-4 text-lg font-medium text-red-700">Error al procesar la firma</p>
                <p className="mt-2 text-sm text-center text-gray-500">
                  Hubo un problema durante el proceso. Por favor intente nuevamente.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SignatureAnimation;