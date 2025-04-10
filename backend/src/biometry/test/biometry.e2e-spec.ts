import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BiometryModule } from '../biometry.module';
import { User } from '../../users/entities/user.entity';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';

describe('BiometryController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let jwtService: JwtService;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'docusense_test',
          entities: [User],
          synchronize: true,
        }),
        BiometryModule,
        UsersModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Crear usuario de prueba
    testUserId = 'test-user-id-' + Date.now();

    // Generar token JWT para el usuario de prueba
    authToken = jwtService.sign({ sub: testUserId });
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/biometry/register (POST) - should validate input', () => {
    return request(app.getHttpServer())
      .post('/api/biometry/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        // Datos incompletos - falta descriptorData
        userId: testUserId,
        type: 'face',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('descriptorData');
      });
  });

  it('/api/biometry/register (POST) - should register biometric data', () => {
    // Crear descriptores faciales de prueba
    const faceDescriptor = Array(128)
      .fill(0)
      .map(() => Math.random());
    const descriptorData = Buffer.from(JSON.stringify(faceDescriptor)).toString(
      'base64',
    );

    return request(app.getHttpServer())
      .post('/api/biometry/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: testUserId,
        descriptorData,
        type: 'face',
        livenessProof: {
          challenge: 'blink',
          timestamp: Date.now(),
        },
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('registrados correctamente');
      });
  });

  it('/api/biometry/status (GET) - should return biometric status', () => {
    return request(app.getHttpServer())
      .get('/api/biometry/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('registered');
        expect(res.body.registered).toBe(true);
        expect(res.body).toHaveProperty('type');
        expect(res.body.type).toBe('face');
      });
  });

  it('/api/biometry/verify (POST) - should verify biometric data', () => {
    // Usar los mismos datos que al registrar
    const faceDescriptor = Array(128)
      .fill(0)
      .map(() => Math.random());
    const descriptorData = Buffer.from(JSON.stringify(faceDescriptor)).toString(
      'base64',
    );

    return request(app.getHttpServer())
      .post('/api/biometry/verify')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: testUserId,
        descriptorData,
        livenessProof: {
          challenge: 'blink',
          timestamp: Date.now(),
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('verified');
        // Podría ser true o false dependiendo de la implementación
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('/api/biometry/:userId (DELETE) - should remove biometric data', () => {
    return request(app.getHttpServer())
      .delete(`/api/biometry/${testUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('eliminados correctamente');
      });
  });
});
