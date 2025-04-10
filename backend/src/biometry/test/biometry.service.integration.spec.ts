import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { BiometryService } from '../biometry.service';
import { BiometricData } from '../entities/biometric-data.entity';
import { CryptoService } from '../../crypto/crypto.service';
import { UsersService } from '../../users/users.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RegisterBiometryDto } from '../dto/register-biometry.dto';
import { User } from '../../users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('BiometryService Integration Tests', () => {
  let service: BiometryService;
  let biometricDataRepository: Repository<BiometricData>;
  let userRepository: Repository<User>;
  let connection: Connection;
  let testUser: User;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
          entities: [BiometricData, User],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([BiometricData, User]),
      ],
      providers: [
        BiometryService,
        CryptoService,
        UsersService,
        AuditLogService,
      ],
    }).compile();

    service = module.get<BiometryService>(BiometryService);
    biometricDataRepository = module.get<Repository<BiometricData>>(
      getRepositoryToken(BiometricData),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    connection = module.get<Connection>(Connection);

    // Crear usuario de prueba
    testUser = userRepository.create({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword123',
    });
    await userRepository.save(testUser);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await biometricDataRepository.delete({});
    await userRepository.delete({ id: testUser.id });
    await connection.close();
  });

  it('should register biometric data and store it in the database', async () => {
    // Crear descriptores faciales de prueba (128 dimensiones)
    const faceDescriptor = Array(128)
      .fill(0)
      .map(() => Math.random());
    const descriptorData = Buffer.from(JSON.stringify(faceDescriptor)).toString(
      'base64',
    );

    const registerDto: RegisterBiometryDto = {
      userId: testUser.id,
      descriptorData,
      type: 'face',
      livenessProof: {
        challenge: 'blink',
        timestamp: Date.now(),
      },
    };

    // Registrar datos biométricos
    const result = await service.register(
      registerDto,
      '127.0.0.1',
      'Test Agent',
    );

    // Verificar que se guardó en la BD
    expect(result).toBeDefined();
    expect(result.userId).toBe(testUser.id);
    expect(result.type).toBe('face');
    expect(result.active).toBe(true);

    // Verificar que podemos recuperar los datos
    const storedData = await biometricDataRepository.findOne({
      where: { id: result.id },
    });
    expect(storedData).toBeDefined();
    expect(storedData.userId).toBe(testUser.id);
  });

  it('should verify biometric data correctly', async () => {
    // Primero registramos datos biométricos
    const faceDescriptor = Array(128)
      .fill(0)
      .map(() => Math.random());
    const descriptorData = Buffer.from(JSON.stringify(faceDescriptor)).toString(
      'base64',
    );

    // Registrar primero
    await service.register(
      {
        userId: testUser.id,
        descriptorData,
        type: 'face',
      },
      '127.0.0.1',
    );

    // Ahora verificamos con los mismos datos
    const isMatch = await service.verify(
      {
        userId: testUser.id,
        descriptorData,
      },
      '127.0.0.1',
    );

    // Debería verificar correctamente
    expect(isMatch).toBe(true);

    // Probar con datos diferentes (debería fallar)
    const differentDescriptor = Array(128)
      .fill(0)
      .map(() => Math.random());
    const differentData = Buffer.from(
      JSON.stringify(differentDescriptor),
    ).toString('base64');

    const noMatch = await service.verify(
      {
        userId: testUser.id,
        descriptorData: differentData,
      },
      '127.0.0.1',
    );

    expect(noMatch).toBe(false);
  });

  it('should handle liveness check correctly', async () => {
    // Crear imagen de prueba en base64
    const mockImageData =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD+f+iiigD/2Q==';

    const result = await service.checkLiveness({
      imageData: mockImageData,
      challenge: 'blink',
      timestamp: Date.now(),
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('live');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
  });

  it('should remove biometric data when requested', async () => {
    // Primero registramos datos
    const faceDescriptor = Array(128)
      .fill(0)
      .map(() => Math.random());
    const descriptorData = Buffer.from(JSON.stringify(faceDescriptor)).toString(
      'base64',
    );

    const registerResult = await service.register(
      {
        userId: testUser.id,
        descriptorData,
        type: 'face',
      },
      '127.0.0.1',
    );

    expect(registerResult).toBeDefined();

    // Ahora eliminamos los datos
    await service.removeUserBiometricData(
      testUser.id,
      '127.0.0.1',
      'Test Agent',
    );

    // Verificar que los datos están marcados como inactivos pero aún existen
    const biometricData = await biometricDataRepository.findOne({
      where: { id: registerResult.id },
    });

    expect(biometricData).toBeDefined();
    expect(biometricData.active).toBe(false);
    expect(biometricData.metadata).toHaveProperty('deactivatedAt');
    expect(biometricData.metadata.deactivatedReason).toBe('user_requested');
  });
});
