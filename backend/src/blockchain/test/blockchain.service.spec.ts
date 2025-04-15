// backend/src/blockchain/test/blockchain.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from '../blockchain.service';
import { AuditLogService } from '../../audit/audit-log.service';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let auditLogService: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        BlockchainService,
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerDocument', () => {
    it('should register a document in local mode', async () => {
      const result = await service.registerDocument(
        'test-doc-id',
        'test-hash',
        { title: 'Test Document' },
        'test-user-id',
      );

      expect(result).toBe(true);
      expect(auditLogService.log).toHaveBeenCalled();
    });
  });

  describe('verifyDocument', () => {
    it('should verify a document in local mode', async () => {
      const result = await service.verifyDocument('test-doc-id', 'test-hash');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('registeredHash');
    });
  });

  describe('getVerificationCertificate', () => {
    it('should get a certificate in local mode', async () => {
      const result = await service.getVerificationCertificate('test-doc-id');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('documentId', 'test-doc-id');
      expect(result).toHaveProperty('certificateId');
    });
  });
});
