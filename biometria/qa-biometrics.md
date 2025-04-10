# Guía de pruebas para autenticación biométrica

## Configuración inicial

1. Asegúrate de tener acceso a una cámara web funcionando
2. Prueba en los siguientes navegadores: Chrome, Firefox, Safari
3. Prueba en dispositivos móviles: Android, iOS

## Casos de prueba

### 1. Registro biométrico

- Acceder a la página de registro biométrico
- Verificar que se solicitan permisos de cámara
- Completar el desafío de liveness (parpadeo)
- Verificar registro exitoso
- Comprobar que se muestra mensaje de confirmación

### 2. Autenticación biométrica

- Acceder a la página de login
- Seleccionar opción de login biométrico
- Verificar que se activa la cámara
- Completar verificación facial
- Comprobar redirección a dashboard después de éxito

### 3. Verificación 2FA biométrica

- Iniciar sesión con credenciales normales
- Al realizar operación sensible, verificar solicitud de 2FA
- Completar verificación biométrica
- Comprobar que la operación sensible procede correctamente

### 4. Pruebas de rendimiento

- Verificar que la detección facial funciona sin retrasos notables
- En dispositivos de gama baja, el sistema debe funcionar aunque sea más lento
- La página no debe bloquearse durante el procesamiento facial

### 5. Pruebas de seguridad

- Intentar usar una fotografía en lugar de rostro real
- Verificar que el sistema rechaza videos pregrabados
- Comprobar que se muestra error apropiado en intentos de spoofing

## Métricas a reportar

- Tiempo promedio para completar registro: \_\_\_ segundos
- Tiempo promedio para autenticación: \_\_\_ segundos
- Tasa de falsos rechazos: \_\_\_% (usuarios legítimos rechazados)
- Tasa de falsos positivos: \_\_\_% (si es posible medirlo)
- Uso de memoria en dispositivos móviles: \_\_\_ MB
