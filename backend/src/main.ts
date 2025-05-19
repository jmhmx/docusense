import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { webcrypto } from 'crypto';
import * as cookieParser from 'cookie-parser';

// Solución alternativa para Node.js 20+
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: false,
    enumerable: true,
  });
}
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Middleware para parsear cookies
  app.use(cookieParser());

  // Habilitar CORS
  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:5173',
      // Añadir aquí otros orígenes que necesites
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'], // Si se necesitan encabezados expuestos
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
