graph TD
subgraph "Frontend"
A[Componente de Cámara]
B[FaceAPI.js]
C[Módulo de Liveness]
D[UI de Verificación]
end

    subgraph "Backend"
        E[BiometryModule]
        F[BiometryController]
        G[BiometryService]
        H[CryptoService]
        I[UsuariosService]
    end

    subgraph "Almacenamiento"
        J[PostgreSQL]
        K[Secure Storage]
    end

    A --> B
    B --> C
    C --> D
    D --> F
    F --> G
    G --> H
    G --> I
    H --> K
    I --> J
