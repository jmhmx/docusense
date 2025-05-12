import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Headers,
  Ip,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('api/comments')
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      this.logger.log(
        `Usuario ${req.user.id} creando comentario para documento ${createCommentDto.documentId}`,
      );
      const userAgent = headers['user-agent'] || 'Unknown';
      return this.commentsService.create(
        createCommentDto,
        req.user.id,
        ip,
        userAgent,
      );
    } catch (error) {
      this.logger.error(`Error en create: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Error al crear comentario: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId')
  async getDocumentComments(
    @Param('documentId') documentId: string,
    @Query('includeReplies') includeReplies: string,
    @Request() req,
  ) {
    try {
      this.logger.log(
        `Usuario ${req.user.id} solicitando comentarios del documento ${documentId}`,
      );
      // Convertir el parámetro de consulta a booleano
      const includeRepliesBoolean =
        includeReplies === 'true' || includeReplies === '1';
      return await this.commentsService.getDocumentComments(
        documentId,
        req.user.id,
        includeRepliesBoolean,
      );
    } catch (error) {
      this.logger.error(
        `Error en getDocumentComments: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al obtener comentarios: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Usuario ${req.user.id} buscando comentario ${id}`);
      return await this.commentsService.findOne(id, req.user.id);
    } catch (error) {
      this.logger.error(`Error en findOne: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Error al obtener comentario: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      this.logger.log(`Usuario ${req.user.id} actualizando comentario ${id}`);
      const userAgent = headers['user-agent'] || 'Unknown';
      return await this.commentsService.update(
        id,
        updateCommentDto,
        req.user.id,
        ip,
        userAgent,
      );
    } catch (error) {
      this.logger.error(`Error en update: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Error al actualizar comentario: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    try {
      this.logger.log(`Usuario ${req.user.id} eliminando comentario ${id}`);
      const userAgent = headers['user-agent'] || 'Unknown';
      return await this.commentsService.remove(id, req.user.id, ip, userAgent);
    } catch (error) {
      this.logger.error(`Error en remove: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Error al eliminar comentario: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('replies/:commentId')
  async getCommentReplies(
    @Param('commentId') commentId: string,
    @Request() req,
  ) {
    try {
      this.logger.log(
        `Usuario ${req.user.id} solicitando respuestas al comentario ${commentId}`,
      );
      return await this.commentsService.getCommentReplies(
        commentId,
        req.user.id,
      );
    } catch (error) {
      this.logger.error(
        `Error en getCommentReplies: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al obtener respuestas: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/:documentId/mark-read')
  async markDocumentCommentsAsRead(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    try {
      this.logger.log(
        `Usuario ${req.user.id} marcando como leídos los comentarios del documento ${documentId}`,
      );
      return await this.commentsService.markDocumentCommentsAsRead(
        documentId,
        req.user.id,
      );
    } catch (error) {
      this.logger.error(
        `Error en markDocumentCommentsAsRead: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al marcar comentarios como leídos: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/unread-count')
  async countUnreadDocumentComments(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    try {
      return await this.commentsService.countUnreadDocumentComments(
        documentId,
        req.user.id,
      );
    } catch (error) {
      this.logger.error(
        `Error en countUnreadDocumentComments: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al contar comentarios no leídos: ${error.message}`,
      );
    }
  }
}
