// src/biometry/tests/biometry.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BiometryService } from '../biometry.service';
import { BiometricData } from '../entities/biometric-data.entity';
import { CryptoService } from '../../crypto/crypto.service';
import { UsersService } from '../../users/users.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RegisterBiometryDto } from '../dto/register-biometry.dto';
import { VerifyBiometryDto } from '../dto/verify-biometry.dto';
import { NotFoundException } from '@nestjs/common';

describe('BiometryService', () => {
  let service: BiometryService;
  let biometricDataRepository: Repository<BiometricData>;
  let cryptoService: CryptoService;
  let usersService: UsersService;
  let auditLogService: AuditLogService;

  // Mock data
  const mockUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
  };
  const mockBiometricData = {
    id: 'data-id',
    userId: 'user-id',
    descriptorData: Buffer.from('mock-encrypted-data'),
    iv: Buffer.from('mock-iv'),
    type: 'face',
    active: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiometryService,
        {
          provide: getRepositoryToken(BiometricData),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockResolvedValue(mockBiometricData),
            findOne: jest.fn().mockResolvedValue(mockBiometricData),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            encryptDocument: jest.fn().mockReturnValue({
              encryptedData: Buffer.from('mock-encrypted-data'),
              iv: Buffer.from('mock-iv'),
            }),
            decryptDocument: jest
              .fn()
              .mockReturnValue(Buffer.from('mock-descriptor')),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<BiometryService>(BiometryService);
    biometricDataRepository = module.get<Repository<BiometricData>>(
      getRepositoryToken(BiometricData),
    );
    cryptoService = module.get<CryptoService>(CryptoService);
    usersService = module.get<UsersService>(UsersService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register biometric data successfully', async () => {
      const registerDto: RegisterBiometryDto = {
        userId: 'user-id',
        descriptorData: 'base64-encoded-data',
        type: 'face',
      };

      const result = await service.register(registerDto);

      expect(usersService.findOne).toHaveBeenCalledWith('user-id');
      expect(cryptoService.encryptDocument).toHaveBeenCalled();
      expect(biometricDataRepository.create).toHaveBeenCalled();
      expect(biometricDataRepository.save).toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalled();
      expect(result).toEqual(mockBiometricData);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(null);

      const registerDto: RegisterBiometryDto = {
        userId: 'nonexistent-user',
        descriptorData: 'base64-encoded-data',
        type: 'face',
      };

      await expect(service.register(registerDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verify', () => {
    it('should verify biometric data successfully', async () => {
      // Override compareFaceDescriptors for this test
      jest
        .spyOn(service as any, 'compareFaceDescriptors')
        .mockReturnValueOnce(0.9);

      const verifyDto: VerifyBiometryDto = {
        userId: 'user-id',
        descriptorData: 'base64-encoded-data',
      };

      const result = await service.verify(verifyDto);

      expect(usersService.findOne).toHaveBeenCalledWith('user-id');
      expect(biometricDataRepository.findOne).toHaveBeenCalled();
      expect(cryptoService.decryptDocument).toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if biometric data not found', async () => {
      jest
        .spyOn(biometricDataRepository, 'findOne')
        .mockResolvedValueOnce(null);

      const verifyDto: VerifyBiometryDto = {
        userId: 'user-id',
        descriptorData: 'base64-encoded-data',
      };

      await expect(service.verify(verifyDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeUserBiometricData', () => {
    it('should remove biometric data and log the action', async () => {
      await service.removeUserBiometricData('user-id');

      expect(biometricDataRepository.delete).toHaveBeenCalledWith({
        userId: 'user-id',
      });
      expect(auditLogService.log).toHaveBeenCalled();
    });
  });
});
