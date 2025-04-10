import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

// Tipos definidos fuera del componente para evitar recreaciones
type DetectedFace = faceapi.WithFaceLandmarks<
  faceapi.WithFaceDescriptor<faceapi.WithFaceExpressions<
    faceapi.WithFaceDetection<{}>
  >>
>;

type LivenessState = 'waiting' | 'progress' | 'passed' | 'failed';

// Cache de modelos para evitar cargas múltiples
const modelsLoadedCache = {
  status: false,
  promise: null as Promise<void> | null,
};

// Función pura para verificar ojos cerrados
const isEyesClosed = (face: DetectedFace): boolean => {
  const landmarks = face.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  
  // Calcular altura y anchura de los ojos
  const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
  const leftEyeWidth = Math.abs(leftEye[0].x - leftEye[3].x);
  
  const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
  const rightEyeWidth = Math.abs(rightEye[0].x - rightEye[3].x);
  
  // Calcular ratio altura/anchura
  const leftRatio = leftEyeHeight / leftEyeWidth;
  const rightRatio = rightEyeHeight / rightEyeWidth;
  
  // Umbral para determinar si los ojos están cerrados
  const threshold = 0.15;
  
  return leftRatio < threshold && rightRatio < threshold;
};

// Función pura para calcular asimetría facial
const calculateAsymmetry = (leftPoints: faceapi.Point[], rightPoints: faceapi.Point[]): number => {
  const xValues = [...leftPoints, ...rightPoints].map(p => p.x);
  const midX = (Math.min(...xValues) + Math.max(...xValues)) / 2;
  
  const leftDist = leftPoints.reduce((sum, point) => sum + Math.abs(point.x - midX), 0) / leftPoints.length;
  const rightDist = rightPoints.reduce((sum, point) => sum + Math.abs(point.x - midX), 0) / rightPoints.length;
  
  return Math.abs(leftDist - rightDist) / ((leftDist + rightDist) / 2);
};

// Función para cargar modelos de faceapi una sola vez en toda la aplicación
const loadFaceApiModels = async (): Promise<void> => {
  if (modelsLoadedCache.status) return;
  
  if (!modelsLoadedCache.promise) {
    modelsLoadedCache.promise = (async () => {
      try {
        // Cargar modelos en paralelo para mayor velocidad
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoadedCache.status = true;
      } catch (error) {
        console.error('Error loading face-api models:', error);
        throw error;
      }
    })();
  }
  
  return modelsLoadedCache.promise;
};

