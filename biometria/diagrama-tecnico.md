graph TD
A[Cliente Frontend] -->|Captura Facial| B[FaceAPI.js]
B -->|Descriptores| C[BiometricCapture Component]

    C -->|UI/UX| P[BiometricRegistration Page]
    P -->|Flujo de registro| Q[Captura > Verificación > Confirmación]

    C -->|Registro/Verificación| D[API Backend]
    D -->|POST| E[BiometryController]
    E -->|Procesa| F[BiometryService]
    F -->|Encripta| G[CryptoService]
    F -->|Almacena| H[(BiometricData DB)]
    F -->|Registra Evento| I[AuditLogService]

    subgraph "Liveness Detection"
    J[Desafío Parpadeo] -->|Análisis| K[Verificación Prueba de Vida]
    L[Desafío Sonrisa] -->|Análisis| K
    M[Desafío Giro] -->|Análisis| K
    K -->|Anti-Spoofing| N[Validación Final]
    end

    subgraph "Flujo de Registro Biométrico"
    R[Inicio] -->|Consentimiento| S[Captura Biométrica]
    S -->|Liveness Check| T[Procesamiento]
    T -->|Éxito| U[Confirmación]
    T -->|Fallo| S
    U -->|Registro Completado| V[Dashboard]
    end
