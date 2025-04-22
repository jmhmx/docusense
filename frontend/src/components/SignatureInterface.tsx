import { useState, useEffect } from 'react';
import Button from './Button';

interface SignatureInterfaceProps {
  documentTitle: string;
  documentPreviewUrl?: string;
  currentPage?: number;
  totalPages?: number;
  onSign: (signatureType: string, reason: string) => void;
  onCancel: () => void;
  signatureTypes?: string[];
}

const SignatureInterface = ({
  documentTitle,
  documentPreviewUrl,
  currentPage = 1,
  totalPages = 1,
  onSign,
  onCancel,
  signatureTypes = ['standard', 'biometric', 'efirma']
}: SignatureInterfaceProps) => {
  const [selectedType, setSelectedType] = useState('standard');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  
  const signatureOptions = {
    standard: {
      icon: "🔑",
      title: "Firma Estándar",
      description: "Firma con verificación 2FA vía correo electrónico",
      detail: "Este tipo de firma verifica su identidad mediante un código enviado a su correo electrónico. Proporciona un nivel básico de seguridad."
    },
    biometric: {
      icon: "👤",
      title: "Firma Biométrica",
      description: "Firma con reconocimiento facial",
      detail: "Utiliza reconocimiento facial para verificar su identidad. Ofrece un alto nivel de seguridad y cumple con normativas avanzadas."
    },
    efirma: {
      icon: "🔐",
      title: "e.firma (FIEL)",
      description: "Firma con certificado del SAT",
      detail: "Utiliza su certificado digital emitido por el SAT. Es la opción más segura y con mayor validez legal para documentos oficiales."
    }
  };

  return (
    <div className="max-w-3xl p-6 mx-auto bg-white rounded-lg shadow-xl">
      <div className="pb-4 mb-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Firmar Documento</h2>
        <p className="mt-1 text-sm text-gray-600">{documentTitle}</p>
      </div>
      
      {step === 1 && (
        <>
          <h3 className="mb-6 text-lg font-medium text-gray-700">Seleccione método de firma</h3>
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
            {signatureTypes.map(type => (
              <div 
                key={type}
                onClick={() => setSelectedType(type)}
                className={`
                  relative border rounded-lg p-5 cursor-pointer transition-all duration-200
                  ${selectedType === type 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }
                `}
              >
                {selectedType === type && (
                  <div className="absolute top-2 right-2">
                    <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center text-center">
                  <span className="mb-3 text-2xl">{signatureOptions[type].icon}</span>
                  <h4 className="font-medium text-gray-800">{signatureOptions[type].title}</h4>
                  <p className="mt-1 text-xs text-gray-500">{signatureOptions[type].description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 mb-6 rounded-md bg-blue-50">
            <h4 className="mb-1 text-sm font-medium text-blue-800">Sobre {signatureOptions[selectedType].title}</h4>
            <p className="text-xs text-blue-700">
              {signatureOptions[selectedType].detail}
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Motivo de la firma (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo: Aprobación, Revisión, etc."
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          
          {documentPreviewUrl && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 rounded-md bg-blue-50 hover:bg-blue-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                {showPreview ? 'Ocultar vista previa' : 'Ver documento'}
              </button>
              
              {showPreview && (
                <div className="mt-3 overflow-hidden border border-gray-200 rounded-md">
                  <img 
                    src={`${documentPreviewUrl}?page=${currentPage}`} 
                    alt={`Vista previa página ${currentPage} de ${totalPages}`}
                    className="object-contain w-full"
                  />
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-2 bg-gray-50">
                      <span className="text-xs text-gray-500">Página {currentPage} de {totalPages}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
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
        <div className="py-6">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <span className="text-3xl">{signatureOptions[selectedType].icon}</span>
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-center">{signatureOptions[selectedType].title}</h3>
          <p className="mb-6 text-center text-gray-600">
            Continuando con el proceso de firma utilizando {signatureOptions[selectedType].title}.
            {reason && <span className="block mt-2 text-sm italic">Motivo: {reason}</span>}
          </p>
          
          <div className="p-4 mb-6 border border-yellow-200 rounded-md bg-yellow-50">
            <div className="flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h5 className="text-sm font-medium text-yellow-800">Importante</h5>
                <p className="mt-1 text-xs text-yellow-700">
                  Este proceso agregará una firma electrónica legalmente vinculante al documento. 
                  Una vez firmado, no podrá eliminar su firma.
                </p>
              </div>
            </div>
          </div>
          
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