const BiometricCapture = ({ 
  onSuccess, 
  mode = 'register',
  challengeType = 'blink'
}: BiometricCaptureProps) => {
  const { user } = useAuth();
  // @ts-ignore
  const [isLoading, setIsLoading] = useState(true); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFace, setDetectedFace] = useState<DetectedFace | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessState, setLivenessState] = useState<LivenessState>('waiting');
  const [livenessChallenge, setLivenessChallenge] = useState(challengeType);
  const [error, setError] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [detectionStarted, setDetectionStarted] = useState(false);
  
  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  
  // Referencias para contadores y análisis de liveness (evita re-renderizados)
  const frameCounterRef = useRef<number>(0);
  const positiveFramesRef = useRef<number>(0);
  const totalFramesNeededRef = useRef<number>(30);
  const expressionHistoryRef = useRef<Array<faceapi.FaceExpressions>>([]);
  const lastBlinkStateRef = useRef<boolean>(false);
  
  // Cargar modelos con cache y progreso optimizado
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError('Cargando modelos de reconocimiento facial...');
        
        // Usar el loadFaceApiModels que implementa caching
        await loadFaceApiModels();
        
        setModelsLoaded(true);
        setError(null);
      } catch (err) {
        setError(`Error cargando modelos de reconocimiento facial: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadModels();
    
    // Limpieza
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (detectionIntervalRef.current) {
        window.clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);
  
  // Verificación de liveness memoizada para evitar recreación en cada render
  const checkLiveness = useCallback((face: DetectedFace) => {
  // Obtener expresiones faciales actuales
  const expressions = face.expressions;
  const history = expressionHistoryRef.current;
  
  // Iniciar verificación de liveness una vez que tenemos suficientes frames
  if (history.length < 5) return;
  
  if (livenessState === 'waiting' || livenessState === 'progress') {
    setLivenessState('progress');
    
    switch (livenessChallenge) {
      case 'blink':
        // Detección de parpadeo mejorada con análisis de secuencia temporal
        const eyesClosed = isEyesClosed(face);
        const currentBlinkState = expressions.neutral > 0.8 && eyesClosed;
        
        // Verificar duración del parpadeo para prevenir falsos positivos
        // Un parpadeo natural dura entre 100-400ms
        const blinkDuration = currentBlinkState ? 
          Date.now() - (lastBlinkStartTimeRef.current || Date.now()) : 0;
        
        if (currentBlinkState && !lastBlinkStateRef.current) {
          // Ojos recién cerrados - registrar tiempo
          lastBlinkStartTimeRef.current = Date.now();
        } else if (!currentBlinkState && lastBlinkStateRef.current) {
          // Ojos recién abiertos después de estar cerrados
          // Comprobar que la duración es razonable (evitar parpadeos falsos o pausas de video)
          if (blinkDuration > 50 && blinkDuration < 500) {
            // Parpadeo natural
            positiveFramesRef.current += 3;
            blinkDetectedCountRef.current += 1;
            
            // Mostrar feedback al usuario
            blinkFeedbackTimeoutRef.current = setTimeout(() => {
              setBlinkFeedback(false);
            }, 1000);
            setBlinkFeedback(true);
          }
        }
        
        lastBlinkStateRef.current = currentBlinkState;
        break;
        
      case 'smile':
        // Detección de sonrisa mejorada con verificación gradual y temporal
        // Una sonrisa genuina aparece gradualmente
        
        // Calcular promedio de expresión feliz en los últimos 5 frames
        const recentHappiness = history.slice(-5).reduce(
          (sum, expr) => sum + expr.happy, 0) / 5;
        
        // Calcular variación para detectar cambios bruscos (posible falsificación)
        const happyVariation = Math.abs(expressions.happy - recentHappiness);
        
        // Una sonrisa natural tiene cierta gradualidad
        if (expressions.happy > 0.7 && happyVariation < 0.2) {
          positiveFramesRef.current += 1;
          
          // Bonificación por sonrisa sostenida
          if (recentHappiness > 0.7 && smileDurationRef.current > 10) {
            positiveFramesRef.current += 1;
          }
          
          smileDurationRef.current += 1;
        } else {
          smileDurationRef.current = 0;
        }
        break;
        
      case 'head-turn':
        // Detección de giro de cabeza mejorada con análisis de suavidad de movimiento
        const landmarks = face.landmarks;
        const jawOutline = landmarks.getJawOutline();
        
        // Calcular asimetría para detectar giro
        const leftSide = jawOutline.slice(0, 8);
        const rightSide = jawOutline.slice(8);
        const asymmetry = calculateAsymmetry(leftSide, rightSide);
        
        // Guardar historial de asimetrías para analizar suavidad del movimiento
        asymmetryHistoryRef.current.push(asymmetry);
        if (asymmetryHistoryRef.current.length > 10) {
          asymmetryHistoryRef.current.shift();
        }
        
        // Calcular suavidad de movimiento
        const asymmetryDiffs = [];
        for (let i = 1; i < asymmetryHistoryRef.current.length; i++) {
          asymmetryDiffs.push(Math.abs(
            asymmetryHistoryRef.current[i] - asymmetryHistoryRef.current[i-1]
          ));
        }
        
        const movementSmoothness = asymmetryDiffs.length > 0 ? 
          1 - (asymmetryDiffs.reduce((a, b) => a + b, 0) / asymmetryDiffs.length) : 0;
        
        // Un movimiento natural es suave y tiene cierta asimetría
        if (asymmetry > 0.2 && movementSmoothness > 0.7) {
          positiveFramesRef.current += 1;
        }
        break;
    }
    
    // Sistema anti-fraude: Verificar consistencia entre frames
    const inconsistencyScore = this.detectInconsistencies(face, history);
    if (inconsistencyScore > 0.7) {
      // Posible intento de fraude - reset o penalización
      inconsistencyCountRef.current += 1;
      
      if (inconsistencyCountRef.current > 5) {
        // Demasiadas inconsistencias, posible fraude
        setError("Se detectaron inconsistencias en la verificación. Por favor, inténtelo de nuevo.");
        setLivenessState('failed');
        return;
      }
    } else {
      // Reset contador si no hay inconsistencias
      inconsistencyCountRef.current = Math.max(0, inconsistencyCountRef.current - 1);
    }
    
    // Actualizar progreso con estabilización para evitar fluctuaciones
    const rawProgress = Math.min(100, Math.round((positiveFramesRef.current / totalFramesNeededRef.current) * 100));
    const smoothedProgress = progressPercentage * 0.7 + rawProgress * 0.3;
    
    if (Math.abs(smoothedProgress - progressPercentage) > 1) {
      setProgressPercentage(Math.round(smoothedProgress));
    }
    
    // Verificar si se completó el desafío con umbral adaptativo
    // Requisito más estricto si se detectaron inconsistencias
    const adaptiveThreshold = totalFramesNeededRef.current * 
      (1 + (inconsistencyCountRef.current * 0.1));
    
    if (positiveFramesRef.current >= adaptiveThreshold) {
      setLivenessState('passed');
    }
  }
  }, [livenessState, livenessChallenge, progressPercentage]);
  
  // Función para detectar inconsistencias entre frames (posible fraude)
const detectInconsistencies = (face: DetectedFace, history: Array<faceapi.FaceExpressions>) => {
  // 1. Verificar cambios bruscos en landmarks faciales
  if (faceHistoryRef.current.length > 0) {
    const prevFace = faceHistoryRef.current[faceHistoryRef.current.length - 1];
    const landmarkDistance = calculateLandmarkDistance(prevFace.landmarks, face.landmarks);
    
    // Movimiento demasiado brusco entre frames
    if (landmarkDistance > LANDMARK_DISTANCE_THRESHOLD) {
      return 0.8; // Alta probabilidad de inconsistencia
    }
  }
  
  // 2. Verificar transiciones no naturales en expresiones
  if (history.length > 2) {
    const prevExpressions = history[history.length - 2];
    const currentExpressions = history[history.length - 1];
    
    // Cambio completamente brusco en todas las expresiones
    let totalChange = 0;
    Object.keys(currentExpressions).forEach(expr => {
      totalChange += Math.abs(currentExpressions[expr] - prevExpressions[expr]);
    });
    
    if (totalChange > 3.5) { // Umbral para cambio natural máximo entre frames
      return 0.9; // Muy alta probabilidad de inconsistencia
    }
  }
  
  // 3. Verificar iluminación constante
  if (illuminationHistoryRef.current.length > 5) {
    const illuminationVariance = calculateVariance(illuminationHistoryRef.current);
    if (illuminationVariance < 0.0001) { // Iluminación sospechosamente constante
      return 0.7; // Probable video pregrabado
    }
  }
  
  return 0; // Sin inconsistencias detectadas
};
  
  // Función para renderizar los resultados en el canvas
  const renderResults = useCallback((detections: DetectedFace[], displaySize: {width: number, height: number}) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redimensionar detecciones
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
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
  }, [livenessState]);
  
  // Detección optimizada usando un bucle de requestAnimationFrame en vez de setInterval
  const detectFaces = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;
    
    let animationFrameId: number;
    let lastProcessTimestamp = 0;
    const processInterval = 100; // Procesar cada 100ms en vez de cada frame
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.width, height: video.height };
    
    faceapi.matchDimensions(canvas, displaySize);
    
    const processFrame = async (timestamp: number) => {
      // Controlar la frecuencia de procesamiento para no saturar la CPU
      if (timestamp - lastProcessTimestamp >= processInterval) {
        frameCounterRef.current += 1;
        lastProcessTimestamp = timestamp;
        
        try {
          // Solo procesar si el video está activo
          if (video.paused || video.ended || !streamRef.current) {
            animationFrameId = requestAnimationFrame(processFrame);
            return;
          }
          
          // Detectar cara con landmarks, expresiones y descriptor facial
          const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.6 })
          )
          .withFaceLandmarks()
          .withFaceExpressions()
          .withFaceDescriptors();
          
          // Si se detectó al menos una cara
          if (detections.length > 0) {
            // Tomar la primera cara
            const detection = detections[0];
            
            // Actualizar solo si cambió significativamente
            if (!detectedFace || 
                Math.abs(detection.detection.score - (detectedFace?.detection.score || 0)) > 0.1) {
              setDetectedFace(detection);
            }
            
            // Añadir expresión al historial para análisis temporal
            expressionHistoryRef.current.push(detection.expressions);
            if (expressionHistoryRef.current.length > 10) {
              // Mantener solo los últimos 10 frames para análisis
              expressionHistoryRef.current.shift();
            }
            
            // Verificar prueba de vida según el desafío
            checkLiveness(detection);
            
            // Renderizar resultados
            renderResults(detections, displaySize);
          } else {
            if (detectedFace !== null) {
              setDetectedFace(null);
            }
            
            // Limpiar canvas si no hay detección
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            
            // Si perdemos la cara, reiniciamos el progreso de liveness
            if (livenessState === 'progress') {
              setLivenessState('waiting');
              positiveFramesRef.current = 0;
              setProgressPercentage(0);
            }
          }
        } catch (err) {
          console.error('Error en detección facial:', err);
        }
      }
      
      // Continuar el bucle
      animationFrameId = requestAnimationFrame(processFrame);
    };
    
    // Iniciar bucle de animación
    animationFrameId = requestAnimationFrame(processFrame);
    
    // Retornar función de limpieza
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [modelsLoaded, checkLiveness, detectedFace, livenessState, renderResults]);
  
  // Iniciar cámara con opciones optimizadas
  const startVideo = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      // Solicitar permisos de cámara con resolución adecuada pero priorizar rendimiento
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 15, max: 30 } // Reducido para mejor rendimiento
        }
      });
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      videoRef.current.onloadedmetadata = () => {
        setDetectionStarted(true);
        const cleanup = detectFaces();
        
        // Guardar función de limpieza
        return () => {
          if (cleanup) cleanup();
        };
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error accediendo a la cámara: ${errorMessage}. Verifique los permisos del navegador.`);
    }
  }, [detectFaces]);
  
  // Capturar y enviar datos biométricos - optimizada para evitar recreaciones
  const handleCapture = useCallback(async () => {
    if (!detectedFace || livenessState !== 'passed' || !user) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Obtener descriptor facial
      const descriptor = Array.from(detectedFace.descriptor);
      
      // Capturar frame actual - crear canvas solo cuando se necesita
      const canvas = document.createElement('canvas');
      if (videoRef.current) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            videoRef.current, 0, 0, canvas.width, canvas.height
          );
        }
      }
      
      // Reducir calidad para mejor rendimiento y menor tamaño de datos
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      
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
  }, [detectedFace, livenessState, livenessChallenge, mode, user, onSuccess]);
  
  // Cambiar desafío de prueba de vida - memoizado
  const changeChallenge = useCallback(() => {
    // Reiniciar estado de liveness
    setLivenessState('waiting');
    positiveFramesRef.current = 0;
    setProgressPercentage(0);
    
    // Cambiar tipo de desafío
    const challenges: Array<'blink' | 'smile' | 'head-turn'> = ['blink', 'smile', 'head-turn'];
    const currentIndex = challenges.indexOf(livenessChallenge as any);
    const nextIndex = (currentIndex + 1) % challenges.length;
    setLivenessChallenge(challenges[nextIndex]);
  }, [livenessChallenge]);
  
  // Mensajes de instrucción memoizados para evitar recreaciones en cada render
  const challengeInstructions = useMemo(() => ({
    blink: 'Por favor, parpadee varias veces',
    smile: 'Por favor, sonría ampliamente',
    'head-turn': 'Por favor, gire levemente la cabeza'
  }), []);
  
  // Mensaje de acción según challenge - memoizado
  const progressInstructions = useMemo(() => ({
    blink: 'Parpadeo detectado... continúe',
    smile: 'Sonrisa detectada... continúe',
    'head-turn': 'Giro detectado... continúe'
  }), []);
  
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
        {/* Mostrar pantalla de carga solo si los modelos no están cargados */}
        {!modelsLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-md">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-sm text-gray-500">Cargando modelos de reconocimiento facial...</p>
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
            
            {/* Mensajes condicionales según el estado */}
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
                  {challengeInstructions[livenessChallenge]}
                </p>
              </div>
            )}
            
            {detectedFace && livenessState === 'progress' && (
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center bg-blue-100 bg-opacity-75">
                <p className="text-sm font-medium text-blue-800">
                  {progressInstructions[livenessChallenge]}
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
          {challengeInstructions[livenessChallenge]}
        </p>
      </div>
    </div>
  );
};

// Exportar componente memoizado para evitar renderizados innecesarios
export default BiometricCapture;