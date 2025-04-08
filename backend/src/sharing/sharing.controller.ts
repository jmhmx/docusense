import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Request,
  Headers,
  Ip,
  BadRequestException,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SharingService } from './sharing.service';
import {
  ShareDocumentDto,
  CreateShareLinkDto,
  AccessShareLinkDto,
  UpdatePermissionDto,
} from './dto/share-document.dto';
import { DocumentPermission } from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';

@Controller('api/sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('document')
  async shareDocumentWithUser(
    @Body() shareDocumentDto: ShareDocumentDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.sharingService.shareDocumentWithUser(
      req.user.id,
      shareDocumentDto,
      ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('link')
  async createShareLink(
    @Body() createShareLinkDto: CreateShareLinkDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.sharingService.createShareLink(
      req.user.id,
      createShareLinkDto,
      ip,
      userAgent,
    );
  }

  @Post('link/access')
  async accessShareLink(
    @Body() accessShareLinkDto: AccessShareLinkDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = req.user?.id || null;
    return this.sharingService.accessShareLink(
      accessShareLinkDto,
      userId,
      ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/permissions')
  async getDocumentPermissions(
    @Param('documentId') documentId: string,
    @Request() req,
  ): Promise<DocumentPermission[]> {
    return this.sharingService.getDocumentPermissions(documentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('permissions/:permissionId')
  async updatePermission(
    @Param('permissionId') permissionId: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.sharingService.updatePermission(
      permissionId,
      updatePermissionDto,
      req.user.id,
      ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('permissions/:permissionId')
  async revokePermission(
    @Param('permissionId') permissionId: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    await this.sharingService.revokePermission(
      permissionId,
      req.user.id,
      ip,
      userAgent,
    );
    return { message: 'Permiso revocado exitosamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('shared-with-me')
  async getSharedWithMeDocuments(@Request() req) {
    return this.sharingService.getSharedWithMeDocuments(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('link/:linkId')
  async deactivateShareLink(
    @Param('linkId') linkId: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'] || 'Unknown';
    await this.sharingService.deactivateShareLink(
      linkId,
      req.user.id,
      ip,
      userAgent,
    );
    return { message: 'Enlace de compartición desactivado exitosamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/links')
  async getDocumentShareLinks(
    @Param('documentId') documentId: string,
    @Request() req,
  ): Promise<ShareLink[]> {
    return this.sharingService.getDocumentShareLinks(documentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('shared-users')
  async getSharedWithUsers(@Request() req) {
    return this.sharingService.getSharedWithUsers(req.user.id);
  }

  @Get('link/info/:token')
  async getShareLinkInfo(@Param('token') token: string) {
    try {
      const shareLink = await this.sharingService.findShareLinkByToken(token);
      return {
        isValid: true,
        requiresPassword: shareLink.requiresPassword,
        documentTitle: shareLink.document?.title || 'Documento compartido',
        permissionLevel: shareLink.permissionLevel,
        expiresAt: shareLink.expiresAt,
      };
    } catch (error) {
      return {
        isValid: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/users')
  async getDocumentUsers(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    return this.sharingService.getDocumentUsers(documentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/check-permission')
  async checkDocumentPermission(
    @Param('documentId') documentId: string,
    @Query('action') action: string,
    @Request() req,
  ) {
    const userId = req.user.id;

    switch (action) {
      case 'view':
        return {
          canAccess: await this.sharingService.canUserAccessDocument(
            userId,
            documentId,
          ),
        };
      case 'edit':
        return {
          canAccess: await this.sharingService.canUserModifyDocument(
            userId,
            documentId,
          ),
        };
      case 'comment':
        return {
          canAccess: await this.sharingService.canUserCommentDocument(
            userId,
            documentId,
          ),
        };
      case 'share':
        return {
          canAccess: await this.sharingService.canUserShareDocument(
            userId,
            documentId,
          ),
        };
      default:
        throw new BadRequestException('Acción no válida');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/my-permission')
  async getMyDocumentPermission(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    const permission = await this.sharingService.getUserPermissionForDocument(
      req.user.id,
      documentId,
    );

    if (!permission) {
      throw new UnauthorizedException('No tiene acceso a este documento');
    }

    return {
      permissionLevel: permission.permissionLevel,
      isActive: permission.isActive,
      expiresAt: permission.expiresAt,
    };
  }
}
