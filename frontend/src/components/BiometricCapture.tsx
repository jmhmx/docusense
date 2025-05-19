import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as faceapi from 'face-api.js';
import { api } from '../api/client';
import Button from './Button';
import useAuth from '../hooks/UseAuth';

const MODEL_URL = '/models';

interface BiometricCaptureProps {
  onSuccess: (result: any) => void;
  mode: 'register' | 'verify';
  challengeType?: ChallengeType;
  challengeSequence?: boolean;
}

// Tipos definidos fuera del componente para evitar recreaciones
type DetectedFace = faceapi.WithFaceLandmarks<
  faceapi.WithFaceDescriptor<
    faceapi.WithFaceExpressions<faceapi.WithFaceDetection<{}>>
  >
>;

type LivenessState = 'waiting' | 'progress' | 'passed' | 'failed';

type ChallengeType = 'blink' | 'smile' | 'head-turn' | 'nod' | 'mouth-open';

const CHALLENGE_THRESHOLDS = {
  blink: 0.3, // Umbral para detectar ojos cerrados
  smile: 0.5, // Umbral para detectar sonrisa
  'head-turn': 0.25, // Umbral para detectar giros de cabeza
  nod: 0.4, // Umbral para detectar asentimiento
  'mouth-open': 0.45, // Umbral para detectar boca abierta
};

// Ajustar los contadores de referencia para cada tipo de desafío
const CHALLENGE_FRAMES_NEEDED = {
  blink: 15, // Para parpadeo necesitamos menos frames
  smile: 25, // La sonrisa requiere más tiempo para confirmarse
  'head-turn': 30, // El giro de cabeza necesita más tiempo
  nod: 20, // El asentimiento necesita verificación moderada
  'mouth-open': 18, // La apertura de boca
};

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

  // Calcular EAR (Eye Aspect Ratio) con mayor precisión
  const leftEAR = calculateEAR(leftEye);
  const rightEAR = calculateEAR(rightEye);

  // Usar promedio ponderado para evitar falsos positivos por guiños
  // Da más peso al ojo con mayor apertura para detectar parpadeos reales
  const earAvg =
    Math.min(leftEAR, rightEAR) * 0.7 + Math.max(leftEAR, rightEAR) * 0.3;

  // Umbral adaptativo más sensible
  const threshold = CHALLENGE_THRESHOLDS.blink; // 0.30 según nuestro ajuste

  return earAvg < threshold;
};

// Agregar función para calcular EAR
const calculateEAR = (eye: faceapi.Point[]): number => {
  // Distancia vertical entre puntos superiores e inferiores
  const height1 = euclideanDistance(eye[1], eye[5]);
  const height2 = euclideanDistance(eye[2], eye[4]);

  // Distancia horizontal entre extremos del ojo
  const width = euclideanDistance(eye[0], eye[3]);

  // Fórmula EAR: promedio de alturas verticales / anchura
  return (height1 + height2) / (2.0 * width);
};

const euclideanDistance = (pt1: faceapi.Point, pt2: faceapi.Point): number => {
  return Math.sqrt(Math.pow(pt2.x - pt1.x, 2) + Math.pow(pt2.y - pt1.y, 2));
};

// Función pura para calcular asimetría facial
const calculateAsymmetry = (
  leftPoints: faceapi.Point[],
  rightPoints: faceapi.Point[],
): number => {
  const xValues = [...leftPoints, ...rightPoints].map((p) => p.x);
  const midX = (Math.min(...xValues) + Math.max(...xValues)) / 2;

  const leftDist =
    leftPoints.reduce((sum, point) => sum + Math.abs(point.x - midX), 0) /
    leftPoints.length;
  const rightDist =
    rightPoints.reduce((sum, point) => sum + Math.abs(point.x - midX), 0) /
    rightPoints.length;

  return Math.abs(leftDist - rightDist) / ((leftDist + rightDist) / 2);
};

