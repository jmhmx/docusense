import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Req,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { SharingService } from './sharing.service';
import {
  ShareDocumentDto,
  CreateShareLinkDto,
  AccessShareLinkDto,
  UpdatePermissionDto,
} from './dto/share.dto';
import { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Document } from '../documents/entities/document.entity';
import {
  DocumentPermission,
  PermissionLevel,
} from './entities/document-permission.entity';
import { ShareLink } from './entities/share-link.entity';

@Controller('sharing')
@UseGuards(AuthGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('share/:documentId')
  async shareDocumentWithUser(
    @Param('documentId') documentId: string,
    @Body() shareDocumentDto: ShareDocumentDto,
  ): Promise<void> {
    return this.sharingService.createShareDocument(
      documentId,
      shareDocumentDto,
    );
  }

  @Put('permissions/:id')
  async update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @Req() req: Request,
  ): Promise<DocumentPermission> {
    return this.sharingService.update(
      id,
      updatePermissionDto,
      req.user.id,
      id,
    );
  }

  @Post('access-link')
  async accessLink(
    @Body() accessShareLinkDto: AccessShareLinkDto,
  ): Promise<ShareLink> {
    return this.sharingService.accessLink(accessShareLinkDto);
  }

  @Get(':documentId/permissions')
  async getDocumentPermissions(
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<DocumentPermission[]> {
    return this.sharingService.findAllPermissionsByDocument(documentId);
  }

  @Put(':documentId/permissions')
  async updatePermission(
    @Param('documentId') documentId: string,
    @Req() req: Request,
    @Body('level') level: PermissionLevel,
  ): Promise<DocumentPermission> {
    return await this.sharingService.updatePermission(documentId, req.user.id, level);
  }
  @Delete(':documentId/permissions/:userId')
  async revokePermission(
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.sharingService.deletePermission(documentId, userId);
  }

  @Get('shared-with-me')
  async getSharedWithMeDocuments(@Req() req: Request): Promise<Document[]> {
    return null
  }

  @Put('disable-link/:shareLinkId')
  async deactivateShareLink(
    @Param('shareLinkId') shareLinkId: string,
  ): Promise<ShareLink> {
    return this.sharingService.disableLink(shareLinkId);
  }

  @Get('links/:documentId')
  async getDocumentShareLinks(
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<ShareLink[]> {
    return this.sharingService.findAllShareLinksByDocument(documentId);
  }

  @Get('shared-with-users')
  async getSharedWithUsers(@Req() req: Request): Promise<any[]> {
    return null
  }

  @Get('share-link/:token')
  async findShareLinkByToken(
    @Param('token') token: string,
  ): Promise<ShareLink> {
    const shareLink = await this.sharingService.findOneShareLinkByCode(token);
    return shareLink;
  }
  @Get('users/:documentId')
  async getDocumentUsers(
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<any> {
    return null
  }

  @Post('validate-access')
  async validateAccess(
    @Query('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<any> {
    return {
      canAccess: false,
    };
  }

  @Post('can-modify')
  async validateModify(
    @Query('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<any> {
    return {
      canAccess: false,
    };
  }

  @Post('can-comment')
  async validateComment(
    @Query('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<any> {
    return {
      canAccess: false,
    };
  }

  @Post('can-share/:documentId')
  async canUserShareDocument(
    @Param('documentId') documentId: string,
    @Body() shareDocumentDto: ShareDocumentDto,
    @Req() req: Request,
  ): Promise<void> {
      await this.sharingService.createShareDocument(documentId, shareDocumentDto);
  }

  @Get('permission/:documentId')
  async getPermission(
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<DocumentPermission> {
    const permission = await this.sharingService.getPermissionByDocumentIdAndUserId(
      documentId,
      req.user.id,
    );
    return permission;
  }
}