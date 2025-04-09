// src/biometry/tests/biometry.controller.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
//import { BiometricData } from '../entities/biometric-data.entity';
//import { getRepositoryToken } from '@nestjs/typeorm';

describe('BiometryController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Login para obtener token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.token;
  });

  it('/api/biometry/register (POST) - should register biometric data', async () => {
    const mockDescriptorData = Buffer.from(
      JSON.stringify(Array(128).fill(0.5)),
    ).toString('base64');

    return request(app.getHttpServer())
      .post('/api/biometry/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: 'test-user-id', // Debe ser el mismo ID del usuario logueado
        descriptorData: mockDescriptorData,
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

  it('/api/biometry/verify (POST) - should verify biometric data', async () => {
    const mockDescriptorData = Buffer.from(
      JSON.stringify(Array(128).fill(0.5)),
    ).toString('base64');

    return request(app.getHttpServer())
      .post('/api/biometry/verify')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: 'test-user-id', // Debe ser el mismo ID del usuario logueado
        descriptorData: mockDescriptorData,
        livenessProof: {
          challenge: 'blink',
          timestamp: Date.now(),
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('verified');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('/api/biometry/:userId (DELETE) - should remove biometric data', async () => {
    return request(app.getHttpServer())
      .delete('/api/biometry/test-user-id')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('eliminados correctamente');
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
