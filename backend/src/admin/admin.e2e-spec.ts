import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SystemConfiguration } from './entities/system-configuration.entity';

describe('AdminController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let configService: ConfigService;
  let userRepository: Repository<User>;
  let systemConfigRepository: Repository<SystemConfiguration>;
  let adminToken: string;
  let regularUserToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    systemConfigRepository = moduleFixture.get<Repository<SystemConfiguration>>(
      getRepositoryToken(SystemConfiguration),
    );

    // Crear un usuario administrador para pruebas
    const adminUser = userRepository.create({
      name: 'Admin Test',
      email: 'admin-test@example.com',
      password: 'hash_password_here', // En una aplicación real, esto estaría hasheado
      isAdmin: true,
    });

    await userRepository.save(adminUser);

    // Crear un usuario regular para pruebas
    const regularUser = userRepository.create({
      name: 'Regular User',
      email: 'user-test@example.com',
      password: 'hash_password_here', // En una aplicación real, esto estaría hasheado
      isAdmin: false,
    });

    await userRepository.save(regularUser);

    // Generar tokens JWT para las pruebas
    adminToken = jwtService.sign({
      sub: adminUser.id,
      isAdmin: true,
    });

    regularUserToken = jwtService.sign({
      sub: regularUser.id,
      isAdmin: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Configuration Management', () => {
    it('GET /api/admin/configuration - should return 403 for non-admin users', async () => {
      return request(app.getHttpServer())
        .get('/api/admin/configuration')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('GET /api/admin/configuration - should return configuration for admin users', async () => {
      return request(app.getHttpServer())
        .get('/api/admin/configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          // Verificar estructura de la respuesta
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('security');
          expect(res.body).toHaveProperty('storage');
          expect(res.body).toHaveProperty('blockchain');
        });
    });

    it('PUT /api/admin/configuration - should update configuration', async () => {
      // Obtener configuración actual
      const configResponse = await request(app.getHttpServer())
        .get('/api/admin/configuration')
        .set('Authorization', `Bearer ${adminToken}`);

      const currentConfig = configResponse.body;

      // Modificar algún valor
      const updatedConfig = {
        ...currentConfig,
        security: {
          ...currentConfig.security,
          passwordMinLength: 10, // Cambiar longitud mínima de contraseña
        },
      };

      // Enviar actualización
      return request(app.getHttpServer())
        .put('/api/admin/configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedConfig)
        .expect(200)
        .expect((res) => {
          // Verificar que el valor se actualizó
          expect(res.body.security.passwordMinLength).toBe(10);
        });
    });

    it('POST /api/admin/configuration/reset/:section - should reset section to defaults', async () => {
      return request(app.getHttpServer())
        .post('/api/admin/configuration/reset/security')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          // Verificar que la sección se resetea a los valores predeterminados
          expect(res.body.security.passwordMinLength).toBe(8); // Valor por defecto
        });
    });

    it('POST /api/admin/configuration/test-email - should test email config', async () => {
      return request(app.getHttpServer())
        .post('/api/admin/configuration/test-email')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res) => {
          // La prueba puede fallar si la configuración SMTP no es válida
          expect(res.body).toHaveProperty('success');
          expect(res.body).toHaveProperty('message');
        });
    });

    it('POST /api/admin/configuration/test-blockchain - should test blockchain connection', async () => {
      return request(app.getHttpServer())
        .post('/api/admin/configuration/test-blockchain')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res) => {
          // La prueba puede fallar si la configuración blockchain no es válida
          expect(res.body).toHaveProperty('success');
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('Initial Admin Setup', () => {
    beforeEach(async () => {
      // Eliminar todos los administradores antes de cada prueba
      await userRepository.delete({ isAdmin: true });
    });

    it('POST /api/admin/setup/initial-admin - should create initial admin', async () => {
      const setupKey =
        configService.get<string>('ADMIN_SETUP_KEY') || 'test_setup_key';

      return request(app.getHttpServer())
        .post('/api/admin/setup/initial-admin')
        .send({
          name: 'Initial Admin',
          email: 'initial-admin@example.com',
          password: 'securepassword',
          setupKey,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Initial Admin');
          expect(res.body.isAdmin).toBe(true);
        });
    });

    it('POST /api/admin/setup/initial-admin - should fail with wrong setup key', async () => {
      return request(app.getHttpServer())
        .post('/api/admin/setup/initial-admin')
        .send({
          name: 'Invalid Admin',
          email: 'invalid-admin@example.com',
          password: 'securepassword',
          setupKey: 'wrong_key',
        })
        .expect(401);
    });
  });

  describe('System Stats', () => {
    it('GET /api/admin/stats - should return system stats for admin', async () => {
      return request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalUsers');
          expect(res.body).toHaveProperty('totalDocuments');
        });
    });
  });
});
