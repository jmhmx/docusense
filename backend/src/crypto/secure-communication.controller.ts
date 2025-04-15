import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SecureCommunicationService } from './secure-communication.service';
import { AuditLogService, AuditAction } from '../audit/audit-log.service';

/**
 * DTOs for secure communication
 */
class SecureMessageDto {
  encryptedData: string;
  sessionId: string;
}

class ChallengeResponseDto {
  challenge: string;
  response: string;
}

class InitiateSecureSessionDto {
  userId: string;
}

@Controller('api/secure-comms')
export class SecureCommunicationController {
  constructor(
    private readonly secureCommunicationService: SecureCommunicationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get server's public key for client-side encryption
   */
  @Get('server-key')
  getServerPublicKey() {
    return this.secureCommunicationService.getServerPublicKey();
  }

  /**
   * Initiate a secure session for encrypted communication
   */
  @UseGuards(JwtAuthGuard)
  @Post('session/initiate')
  @HttpCode(HttpStatus.OK)
  async initiateSecureSession(
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    try {
      const handshake =
        await this.secureCommunicationService.performSecureHandshake(
          req.user.id,
        );

      // Log session initiation
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'secure_session_init',
          sessionId: handshake.sessionId,
        },
        ip,
        userAgent,
      );

      return handshake;
    } catch (error) {
      // Log failed attempt
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'secure_session_init_failed',
          error: error.message,
        },
        ip,
        userAgent,
      );

      throw error;
    }
  }

  /**
   * Process an encrypted message from a client
   */
  @UseGuards(JwtAuthGuard)
  @Post('message/receive')
  @HttpCode(HttpStatus.OK)
  async receiveSecureMessage(
    @Body() messageDto: SecureMessageDto,
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    try {
      // Decrypt the message
      const decryptedContent =
        await this.secureCommunicationService.decryptFromClient(
          messageDto.encryptedData,
          req.user.id,
        );

      // Log receipt of secure message
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'secure_message_received',
          sessionId: messageDto.sessionId,
        },
        ip,
        userAgent,
      );

      // Process the decrypted message
      let response;
      try {
        // Try to parse as JSON
        const messageObj = JSON.parse(decryptedContent);

        // Here you would process the message based on its content
        // This is a placeholder for actual business logic
        response = {
          status: 'success',
          message: 'Message received and processed',
          timestamp: new Date().toISOString(),
          messageType: typeof messageObj === 'object' ? 'json' : 'text',
        };
      } catch (error) {
        // Not JSON, treat as plain text
        response = {
          status: 'success',
          message: 'Text message received',
          timestamp: new Date().toISOString(),
          messageType: 'text',
        };
      }

      // Encrypt the response
      const encryptedResponse =
        await this.secureCommunicationService.encryptForUser(
          req.user.id,
          response,
        );

      return encryptedResponse;
    } catch (error) {
      // Log error
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'secure_message_error',
          error: error.message,
          sessionId: messageDto.sessionId,
        },
        ip,
        userAgent,
      );

      // Don't expose internal error details in response
      throw new BadRequestException('Failed to process secure message');
    }
  }

  /**
   * Send an encrypted message to a specific user
   * Admin only endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Post('message/send/:userId')
  @HttpCode(HttpStatus.OK)
  async sendSecureMessage(
    @Param('userId') targetUserId: string,
    @Body() messageData: { content: string | object },
    @Request() req,
    @Ip() ip: string,
    @Headers() headers,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';

    // Only admins can send messages to other users
    if (!req.user.isAdmin) {
      throw new ForbiddenException(
        'Only administrators can send secure messages to users',
      );
    }

    try {
      // Encrypt the message for the target user
      const encryptedMessage =
        await this.secureCommunicationService.encryptForUser(
          targetUserId,
          messageData.content,
        );

      // Log message send
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        targetUserId,
        {
          action: 'secure_message_sent',
          sessionId: encryptedMessage.sessionId,
        },
        ip,
        userAgent,
      );

      return {
        status: 'success',
        encryptedMessage,
      };
    } catch (error) {
      // Log error
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        targetUserId,
        {
          action: 'secure_message_send_error',
          error: error.message,
        },
        ip,
        userAgent,
      );

      throw error;
    }
  }

  /**
   * Verify a client's response to an authentication challenge
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify-challenge')
  @HttpCode(HttpStatus.OK)
  async verifyAuthChallenge(
    @Body() challengeResponseDto: ChallengeResponseDto,
    @Request() req,
    @Ip() ip: string,
  ) {
    try {
      const isValid =
        await this.secureCommunicationService.verifyAuthChallengeResponse(
          req.user.id,
          challengeResponseDto.challenge,
          challengeResponseDto.response,
        );

      // Log challenge verification
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'auth_challenge_verify',
          result: isValid ? 'success' : 'failed',
        },
        ip,
      );

      return {
        verified: isValid,
        timestamp: Date.now(),
      };
    } catch (error) {
      // Log error
      await this.auditLogService.log(
        AuditAction.USER_UPDATE,
        req.user.id,
        null,
        {
          action: 'auth_challenge_verify_error',
          error: error.message,
        },
        ip,
      );

      throw error;
    }
  }
}
