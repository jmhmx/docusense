import React from 'react';

interface HeadTurnInstructionsProps {
  isVisible: boolean;
}

const HeadTurnInstructions: React.FC<HeadTurnInstructionsProps> = ({ isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-75">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Cómo realizar el giro de cabeza</h2>
        
        <div className="p-4 mb-4 rounded-md bg-blue-50">
          <p className="text-sm text-blue-800">
            Para completar la verificación biométrica, necesitamos detectar un leve giro de cabeza.
            Esto ayuda a confirmar que es una persona real y no una fotografía.
          </p>
        </div>
        
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-medium text-gray-800">Siga estos pasos:</h3>
          <ol className="pl-5 space-y-2 text-gray-700 list-decimal">
            <li>Posicione su rostro mirando directamente a la cámara</li>
            <li>Gire lentamente su cabeza hacia la derecha (aproximadamente 30°)</li>
            <li>Regrese a la posición central</li>
            <li>Opcionalmente, gire levemente hacia la izquierda</li>
            <li>Vuelva a la posición central</li>
          </ol>
        </div>
        
        <div className="flex justify-between mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-2 bg-gray-100 rounded-full">
              <span className="text-2xl">👀</span>
            </div>
            <p className="text-xs text-gray-600">Posición central</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-2 bg-gray-100 rounded-full">
              <span className="text-2xl">👉👤</span>
            </div>
            <p className="text-xs text-gray-600">Giro a la derecha</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-2 bg-gray-100 rounded-full">
              <span className="text-2xl">👤👈</span>
            </div>
            <p className="text-xs text-gray-600">Giro a la izquierda</p>
          </div>
        </div>
        
        <div className="p-3 mb-4 border-l-4 border-yellow-400 bg-yellow-50">
          <p className="text-sm text-yellow-800">
            <strong>Consejos:</strong> Realice movimientos suaves y naturales. Mantenga una buena iluminación para que su rostro sea visible en todo momento.
          </p>
        </div>
        
        <button
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={(e) => {
          e.preventDefault();
            const container = e.currentTarget.closest('div.fixed') as HTMLDivElement;
            if (container) {
              container.style.display = 'none';
            }
          }}
        >
          Entendido, comenzar
        </button>
      </div>
    </div>
  );
};

export default HeadTurnInstructions;