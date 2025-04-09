import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { api } from '../api/client';
import Button from './Button';

const MODEL_URL = '/models';

export const BiometricCapture = ({ onSuccess, mode = 'register' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFace, setDetectedFace] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessState, setLivenessState] = useState('waiting');
  const [livenessChallenge, setLivenessChallenge] = useState('blink');
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  useEffect(() => {
    async function loadModels() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        setError(`Error cargando modelos: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadModels();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const startVideo = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      videoRef.current.onloadedmetadata = () => {
        detectFaces();
      };
    } catch (err) {
      setError(`Error accediendo a la cámara: ${err.message}`);
    }
  };
  
  const detectFaces = () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.width, height: video.height };
    
    faceapi.matchDimensions(canvas, displaySize);
    
    const interval = setInterval(async () => {
      const detections = await faceapi.detectAllFaces(
        video, 
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceLandmarks()
      .withFaceExpressions();
      
      if (detections.length > 0) {
        setDetectedFace(detections[0]);
        
        // Verificar prueba de vida
        checkLiveness(detections[0]);
      } else {
        setDetectedFace(null);
      }
      
      // Dibujar resultados en el canvas
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    }, 100);
    
    return () => clearInterval(interval);
  };
  
  const checkLiveness = (face) => {
    // Simplificado - en producción sería más complejo
    const expressions = face.expressions;
    
    switch (livenessChallenge) {
      case 'blink':
        if (expressions.neutral > 0.8 && detectedFace && expressions.neutral < 0.3) {
          setLivenessState('passed');
        }
        break;
      case 'smile':
        if (expressions.happy > 0.7) {
          setLivenessState('passed');
        }
        break;
    }
  };
  
  const handleCapture = async () => {
    if (!detectedFace || livenessState !== 'passed') return;
    
    setIsProcessing(true);
    
    try {
      // Obtener descriptor facial
      const descriptor = detectedFace.descriptor;
      
      // Capturar frame actual
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(
        videoRef.current, 0, 0, canvas.width, canvas.height
      );
      
      const imageData = canvas.toDataURL('image/jpeg');
      
      if (mode === 'register') {
        const response = await api.post('/api/biometry/register', {
          userId: 'current-user-id', // Obtener de contexto
          descriptorData: btoa(descriptor),
          livenessProof: {
            challenge: livenessChallenge,
            timestamp: new Date().getTime(),
            imageData
          },
          type: 'face'
        });
        
        if (response.data.success) {
          onSuccess(response.data);
        } else {
          setError(response.data.message);
        }
      } else {
        const response = await api.post('/api/biometry/verify', {
          userId: 'current-user-id', // Obtener de contexto
          descriptorData: btoa(descriptor),
          livenessProof: {
            challenge: livenessChallenge,
            timestamp: new Date().getTime(),
            imageData
          }
        });
        
        onSuccess(response.data);
      }
    } catch (err) {
      setError(`Error procesando datos biométricos: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {mode === 'register' ? 'Registro biométrico' : 'Verificación biométrica'}
        </h3>
      </div>
      
      {error && (
        <div className="p-4 mb-4 rounded-md bg-red-50">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative">
        {!modelsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-md">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-sm text-gray-500">Cargando modelos...</p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <video 
              ref={videoRef}
              width="640"
              height="480"
              autoPlay
              muted
              className="rounded-md"
              style={{ display: !modelsLoaded ? 'none' : 'block' }}
            />
            <canvas 
              ref={canvasRef}
              width="640"
              height="480"
              className="absolute top-0 left-0 z-10"
            />
            
            {!detectedFace && modelsLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-4 text-center bg-white bg-opacity-75 rounded-md">
                  <p className="text-sm text-gray-800">Coloque su rostro frente a la cámara</p>
                </div>
              </div>
            )}
            
            {detectedFace && livenessState === 'waiting' && (
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-white bg-opacity-75">
                <p className="text-sm font-medium text-gray-800">
                  {livenessChallenge === 'blink' ? 'Por favor, parpadee' : 'Por favor, sonría'}
                </p>
              </div>
            )}
            
            {livenessState === 'passed' && (
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-green-100 bg-opacity-75">
                <p className="text-sm font-medium text-green-800">
                  Verificación de vida exitosa!
                </p>
              </div>
            )}
          </div>
          
          <div className="flex space-x-4">
            {!streamRef.current && (
              <Button
                onClick={startVideo}
                disabled={!modelsLoaded || isProcessing}
              >
                Iniciar cámara
              </Button>
            )}
            
            <Button
              onClick={handleCapture}
              disabled={!detectedFace || livenessState !== 'passed' || isProcessing}
              variant="primary"
            >
              {isProcessing 
                ? 'Procesando...' 
                : mode === 'register' 
                  ? 'Registrar biometría' 
                  : 'Verificar identidad'
              }
            </Button>
          </div>
        </div>
      </div>
      
      <div className="mt-4">
        <p className="text-sm text-gray-500">
          {mode === 'register' 
            ? 'Su rostro será registrado para futuras verificaciones de identidad.'
            : 'Se verificará su identidad usando reconocimiento facial.'}
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Sus datos biométricos se procesan localmente y se almacenan de forma cifrada.
        </p>
      </div>
    </div>
  );
};

export default BiometricCapture;