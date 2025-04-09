import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { api } from '../api/client';
import Button from './Button';
import useAuth from '../hooks/UseAuth';

const MODEL_URL = '/models';

interface BiometricCaptureProps {
  onSuccess: (result: any) => void;
  mode: 'register' | 'verify';
  challengeType?: 'blink' | 'smile' | 'head-turn';
}

const BiometricCapture = ({ 
  onSuccess, 
  mode = 'register',
  challengeType = 'blink'
}: BiometricCaptureProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFace, setDetectedFace] = useState<faceapi.WithFaceLandmarks<
    faceapi.WithFaceDescriptor<faceapi.WithFaceExpressions<
      faceapi.WithFaceDetection<{}>
    >>
  > | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessState, setLivenessState] = useState<'waiting' | 'progress' | 'passed' | 'failed'>('waiting');
  const [livenessChallenge, setLivenessChallenge] = useState(challengeType);
  const [error, setError] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [detectionStarted, setDetectionStarted] = useState(false);
  
  // Referencias para video y canvas
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Referencia para contador de frames
  const frameCounterRef = useRef<number>(0);
  const positiveFramesRef = useRef<number>(0);
  const totalFramesNeededRef = useRef<number>(30); // Necesitamos 30 frames "positivos" para confirmar liveness
  
  // Historial de expresiones para análisis temporal de liveness
  const expressionHistoryRef = useRef<Array<faceapi.FaceExpressions>>([]);
  const lastBlinkStateRef = useRef<boolean>(false);
  
  // Cargar modelos de FaceAPI
  useEffect(() => {
    async function loadModels() {
      try {
        setIsLoading(true);
        
        // Mostrar progreso de carga
        setError('Cargando modelos de reconocimiento facial...');
        
        // Cargar modelos secuencialmente con informes de progreso
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setProgressPercentage(25);
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        setProgressPercentage(50);
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setProgressPercentage(75);
        
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        setProgressPercentage(100);
        
        setModelsLoaded(true);
        setError(null);
      } catch (err) {
        setError(`Error cargando modelos de reconocimiento facial: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadModels();
    
    // Limpieza al desmontar el componente
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Iniciar cámara y detección facial
  const startVideo = async () => {
    if (!videoRef.current) return;
    
    try {
      // Solicitar permisos de cámara con resolución adecuada
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        }
      });
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      videoRef.current.onloadedmetadata = () => {
        setDetectionStarted(true);
        detectFaces();
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error accediendo a la cámara: ${errorMessage}. Verifique los permisos del navegador.`);
    }
  };
  
  // Detección facial continua
  const detectFaces = () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.width, height: video.height };
    
    faceapi.matchDimensions(canvas, displaySize);
    
    const intervalId = setInterval(async () => {
      frameCounterRef.current += 1;
      
      try {
        // Solo procesar si el video está activo
        if (video.paused || video.ended || !streamRef.current) {
          return;
        }
        
        // Detectar cara con landmarks, expresiones y descriptor facial (para reconocimiento)
        const detections = await faceapi.detectAllFaces(
          video, 
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.6 })
        )
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors();
        
        // Si se detectó al menos una cara
        if (detections.length > 0) {
          // Tomar la primera cara (asumimos solo una persona frente a la cámara)
          const detection = detections[0];
          setDetectedFace(detection);
          
          // Añadir expresión al historial para análisis temporal
          expressionHistoryRef.current.push(detection.expressions);
          if (expressionHistoryRef.current.length > 10) {
            // Mantener solo los últimos 10 frames para análisis
            expressionHistoryRef.current.shift();
          }
          
          // Verificar prueba de vida según el desafío
          checkLiveness(detection);
        } else {
          setDetectedFace(null);
          
          // Si perdemos la cara, reiniciamos el progreso de liveness
          if (livenessState === 'progress') {
            setLivenessState('waiting');
            positiveFramesRef.current = 0;
            setProgressPercentage(0);
          }
        }
        
        // Dibujar resultados en el canvas
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Dibujar caja de detección
          faceapi.draw.drawDetections(canvas, resizedDetections);
          
          // Dibujar puntos de referencia faciales
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          
          // Dibujar marco de "liveness" según estado
          if (detections.length > 0) {
            const detection = resizedDetections[0].detection;
            const box = detection.box;
            ctx.strokeStyle = livenessState === 'passed' ? 'green' : 
                              livenessState === 'failed' ? 'red' : 
                              livenessState === 'progress' ? 'blue' : 'yellow';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          }
        }
      } catch (err) {
        console.error('Error en detección facial:', err);
      }
    }, 100);
    
    // Limpiar intervalo cuando el componente se desmonte
    return () => clearInterval(intervalId);
  };
  
  // Verificación de liveness según el desafío
  const checkLiveness = (face: faceapi.WithFaceLandmarks<
    faceapi.WithFaceDescriptor<faceapi.WithFaceExpressions<
      faceapi.WithFaceDetection<{}>
    >>
  >) => {
    // Obtener expresiones faciales actuales
    const expressions = face.expressions;
    const history = expressionHistoryRef.current;
    
    // Iniciar verificación de liveness una vez que tenemos suficientes frames
    if (history.length < 5) return;
    
    if (livenessState === 'waiting' || livenessState === 'progress') {
      setLivenessState('progress');
      
      switch (livenessChallenge) {
        case 'blink':
          // Detectar parpadeo (ojos cerrados seguidos de ojos abiertos)
          const currentBlinkState = expressions.neutral > 0.8 && isEyesClosed(face);
          
          // Transición de ojos abiertos a cerrados y viceversa
          if (currentBlinkState && !lastBlinkStateRef.current) {
            // Ojos recién cerrados
            positiveFramesRef.current += 1;
          } else if (!currentBlinkState && lastBlinkStateRef.current) {
            // Ojos recién abiertos después de estar cerrados
            positiveFramesRef.current += 2;
          }
          
          lastBlinkStateRef.current = currentBlinkState;
          break;
          
        case 'smile':
          // Detectar sonrisa
          if (expressions.happy > 0.7) {
            positiveFramesRef.current += 1;
          }
          break;
          
        case 'head-turn':
          // Detectar giro de cabeza usando landmarks faciales
          // Implementación simplificada - en producción usar análisis de pose 3D
          const landmarks = face.landmarks;
          const jawOutline = landmarks.getJawOutline();
          
          // Calcular asimetría para detectar giro
          const leftSide = jawOutline.slice(0, 8);
          const rightSide = jawOutline.slice(8);
          const asymmetry = calculateAsymmetry(leftSide, rightSide);
          
          if (asymmetry > 0.2) {
            positiveFramesRef.current += 1;
          }
          break;
      }
      
      // Actualizar progreso
      const progress = Math.min(100, Math.round((positiveFramesRef.current / totalFramesNeededRef.current) * 100));
      setProgressPercentage(progress);
      
      // Verificar si se completó el desafío
      if (positiveFramesRef.current >= totalFramesNeededRef.current) {
        setLivenessState('passed');
      }
    }
  };
  
  // Función auxiliar para detectar ojos cerrados usando landmarks
  const isEyesClosed = (face: faceapi.WithFaceLandmarks<any>) => {
    const landmarks = face.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    // Calcular altura y anchura de los ojos
    const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
    const leftEyeWidth = Math.abs(leftEye[0].x - leftEye[3].x);
    
    const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
    const rightEyeWidth = Math.abs(rightEye[0].x - rightEye[3].x);
    
    // Calcular ratio altura/anchura (valores bajos indican ojos cerrados)
    const leftRatio = leftEyeHeight / leftEyeWidth;
    const rightRatio = rightEyeHeight / rightEyeWidth;
    
    // Umbral para determinar si los ojos están cerrados
    const threshold = 0.15;
    
    return leftRatio < threshold && rightRatio < threshold;
  };
  
  // Función auxiliar para calcular asimetría facial
  const calculateAsymmetry = (leftPoints: faceapi.Point[], rightPoints: faceapi.Point[]) => {
    // Implementación simplificada - en producción usar algoritmos más sofisticados
    // Calcular distancia media desde puntos a una línea media vertical
    const xValues = [...leftPoints, ...rightPoints].map(p => p.x);
    const midX = (Math.min(...xValues) + Math.max(...xValues)) / 2;
    
    const leftDist = leftPoints.reduce((sum, point) => sum + Math.abs(point.x - midX), 0) / leftPoints.length;
    const rightDist = rightPoints.reduce((sum, point) => sum + Math.abs(point.x - midX), 0) / rightPoints.length;
    
    // Diferencia normalizada entre distancias izquierda y derecha
    return Math.abs(leftDist - rightDist) / ((leftDist + rightDist) / 2);
  };
  
  // Capturar y enviar datos biométricos
  const handleCapture = async () => {
    if (!detectedFace || livenessState !== 'passed' || !user) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Obtener descriptor facial
      const descriptor = Array.from(detectedFace.descriptor);
      
      // Capturar frame actual
      const canvas = document.createElement('canvas');
      if (videoRef.current) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(
          videoRef.current, 0, 0, canvas.width, canvas.height
        );
      }
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      if (mode === 'register') {
        // Registrar datos biométricos
        const response = await api.post('/api/biometry/register', {
          userId: user.id,
          descriptorData: btoa(JSON.stringify(descriptor)),
          livenessProof: {
            challenge: livenessChallenge,
            timestamp: new Date().getTime(),
            imageData
          },
          type: 'face',
          metadata: {
            livenessScore: positiveFramesRef.current / frameCounterRef.current,
            device: navigator.userAgent,
            challengeType: livenessChallenge
          }
        });
        
        if (response.data.success) {
          onSuccess(response.data);
        } else {
          setError(response.data.message || 'Error al registrar datos biométricos');
        }
      } else {
        // Verificar identidad
        const response = await api.post('/api/biometry/verify', {
          userId: user.id,
          descriptorData: btoa(JSON.stringify(descriptor)),
          livenessProof: {
            challenge: livenessChallenge,
            timestamp: new Date().getTime(),
            imageData
          }
        });
        
        onSuccess(response.data);
      }
    } catch (err: any) {
      console.error('Error procesando datos biométricos:', err);
      setError(`Error ${mode === 'register' ? 'registrando' : 'verificando'} datos biométricos: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Cambiar desafío de prueba de vida
  const changeChallenge = () => {
    // Reiniciar estado de liveness
    setLivenessState('waiting');
    positiveFramesRef.current = 0;
    setProgressPercentage(0);
    
    // Cambiar tipo de desafío
    const challenges: Array<'blink' | 'smile' | 'head-turn'> = ['blink', 'smile', 'head-turn'];
    const currentIndex = challenges.indexOf(livenessChallenge as any);
    const nextIndex = (currentIndex + 1) % challenges.length;
    setLivenessChallenge(challenges[nextIndex]);
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {mode === 'register' ? 'Registro biométrico' : 'Verificación biométrica'}
        </h3>
        {livenessState !== 'passed' && detectionStarted && (
          <Button 
            onClick={changeChallenge}
            variant="secondary"
            size="small"
          >
            Cambiar desafío
          </Button>
        )}
      </div>
      
      {error && (
        <div className="p-4 mb-4 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative">
        {!modelsLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-md">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-sm text-gray-500">Cargando modelos de reconocimiento facial...</p>
              <div className="w-64 h-2 mt-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-blue-500 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
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
              playsInline
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
            
            {modelsLoaded && !detectedFace && detectionStarted && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-4 text-center bg-white bg-opacity-75 rounded-md">
                  <p className="text-sm text-gray-800">Coloque su rostro frente a la cámara</p>
                </div>
              </div>
            )}
            
            {detectedFace && livenessState === 'waiting' && (
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-white bg-opacity-75">
                <p className="text-sm font-medium text-gray-800">
                  {livenessChallenge === 'blink' && 'Por favor, parpadee varias veces'}
                  {livenessChallenge === 'smile' && 'Por favor, sonría ampliamente'}
                  {livenessChallenge === 'head-turn' && 'Por favor, gire levemente la cabeza'}
                </p>
              </div>
            )}
            
            {detectedFace && livenessState === 'progress' && (
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-blue-100 bg-opacity-75">
                <p className="text-sm font-medium text-blue-800">
                  {livenessChallenge === 'blink' && 'Parpadeo detectado... continúe'}
                  {livenessChallenge === 'smile' && 'Sonrisa detectada... continúe'}
                  {livenessChallenge === 'head-turn' && 'Giro detectado... continúe'}
                </p>
                <div className="w-full h-2 mt-2 bg-white bg-opacity-50 rounded-full">
                  <div 
                    className="h-2 bg-blue-500 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {livenessState === 'passed' && (
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-green-100 bg-opacity-75">
                <p className="text-sm font-medium text-green-800">
                  Verificación de vida exitosa
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
          Para completar la verificación, realice la siguiente acción: 
          {livenessChallenge === 'blink' && ' parpadee varias veces'}
          {livenessChallenge === 'smile' && ' sonría ampliamente'}
          {livenessChallenge === 'head-turn' && ' gire levemente la cabeza'}
        </p>
      </div>
    </div>
  );
};

export default BiometricCapture;