import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';
import * as fabricClient from 'fabric-network';
import * as path from 'path';
import * as fs from 'fs';

interface BlockchainConfig {
  connectionProfile: string;
  channelName: string;
  chaincodeName: string;
  walletPath: string;
  orgMSPID: string;
}

interface DocumentRecord {
  documentId: string;
  documentHash: string;
  metadata: {
    title: string;
    owner: string;
    createdAt: string;
    size: number;
    mimeType?: string;
  };
  history: Array<{
    action: string;
    timestamp: string;
    userId: string;
    hash?: string;
  }>;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private config: BlockchainConfig;
  private wallet: fabricClient.Wallet;
  private initialized = false;
  private isLocalMode: boolean;

  constructor(
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {
    // Initialize blockchain config
    this.config = {
      connectionProfile: this.configService.get<string>(
        'BLOCKCHAIN_CONNECTION_PROFILE',
        'local',
      ),
      channelName: this.configService.get<string>(
        'BLOCKCHAIN_CHANNEL',
        'documentchannel',
      ),
      chaincodeName: this.configService.get<string>(
        'BLOCKCHAIN_CHAINCODE',
        'documentcc',
      ),
      walletPath: this.configService.get<string>(
        'BLOCKCHAIN_WALLET_PATH',
        './wallet',
      ),
      orgMSPID: this.configService.get<string>(
        'BLOCKCHAIN_ORG_MSPID',
        'Org1MSP',
      ),
    };

    // Check if using local mode (for development without actual blockchain)
    this.isLocalMode = this.config.connectionProfile === 'local';

    // Initialize blockchain connection
    this.initializeBlockchain().catch((err) => {
      this.logger.error(
        `Failed to initialize blockchain: ${err.message}`,
        err.stack,
      );
    });
  }

  private async initializeBlockchain(): Promise<void> {
    if (this.isLocalMode) {
      this.logger.warn(
        'Running in local mode - no actual blockchain connection will be established',
      );
      this.initialized = true;
      return;
    }

    try {
      // Create file system wallet for managing identities
      const walletPath = path.resolve(this.config.walletPath);
      this.wallet = await fabricClient.Wallets.newFileSystemWallet(walletPath);

      // Check if admin identity exists in wallet
      const adminIdentity = await this.wallet.get('admin');
      if (!adminIdentity) {
        this.logger.error('Admin identity not found in wallet');
        throw new Error('Admin identity not found in wallet');
      }

      this.initialized = true;
      this.logger.log('Blockchain connection initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize blockchain: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Register a document on the blockchain
   * @param documentId Unique document ID
   * @param documentHash SHA-256 hash of the document
   * @param metadata Document metadata
   * @param userId User ID registering the document
   */
  async registerDocument(
    documentId: string,
    documentHash: string,
    metadata: any,
    userId: string,
  ): Promise<boolean> {
    this.logger.log(`Registering document ${documentId} on blockchain`);

    if (!this.initialized) {
      throw new BadRequestException('Blockchain service not initialized');
    }

    if (this.isLocalMode) {
      // In local mode, simulate blockchain registration
      this.logger.log(
        `[LOCAL MODE] Document ${documentId} registered with hash ${documentHash}`,
      );

      // Record the action in audit log
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        userId,
        documentId,
        {
          action: 'blockchain_register',
          hash: documentHash,
          localMode: true,
        },
      );

      return true;
    }

    try {
      // Connect to the gateway
      const connectionProfile = JSON.parse(
        fs.readFileSync(this.config.connectionProfile, 'utf8'),
      );
      const gateway = new fabricClient.Gateway();

      await gateway.connect(connectionProfile, {
        wallet: this.wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true },
      });

      // Get the network and contract
      const network = await gateway.getNetwork(this.config.channelName);
      const contract = network.getContract(this.config.chaincodeName);

      // Create document record
      const documentRecord: DocumentRecord = {
        documentId,
        documentHash,
        metadata: {
          title: metadata.title || 'Untitled',
          owner: userId,
          createdAt: new Date().toISOString(),
          size: metadata.fileSize || 0,
          mimeType: metadata.mimeType,
        },
        history: [
          {
            action: 'REGISTER',
            timestamp: new Date().toISOString(),
            userId,
            hash: documentHash,
          },
        ],
      };

      // Submit transaction to blockchain
      await contract.submitTransaction(
        'RegisterDocument',
        documentId,
        JSON.stringify(documentRecord),
      );

      // Record the action in audit log
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        userId,
        documentId,
        {
          action: 'blockchain_register',
          hash: documentHash,
        },
      );

      // Disconnect from the gateway
      gateway.disconnect();

      this.logger.log(
        `Document ${documentId} successfully registered on blockchain`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error registering document on blockchain: ${error.message}`,
        error.stack,
      );

      // Record the failed action in audit log
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        userId,
        documentId,
        {
          action: 'blockchain_register_failed',
          hash: documentHash,
          error: error.message,
        },
      );

      throw new BadRequestException(
        `Failed to register document on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Verify a document's integrity using the blockchain
   * @param documentId ID of document to verify
   * @param documentHash Current hash of the document
   */
  async verifyDocument(
    documentId: string,
    documentHash: string,
  ): Promise<{
    verified: boolean;
    registeredHash?: string;
    lastUpdate?: string;
    history?: any[];
    reason?: string;
  }> {
    this.logger.log(`Verifying document ${documentId} on blockchain`);

    if (!this.initialized) {
      throw new BadRequestException('Blockchain service not initialized');
    }

    if (this.isLocalMode) {
      // In local mode, simulate blockchain verification
      this.logger.log(
        `[LOCAL MODE] Verifying document ${documentId} with hash ${documentHash}`,
      );

      // Simulate a 50/50 chance of verification success in local mode for testing
      const verified = Math.random() > 0.5;

      return {
        verified,
        registeredHash: verified
          ? documentHash
          : `simulated-different-hash-${Date.now()}`,
        lastUpdate: new Date().toISOString(),
        reason: verified
          ? undefined
          : 'Simulated verification failure in local mode',
      };
    }

    try {
      // Connect to the gateway
      const connectionProfile = JSON.parse(
        fs.readFileSync(this.config.connectionProfile, 'utf8'),
      );
      const gateway = new fabricClient.Gateway();

      await gateway.connect(connectionProfile, {
        wallet: this.wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true },
      });

      // Get the network and contract
      const network = await gateway.getNetwork(this.config.channelName);
      const contract = network.getContract(this.config.chaincodeName);

      // Query the ledger
      const result = await contract.evaluateTransaction(
        'GetDocument',
        documentId,
      );

      if (!result || result.length === 0) {
        return {
          verified: false,
          reason: 'Document not found on blockchain',
        };
      }

      // Parse the document record
      const documentRecord: DocumentRecord = JSON.parse(result.toString());

      // Verify the hash
      const registeredHash = documentRecord.documentHash;
      const verified = registeredHash === documentHash;

      // Get last update from history
      const lastUpdateEntry = documentRecord.history.slice(-1)[0];

      // Disconnect from the gateway
      gateway.disconnect();

      return {
        verified,
        registeredHash,
        lastUpdate: lastUpdateEntry?.timestamp,
        history: documentRecord.history,
        reason: verified
          ? undefined
          : 'Document hash does not match registered hash',
      };
    } catch (error) {
      this.logger.error(
        `Error verifying document on blockchain: ${error.message}`,
        error.stack,
      );

      return {
        verified: false,
        reason: `Error verifying document: ${error.message}`,
      };
    }
  }

  /**
   * Update a document's record on the blockchain (for signatures, revisions, etc.)
   * @param documentId ID of document to update
   * @param documentHash New hash of the document
   * @param action Type of action being performed
   * @param userId User performing the action
   * @param metadata Additional metadata for the action
   */
  async updateDocumentRecord(
    documentId: string,
    documentHash: string,
    action: string,
    userId: string,
    metadata?: any,
  ): Promise<boolean> {
    this.logger.log(`Updating document ${documentId} record on blockchain`);

    if (!this.initialized) {
      throw new BadRequestException('Blockchain service not initialized');
    }

    if (this.isLocalMode) {
      // In local mode, simulate blockchain update
      this.logger.log(
        `[LOCAL MODE] Document ${documentId} record updated with action ${action}`,
      );

      // Record the action in audit log
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        userId,
        documentId,
        {
          action: 'blockchain_update',
          blockchainAction: action,
          hash: documentHash,
          localMode: true,
        },
      );

      return true;
    }

    try {
      // Connect to the gateway
      const connectionProfile = JSON.parse(
        fs.readFileSync(this.config.connectionProfile, 'utf8'),
      );
      const gateway = new fabricClient.Gateway();

      await gateway.connect(connectionProfile, {
        wallet: this.wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true },
      });

      // Get the network and contract
      const network = await gateway.getNetwork(this.config.channelName);
      const contract = network.getContract(this.config.chaincodeName);

      // First, get the current document record
      const result = await contract.evaluateTransaction(
        'GetDocument',
        documentId,
      );

      if (!result || result.length === 0) {
        throw new Error('Document not found on blockchain');
      }

      // Parse the document record
      const documentRecord: DocumentRecord = JSON.parse(result.toString());

      // Add new history entry
      documentRecord.history.push({
        action,
        timestamp: new Date().toISOString(),
        userId,
        hash: documentHash,
        ...metadata,
      });

      // Update document hash if needed
      if (documentHash) {
        documentRecord.documentHash = documentHash;
      }

      // Submit transaction to update the record
      await contract.submitTransaction(
        'UpdateDocument',
        documentId,
        JSON.stringify(documentRecord),
      );

      // Record the action in audit log
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        userId,
        documentId,
        {
          action: 'blockchain_update',
          blockchainAction: action,
          hash: documentHash,
        },
      );

      // Disconnect from the gateway
      gateway.disconnect();

      this.logger.log(
        `Document ${documentId} record successfully updated on blockchain`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error updating document record on blockchain: ${error.message}`,
        error.stack,
      );

      // Record the failed action in audit log
      await this.auditLogService.log(
        AuditAction.DOCUMENT_UPDATE,
        userId,
        documentId,
        {
          action: 'blockchain_update_failed',
          blockchainAction: action,
          hash: documentHash,
          error: error.message,
        },
      );

      throw new BadRequestException(
        `Failed to update document record on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Get the blockchain verification certificate for a document
   * @param documentId ID of the document
   */
  async getVerificationCertificate(documentId: string): Promise<{
    documentId: string;
    transactionId?: string;
    timestamp?: string;
    registeredBy?: string;
    documentHash?: string;
    blockHeight?: number;
    certificateId?: string;
    reason?: string;
  }> {
    if (!this.initialized) {
      throw new BadRequestException('Blockchain service not initialized');
    }

    if (this.isLocalMode) {
      // In local mode, simulate blockchain certificate
      const certificateId = crypto.randomBytes(16).toString('hex');

      return {
        documentId,
        transactionId: `tx_${crypto.randomBytes(8).toString('hex')}`,
        timestamp: new Date().toISOString(),
        registeredBy: 'local-system',
        documentHash: crypto.randomBytes(32).toString('hex'),
        blockHeight: Math.floor(Math.random() * 1000),
        certificateId,
      };
    }

    try {
      // Connect to the gateway
      const connectionProfile = JSON.parse(
        fs.readFileSync(this.config.connectionProfile, 'utf8'),
      );
      const gateway = new fabricClient.Gateway();

      await gateway.connect(connectionProfile, {
        wallet: this.wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true },
      });

      // Get the network and contract
      const network = await gateway.getNetwork(this.config.channelName);
      const contract = network.getContract(this.config.chaincodeName);

      // Query the certificate
      const result = await contract.evaluateTransaction(
        'GetDocumentCertificate',
        documentId,
      );

      if (!result || result.length === 0) {
        return {
          documentId,
          reason: 'Certificate not found',
        };
      }

      // Parse the certificate
      const certificate = JSON.parse(result.toString());

      // Disconnect from the gateway
      gateway.disconnect();

      return {
        documentId,
        ...certificate,
      };
    } catch (error) {
      this.logger.error(
        `Error getting verification certificate: ${error.message}`,
        error.stack,
      );

      return {
        documentId,
        reason: `Error retrieving certificate: ${error.message}`,
      };
    }
  }
}