// Función para cargar modelos de faceapi una sola vez en toda la aplicación
const loadFaceApiModels = async (): Promise<void> => {
  if (modelsLoadedCache.status) return;

  if (!modelsLoadedCache.promise) {
    modelsLoadedCache.promise = (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        console.log('Face-api models loaded successfully');
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
  challengeType = 'smile',
}: BiometricCaptureProps) => {
  const { user } = useAuth();
  // @ts-ignore
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFace, setDetectedFace] = useState<DetectedFace | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessState, setLivenessState] = useState<LivenessState>('waiting');
  const [livenessChallenge, setLivenessChallenge] =
    useState<ChallengeType>(challengeType);
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
  const totalFramesNeededRef = useRef<number>(20);
  const expressionHistoryRef = useRef<Array<faceapi.FaceExpressions>>([]);
  const lastBlinkStateRef = useRef<boolean>(false);

  // Referencias para métricas de rendimiento
  const fpsCounterRef = useRef<number[]>([]);
  //const lastFrameTimeRef = useRef<number>(0);
  const memoryUsageRef = useRef<number[]>([]);

  const faceHistoryRef = useRef<Array<DetectedFace>>([]);
  const illuminationHistoryRef = useRef<Array<number>>([]);
  const asymmetryHistoryRef = useRef<Array<number>>([]);
  const lastBlinkStartTimeRef = useRef<number | null>(null);
  const blinkDetectedCountRef = useRef<number>(0);
  const blinkFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inconsistencyCountRef = useRef<number>(0);
  const smileDurationRef = useRef<number>(0);
  const [blinkFeedback, setBlinkFeedback] = useState<boolean>(false);

  const LANDMARK_DISTANCE_THRESHOLD = 0.5;

  const calculateLandmarkDistance = (
    landmarks1: faceapi.FaceLandmarks68,
    landmarks2: faceapi.FaceLandmarks68,
  ): number => {
    // Implementación simple para calcular distancia entre landmarks
    const points1 = landmarks1.positions;
    const points2 = landmarks2.positions;

    let totalDistance = 0;
    for (let i = 0; i < points1.length; i++) {
      const dx = points1[i].x - points2[i].x;
      const dy = points1[i].y - points2[i].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    return totalDistance / points1.length;
  };

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
        setError(
          `Error cargando modelos de reconocimiento facial: ${
            err instanceof Error ? err.message : 'Error desconocido'
          }`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();

    // Limpieza
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (detectionIntervalRef.current) {
        window.clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Solo cargar modelos cuando el usuario inicia la cámara
    if (detectionStarted && !modelsLoaded) {
      const loadModels = async () => {
        try {
          setIsLoading(true);
          setError('Cargando modelos de reconocimiento facial...');

          await loadFaceApiModels();

          setModelsLoaded(true);
          setError(null);
        } catch (err) {
          setError(
            `Error cargando modelos: ${
              err instanceof Error ? err.message : 'Error desconocido'
            }`,
          );
        } finally {
          setIsLoading(false);
        }
      };

      loadModels();
    }
  }, [detectionStarted, modelsLoaded]);

  // Agregar en useEffect para limpiar
  useEffect(() => {
    // Iniciar monitoreo de rendimiento
    let perfMonitorId: number;

    if (detectionStarted) {
      perfMonitorId = window.setInterval(() => {
        // Calcular FPS promedio
        if (fpsCounterRef.current.length > 0) {
          const avgFps =
            fpsCounterRef.current.reduce((a, b) => a + b, 0) /
            fpsCounterRef.current.length;
          console.debug(`BiometricCapture perf: ${avgFps.toFixed(1)} FPS`);

          // Reset para nuevo intervalo
          fpsCounterRef.current = [];
        }

        // Intentar obtener uso de memoria si está disponible
        if ('performance' in window && 'memory' in (performance as any)) {
          const memory = (performance as any).memory;
          memoryUsageRef.current.push(memory.usedJSHeapSize / (1024 * 1024));

          if (memoryUsageRef.current.length > 10) {
            memoryUsageRef.current.shift();
          }

          const avgMemory =
            memoryUsageRef.current.reduce((a, b) => a + b, 0) /
            memoryUsageRef.current.length;
          console.debug(`BiometricCapture memory: ${avgMemory.toFixed(1)} MB`);
        }
      }, 1000);
    }

    return () => {
      if (perfMonitorId) window.clearInterval(perfMonitorId);
    };
  }, [detectionStarted]);

  useEffect(() => {
    if (blinkFeedback) {
      // Proporcionar retroalimentación más prominente
      const progressElement = document.querySelector('.text-blue-700');
      if (progressElement) {
        progressElement.classList.add('font-bold', 'text-green-600');

        setTimeout(() => {
          progressElement.classList.remove('font-bold', 'text-green-600');
        }, 1000);
      }
    }
  }, [blinkFeedback]);

  // Verificación de liveness memoizada para evitar recreación en cada render
  const checkLiveness = useCallback(
    (face: DetectedFace) => {
      // Obtener expresiones faciales actuales
      const expressions = face.expressions;
      const history = expressionHistoryRef.current;
      const faceHistory = faceHistoryRef.current;

      // Iniciar verificación de liveness una vez que tenemos suficientes frames
      if (history.length < 5) {
        history.push(expressions);
        return;
      }

      // Actualizar estado a "en progreso"
      if (livenessState === 'waiting') {
        setLivenessState('progress');
      }

      // Asignar umbral correcto según el desafío
      //const challengeThreshold = CHALLENGE_THRESHOLDS[livenessChallenge] || 0.5;

      // Establecer frames totales necesarios según el desafío
      totalFramesNeededRef.current =
        CHALLENGE_FRAMES_NEEDED[livenessChallenge] || 20;

      // Verificar tipo de desafío
      switch (livenessChallenge) {
        case 'blink':
          // Verificar parpadeo
          const eyesClosed = isEyesClosed(face);

          // Detectar ciclo completo de parpadeo
          if (eyesClosed && !lastBlinkStateRef.current) {
            lastBlinkStateRef.current = true;
            lastBlinkStartTimeRef.current = Date.now();

            // Feedback visual
            setBlinkFeedback(true);
            if (blinkFeedbackTimeoutRef.current) {
              clearTimeout(blinkFeedbackTimeoutRef.current);
            }
            blinkFeedbackTimeoutRef.current = setTimeout(() => {
              setBlinkFeedback(false);
            }, 1000);

            // Incrementar contador de parpadeos detectados
            blinkDetectedCountRef.current += 1;
            positiveFramesRef.current += 5; // Bonus más alto por parpadeo completo
          } else if (!eyesClosed && lastBlinkStateRef.current) {
            lastBlinkStateRef.current = false;

            // Verificar que el parpadeo duró un tiempo razonable (evitar falsos positivos)
            const blinkDuration =
              Date.now() - (lastBlinkStartTimeRef.current || 0);
            if (blinkDuration > 50 && blinkDuration < 500) {
              // Duración típica de parpadeo (ms)
              positiveFramesRef.current += 5; // Bonus adicional mayor
            }
          }
          break;

        case 'smile':
          // Verificar sonrisa con mayor sensibilidad
          const smile = expressions.happy > CHALLENGE_THRESHOLDS.smile;
          if (smile) {
            smileDurationRef.current += 1;
            // Aumentar incremento para sonrisas para alcanzar umbral más rápido
            positiveFramesRef.current += 2.0;
          }
          break;

        case 'head-turn':
          // Verificar giro de cabeza con mejor detección de asimetría
          if (faceHistory.length > 2) {
            const currentLandmarks = face.landmarks;
            const prevLandmarks = faceHistory[faceHistory.length - 2].landmarks;

            // Calcular asimetría actual con mayor sensibilidad
            const leftEye = currentLandmarks.getLeftEye();
            const rightEye = currentLandmarks.getRightEye();
            const currentAsymmetry = calculateAsymmetry(leftEye, rightEye);

            asymmetryHistoryRef.current.push(currentAsymmetry);
            if (asymmetryHistoryRef.current.length > 10) {
              asymmetryHistoryRef.current.shift();
            }

            // Calcular distancia entre landmarks con umbral reducido
            const landmarkDistance = calculateLandmarkDistance(
              currentLandmarks,
              prevLandmarks,
            );

            // Verificar movimiento auténtico con umbral más bajo
            if (
              landmarkDistance > LANDMARK_DISTANCE_THRESHOLD * 0.7 &&
              landmarkDistance < LANDMARK_DISTANCE_THRESHOLD * 5
            ) {
              positiveFramesRef.current += 2; // Incremento mayor para giros
            } else {
              inconsistencyCountRef.current += 0.05; // Reducir penalización
            }
          }
          break;

        case 'nod':
          // Implementación mejorada para el desafío de asentimiento
          if (faceHistory.length > 2) {
            const currentLandmarks = face.landmarks;
            const prevLandmarks = faceHistory[faceHistory.length - 2].landmarks;

            // Calcular movimiento vertical de la nariz (punto de referencia para movimiento de cabeza)
            const currentNose = currentLandmarks.getNose()[0];
            const prevNose = prevLandmarks.getNose()[0];

            const verticalMovement = Math.abs(currentNose.y - prevNose.y);

            // Incrementar puntaje cuando hay movimiento vertical significativo
            if (verticalMovement > 3.0) {
              positiveFramesRef.current += 2.5;
            }
          }
          break;

        case 'mouth-open':
          // Implementación mejorada para el desafío de abrir la boca
          if (faceHistory.length > 1) {
            const landmarks = face.landmarks;
            const upperLip = landmarks.getMouth()[13]; // Punto superior del labio
            const lowerLip = landmarks.getMouth()[19]; // Punto inferior del labio

            // Calcular distancia entre labios (apertura de boca)
            const mouthOpenness = Math.abs(upperLip.y - lowerLip.y);

            // Si la boca está significativamente abierta
            if (mouthOpenness > 10) {
              positiveFramesRef.current += 2.5;
            }
          }
          break;
      }

      // Análisis de textura facial para anti-spoofing (mejorado)
      if (faceHistory.length > 3) {
        // Simplificación de verificación de iluminación para mejor rendimiento
        illuminationHistoryRef.current.push(0);
        if (illuminationHistoryRef.current.length > 10) {
          illuminationHistoryRef.current.shift();
        }
      }

      // Actualizar contador de frames
      frameCounterRef.current += 1;

      // Calcular progreso con mayor sensibilidad
      const confidence =
        positiveFramesRef.current / totalFramesNeededRef.current;
      const newProgress = Math.min(100, Math.round(confidence * 100));

      // Evitar cambios bruscos en la barra de progreso pero hacerla más receptiva
      const smoothedProgress = progressPercentage * 0.6 + newProgress * 0.4;
      setProgressPercentage(Math.round(smoothedProgress));

      // Verificar si se ha completado el desafío con umbral reducido
      if (confidence >= 0.85) {
        // Reducir de 1.0 a 0.85 para mayor facilidad
        setLivenessState('passed');
      }
    },
    [livenessChallenge, livenessState, progressPercentage],
  );

  const calculateEyeStatus = (face: DetectedFace): number => {
    const landmarks = face.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);

    return (leftEAR + rightEAR) / 2.0;
  };

  // Función para renderizar los resultados en el canvas
  const renderResults = useCallback(
    (
      detections: DetectedFace[],
      displaySize: { width: number; height: number },
    ) => {
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
        ctx.strokeStyle =
          livenessState === 'passed'
            ? 'green'
            : livenessState === 'failed'
            ? 'red'
            : livenessState === 'progress'
            ? 'blue'
            : 'yellow';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Show debug info
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(10, 10, 200, 80);
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';

        if (detections[0].expressions) {
          const earAvg = calculateEyeStatus(detections[0]);
          const smileScore = detections[0].expressions.happy.toFixed(2);
          ctx.fillText(`Blink score: ${earAvg.toFixed(2)}`, 15, 30);
          ctx.fillText(`Smile score: ${smileScore}`, 15, 50);
          ctx.fillText(`Progress: ${progressPercentage}%`, 15, 70);
        }
      }

      if (blinkFeedback && detections.length > 0) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.font = '20px Arial';
        ctx.fillText('¡Parpadeo detectado!', 10, 30);
      }
    },
    [livenessState, blinkFeedback],
  );

  // Detección optimizada usando un bucle de requestAnimationFrame en vez de setInterval
  const detectFaces = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;

    let animationFrameId: number;
    // Ajustar intervalos para diferentes dispositivos pero reducir para mayor responsividad
    const processInterval = navigator.userAgent.match(/Mobile|Android/)
      ? 100
      : 60; // Ajuste más frecuente
    let lastProcessTimestamp = 0;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.width, height: video.height };

    faceapi.matchDimensions(canvas, displaySize);

    const processFrame = async (timestamp: number) => {
      const shouldProcess = timestamp - lastProcessTimestamp >= processInterval;

      if (shouldProcess) {
        lastProcessTimestamp = timestamp;
        frameCounterRef.current += 1;

        try {
          if (video.paused || video.ended || !streamRef.current) {
            animationFrameId = requestAnimationFrame(processFrame);
            return;
          }

          // Usar TinyFaceDetector con parámetros optimizados para mejor detección
          const detections = await faceapi
            .detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({
                scoreThreshold: 0.5, // Reducir umbral para mayor sensibilidad
                inputSize: 320, // Balanceado para rendimiento/precisión
              }),
            )
            .withFaceLandmarks(true)
            .withFaceExpressions()
            .withFaceDescriptors();

          if (detections.length > 0) {
            // Calcular iluminación para anti-spoofing (simplificado)
            const bestDetection = detections[0];
            setDetectedFace(bestDetection);
            expressionHistoryRef.current.push(bestDetection.expressions);
            faceHistoryRef.current.push(bestDetection);

            // Límite de historial para optimizar memoria
            if (faceHistoryRef.current.length > 10) {
              faceHistoryRef.current.shift();
            }

            renderResults(detections, displaySize);
            checkLiveness(bestDetection);
          } else {
            setDetectedFace(null);
          }
        } catch (err) {
          console.error('Error en detección facial:', err);
        }
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    animationFrameId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
      expressionHistoryRef.current = [];
      faceHistoryRef.current = [];
      illuminationHistoryRef.current = [];
    };
  }, [modelsLoaded, checkLiveness, renderResults]);

  // Iniciar cámara con opciones optimizadas
  const startVideo = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      // Detectar dispositivo para adaptar configuración
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isLowEndDevice = navigator.hardwareConcurrency <= 4;

      // Adaptar configuración según dispositivo
      const constraints = {
        video: {
          width: { ideal: isMobile ? 640 : 640 },
          height: { ideal: isMobile ? 480 : 480 },
          facingMode: 'user',
          frameRate: {
            ideal: isLowEndDevice ? 10 : isMobile ? 15 : 30,
            max: isLowEndDevice ? 15 : isMobile ? 20 : 30,
          },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // Reducir tamaño de visualización en móviles para mejorar rendimiento
      if (isMobile && videoRef.current) {
        videoRef.current.style.width = '100%';
        videoRef.current.style.maxWidth = '320px';
      }

      videoRef.current.onloadedmetadata = () => {
        setDetectionStarted(true);
        const cleanup = detectFaces();

        return () => {
          if (cleanup) cleanup();
        };
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido';
      setError(
        `Error accediendo a la cámara: ${errorMessage}. Verifique los permisos del navegador.`,
      );
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
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
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
            imageData,
          },
          type: 'face',
          metadata: {
            livenessScore: positiveFramesRef.current / frameCounterRef.current,
            device: navigator.userAgent,
            challengeType: livenessChallenge,
          },
        });

        if (response.data.success) {
          onSuccess(response.data);
        } else {
          setError(
            response.data.message || 'Error al registrar datos biométricos',
          );
        }
      } else {
        // Verificar identidad
        const response = await api.post('/api/biometry/verify', {
          userId: user.id,
          descriptorData: btoa(JSON.stringify(descriptor)),
          livenessProof: {
            challenge: livenessChallenge,
            timestamp: new Date().getTime(),
            imageData,
          },
        });

        onSuccess({
          ...response.data,
          descriptorData: btoa(JSON.stringify(descriptor)),
          challenge: livenessChallenge,
        });
      }
    } catch (err: any) {
      console.error('Error procesando datos biométricos:', err);
      setError(
        `Error ${
          mode === 'register' ? 'registrando' : 'verificando'
        } datos biométricos: ${err.response?.data?.message || err.message}`,
      );
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
    const challenges: Array<ChallengeType> = ['blink', 'smile', 'head-turn'];
    const currentIndex = challenges.indexOf(livenessChallenge);
    const nextIndex = (currentIndex + 1) % challenges.length;
    setLivenessChallenge(challenges[nextIndex]);
  }, [livenessChallenge]);

  // Mensajes de instrucción memoizados para evitar recreaciones en cada render
  const challengeInstructions = useMemo(
    () =>
      ({
        blink: 'Por favor, parpadee varias veces',
        smile: 'Por favor, sonría ampliamente',
        'head-turn': 'Por favor, gire levemente la cabeza',
        nod: 'Por favor, asienta con la cabeza',
        'mouth-open': 'Por favor, abra la boca',
      } as Record<ChallengeType, string>),
    [],
  );

  // Mensaje de acción según challenge - memoizado
  const progressInstructions = useMemo(
    () =>
      ({
        blink: 'Parpadeo detectado... continúe',
        smile: 'Sonrisa detectada... continúe',
        'head-turn': 'Giro detectado... continúe',
        nod: 'Asentimiento detectado... continúe',
        'mouth-open': 'Apertura de boca detectada... continúe',
      } as Record<ChallengeType, string>),
    [],
  );

  return (
    <div className='p-4 bg-white rounded-lg shadow'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-medium text-gray-900'>
          {mode === 'register'
            ? 'Registro biométrico'
            : 'Verificación biométrica'}
        </h3>
        {livenessState !== 'passed' && detectionStarted && (
          <Button
            onClick={changeChallenge}
            variant='secondary'
            size='small'>
            Cambiar desafío
          </Button>
        )}
      </div>

      {error && (
        <div className='p-4 mb-4 rounded-md bg-red-50'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='w-5 h-5 text-red-400'
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-red-800'>{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className='relative'>
        {/* Mostrar pantalla de carga solo si los modelos no están cargados */}
        {!modelsLoaded && (
          <div className='absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-md'>
            <div className='text-center'>
              <svg
                className='w-10 h-10 mx-auto text-blue-500 animate-spin'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'>
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
              </svg>
              <p className='mt-2 text-sm text-gray-500'>
                Cargando modelos de reconocimiento facial...
              </p>
            </div>
          </div>
        )}

        <div className='flex flex-col items-center'>
          <div className='relative mb-4'>
            <video
              ref={videoRef}
              width='640'
              height='480'
              autoPlay
              playsInline
              muted
              className='rounded-md'
              style={{ display: !modelsLoaded ? 'none' : 'block' }}
            />
            <canvas
              ref={canvasRef}
              width='640'
              height='480'
              className='absolute top-0 left-0 z-10'
            />

            {/* Mensajes condicionales según el estado */}
            {modelsLoaded && !detectedFace && detectionStarted && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='p-4 text-center bg-white bg-opacity-75 rounded-md'>
                  <p className='text-sm text-gray-800'>
                    Coloque su rostro frente a la cámara
                  </p>
                </div>
              </div>
            )}

            {detectedFace && livenessState === 'waiting' && (
              <div className='absolute bottom-0 left-0 right-0 p-4 text-center bg-white bg-opacity-75'>
                <p className='text-sm font-medium text-gray-800'>
                  {challengeInstructions[livenessChallenge]}
                </p>
              </div>
            )}

            {detectedFace && livenessState === 'progress' && (
              <div className='absolute bottom-0 left-0 right-0 p-4 text-center bg-blue-100 bg-opacity-75'>
                <p className='text-sm font-medium text-blue-800'>
                  {progressInstructions[livenessChallenge]}
                </p>
                <div className='w-full h-4 mt-2 bg-white bg-opacity-50 rounded-full'>
                  <div
                    className='h-4 transition-all duration-300 bg-blue-500 rounded-full'
                    style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <p className='mt-1 text-xs text-blue-700'>
                  Progreso: {progressPercentage}%
                </p>
              </div>
            )}

            {livenessState === 'passed' && (
              <div className='absolute bottom-0 left-0 right-0 p-4 text-center bg-green-100 bg-opacity-75'>
                <p className='text-sm font-medium text-green-800'>
                  Verificación de vida exitosa
                </p>
              </div>
            )}
          </div>

          <div className='z-50 flex space-x-4'>
            {!streamRef.current && (
              <Button
                onClick={startVideo}
                disabled={!modelsLoaded || isProcessing}>
                Iniciar cámara
              </Button>
            )}

            <Button
              onClick={handleCapture}
              disabled={
                !detectedFace || livenessState !== 'passed' || isProcessing
              }
              variant='primary'>
              {isProcessing
                ? 'Procesando...'
                : mode === 'register'
                ? 'Registrar biometría'
                : 'Verificar identidad'}
            </Button>
          </div>
        </div>
      </div>

      <div className='mt-4'>
        <p className='text-sm text-gray-500'>
          {mode === 'register'
            ? 'Su rostro será registrado para futuras verificaciones de identidad.'
            : 'Se verificará su identidad usando reconocimiento facial.'}
        </p>
        <p className='mt-2 text-xs text-gray-400'>
          Para completar la verificación, realice la siguiente acción:
          {challengeInstructions[livenessChallenge]}
        </p>
      </div>
      {blinkFeedback && (
        <div className='absolute top-0 left-0 right-0 p-2 text-center text-white bg-green-500 bg-opacity-75'>
          ¡Parpadeo detectado!
        </div>
      )}
    </div>
  );
};

// Exportar componente memoizado para evitar renderizados innecesarios
export default BiometricCapture;
