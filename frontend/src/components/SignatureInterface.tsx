import { useState } from 'react';
import Button from './Button';

const SignatureInterface = ({ 
  documentTitle, 
  onSign, 
  onCancel,
  signatureTypes = ['standard', 'biometric', 'efirma']
}) => {
  const [selectedType, setSelectedType] = useState('standard');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState(1);
  
  const signatureOptions = {
    standard: { 
      icon: "🔑", 
      title: "Firma Estándar", 
      description: "Firma con verificación 2FA vía correo" 
    },
    biometric: { 
      icon: "👤", 
      title: "Firma Biométrica", 
      description: "Firma con reconocimiento facial" 
    },
    efirma: { 
      icon: "🔐", 
      title: "e.firma (FIEL)", 
      description: "Firma con certificado del SAT" 
    }
  };

  return (
    <div className="max-w-2xl p-6 mx-auto bg-white rounded-lg shadow-xl">
      <div className="pb-4 mb-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Firmar Documento</h2>
        <p className="mt-1 text-sm text-gray-600">{documentTitle}</p>
      </div>
      
      {step === 1 && (
        <>
          <h3 className="mb-4 text-lg font-medium text-gray-700">Seleccione método de firma</h3>
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
            {signatureTypes.map(type => (
              <div 
                key={type}
                onClick={() => setSelectedType(type)}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all duration-200
                  ${selectedType === type 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }
                `}
              >
                <div className="flex flex-col items-center text-center">
                  <span className="mb-2 text-2xl">{signatureOptions[type].icon}</span>
                  <h4 className="font-medium text-gray-800">{signatureOptions[type].title}</h4>
                  <p className="mt-1 text-xs text-gray-500">{signatureOptions[type].description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Motivo de la firma (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo: Aprobación, Revisión, etc."
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
          </div>
          
          <div className="flex justify-end mt-6 space-x-3">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        </>
      )}
      
      {step === 2 && (
        <div className="py-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <span className="text-3xl">{signatureOptions[selectedType].icon}</span>
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold">{signatureOptions[selectedType].title}</h3>
          <p className="mb-6 text-gray-600">
            Continuando con el proceso de firma utilizando {signatureOptions[selectedType].title}.
            {reason && <span className="block mt-2 text-sm italic">Motivo: {reason}</span>}
          </p>
          
          <div className="flex justify-center mt-6 space-x-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Regresar
            </Button>
            <Button 
              variant="primary" 
              onClick={() => onSign(selectedType, reason)}
            >
              Iniciar Firma
            </Button>
          </div>
        </div>
      )}
      
      {/* Barra de progreso */}
      <div className="pt-4 mt-8 border-t border-gray-200">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-500">Paso {step} de 2</span>
          <span className="text-xs text-gray-500">{step === 1 ? 'Seleccionar método' : 'Confirmar'}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div 
            className="h-2 transition-all duration-500 ease-in-out bg-blue-600 rounded-full" 
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SignatureInterface;