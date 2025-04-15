import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockchainService } from './blockchain.service';

@Controller('api/blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register/:documentId')
  async registerDocument(
    @Param('documentId') documentId: string,
    @Body() registerData: { hash: string; metadata: any },
    @Request() req,
  ) {
    if (!documentId || !registerData.hash) {
      throw new BadRequestException('Document ID and hash are required');
    }

    const result = await this.blockchainService.registerDocument(
      documentId,
      registerData.hash,
      registerData.metadata || {},
      req.user.id,
    );

    return {
      success: result,
      documentId,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify/:documentId')
  async verifyDocument(
    @Param('documentId') documentId: string,
    @Body() verifyData: { hash: string },
  ) {
    if (!documentId || !verifyData.hash) {
      throw new BadRequestException('Document ID and hash are required');
    }

    return await this.blockchainService.verifyDocument(
      documentId,
      verifyData.hash,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('update/:documentId')
  async updateDocumentRecord(
    @Param('documentId') documentId: string,
    @Body() updateData: { hash: string; action: string; metadata?: any },
    @Request() req,
  ) {
    if (!documentId || !updateData.hash || !updateData.action) {
      throw new BadRequestException(
        'Document ID, hash, and action are required',
      );
    }

    const result = await this.blockchainService.updateDocumentRecord(
      documentId,
      updateData.hash,
      updateData.action,
      req.user.id,
      updateData.metadata,
    );

    return {
      success: result,
      documentId,
      action: updateData.action,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('certificate/:documentId')
  async getVerificationCertificate(@Param('documentId') documentId: string) {
    if (!documentId) {
      throw new BadRequestException('Document ID is required');
    }

    return await this.blockchainService.getVerificationCertificate(documentId);
  }
}
