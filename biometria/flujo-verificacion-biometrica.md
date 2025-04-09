graph TD
A[Usuario inicia verificación] --> B[Captura de selfie/video]
B --> C[Detección de rostro]
C -->|Rostro no detectado| D[Solicitar nueva captura]
D --> B
C -->|Rostro detectado| E[Prueba de vida]
E -->|Fallo| F[Solicitar nueva prueba]
F --> E
E -->|Éxito| G[Generación de descriptor biométrico]
G --> H{¿Registro o verificación?}
H -->|Registro| I[Almacenar descriptor]
I --> J[Generar par de claves]
J --> K[Registrar e.firma]
H -->|Verificación| L[Comparar con descriptor almacenado]
L -->|No coincide| M[Rechazo]
L -->|Coincide| N[Autorizar firma]
N --> O[Firmar documento]
