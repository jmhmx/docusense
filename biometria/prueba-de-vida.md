# Sistema de Verificación de Vida (Liveness Detection)

## Introducción

El sistema de verificación de vida (liveness detection) es un componente crítico para la seguridad biométrica de DocuSense. Su propósito es garantizar que los datos biométricos presentados durante el registro o verificación provengan de una persona real presente en el momento de la captura, previniendo ataques de suplantación mediante fotografías, videos o máscaras.

## Arquitectura

El sistema implementa una arquitectura cliente-servidor:

1. **Cliente (Frontend)**:

   - Captura de video en tiempo real
   - Detección facial con FaceAPI.js
   - Análisis de expresiones y movimientos
   - Generación de pruebas de desafío-respuesta

2. **Servidor (Backend)**:
   - Validación criptográfica de pruebas
   - Análisis forense de imágenes
   - Scoring de verificación
   - Almacenamiento seguro de metadatos

## Métodos de Detección

### 1. Desafío-Respuesta Activa

El sistema implementa tres tipos principales de desafíos:

#### a. Detección de Parpadeo

- **Método**: Se solicita al usuario que parpadee varias veces
- **Implementación**: Análisis de landmarks faciales para detectar apertura/cierre de ojos
- **Métricas**: Ratio altura/anchura de ojos < 0.15 indica ojos cerrados
- **Protección**: Requiere secuencia específica de abierto-cerrado-abierto en tiempo real

#### b. Detección de Expresiones

- **Método**: Se solicita al usuario que sonría
- **Implementación**: Análisis de expresiones faciales mediante clasificador de FaceAPI.js
- **Métricas**: Confianza > 0.7 para expresión "feliz" indica sonrisa
- **Protección**: Movimiento natural de músculos faciales difícil de falsificar

#### c. Detección de Giro de Cabeza

- **Método**: Se solicita al usuario que gire levemente la cabeza
- **Implementación**: Análisis de asimetría de landmarks faciales
- **Métricas**: Asimetría > 0.2 indica giro de cabeza
- **Protección**: Secuencia 3D difícil de falsificar con imágenes 2D

### 2. Análisis Pasivo

Complementa los desafíos activos con verificaciones automáticas:

- **Análisis de Textura**: Detección de patrones naturales de piel vs impresiones
- **Detección de Bordes**: Identificación de marcos de dispositivos o máscaras
- **Iluminación Consistente**: Verificación de patrones de luz natural vs artificial
- **Análisis de Micromovimientos**: Detección de pequeños movimientos naturales involuntarios

## Sistema de Puntuación

El sistema calcula una puntuación de vida (liveness score) entre 0.0 y 1.0:

| Puntuación | Nivel de Confianza | Acción                                     |
| ---------- | ------------------ | ------------------------------------------ |
| 0.0 - 0.3  | Muy bajo           | Rechazar, posible ataque                   |
| 0.3 - 0.6  | Bajo               | Rechazar, solicitar verificación adicional |
| 0.6 - 0.75 | Moderado           | Verificación adicional recomendada         |
| 0.75 - 0.9 | Alto               | Aceptar con monitorización                 |
| 0.9 - 1.0  | Muy alto           | Aceptar                                    |

La puntuación mínima requerida es configurable, siendo 0.75 el valor predeterminado.

## Mejoras para Fase 2

1. **Verificación de Profundidad**:

   - Implementación con cámaras TOF o análisis estéreo
   - Detección de estructura facial 3D

2. **Análisis de Textura Avanzado**:

   - Evaluación de frecuencias espaciales para diferenciar piel real vs impresa
   - Patrones de reflectancia de piel (subsurface scattering)

3. **Integración con Sistemas Profesionales**:

   - APIs de Kairos para verificación biométrica avanzada
   - FaceTec ZoOm para liveness 3D

4. **Verificación Multibiométrica**:
   - Combinación de factores faciales con voz o comportamiento
   - Análisis secuencial temporizado

## Consideraciones Legales

El sistema cumple con los siguientes requisitos legales en México:

1. **LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de Particulares)**:

   - Consentimiento explícito para recolección de datos biométricos
   - Almacenamiento cifrado de datos sensibles
   - Eliminación segura cuando se solicite

2. **LFEA (Ley Federal de Firma Electrónica Avanzada)**:
   - Autenticación robusta para validez legal de firmas
   - Verificación de identidad confiable
   - Pruebas forenses de autenticidad

## Métricas de Rendimiento

- **Tasa de Falsos Positivos (FPR)**: < 0.1% (probabilidad de aceptar un ataque)
- **Tasa de Falsos Negativos (FNR)**: < 3% (probabilidad de rechazar un usuario legítimo)
- **Tiempo promedio de verificación**: < 5 segundos
- **Compatibilidad**: Navegadores modernos con WebRTC, cámaras frontales estándar

## Logs y Auditoría

El sistema mantiene registros detallados de:

- Intentos de verificación (exitosos y fallidos)
- Puntuaciones de cada verificación
- Metadatos técnicos (desafío utilizado, duración, dispositivo)
- Alertas de seguridad por patrones sospechosos

Estos registros permiten:

- Investigación forense en caso de disputas
- Detección de patrones de ataques
- Mejora continua del sistema
- Cumplimiento con requisitos regulatorios

## Conclusión

El sistema de liveness detection proporciona una capa de seguridad esencial para el proceso de autenticación biométrica, garantizando que solo personas reales presentes físicamente puedan registrarse o verificarse en el sistema. La implementación de múltiples capas de verificación (desafío-respuesta, análisis pasivo y scoring) ofrece un nivel robusto de protección contra ataques de presentación.
