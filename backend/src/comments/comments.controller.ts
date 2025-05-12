// backend/src/comments/comments.controller.ts
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
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId')
  getDocumentComments(
    @Param('documentId') documentId: string,
    @Query('includeReplies') includeReplies: string,
    @Request() req,
  ) {
    this.logger.log(
      `Usuario ${req.user.id} solicitando comentarios del documento ${documentId}`,
    );
    // Convertir el parámetro de consulta a booleano
    const includeRepliesBoolean =
      includeReplies === 'true' || includeReplies === '1';
    return this.commentsService.getDocumentComments(
      documentId,
      req.user.id,
      includeRepliesBoolean,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    this.logger.log(`Usuario ${req.user.id} buscando comentario ${id}`);
    return this.commentsService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    this.logger.log(`Usuario ${req.user.id} actualizando comentario ${id}`);
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.commentsService.update(
      id,
      updateCommentDto,
      req.user.id,
      ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Request() req,
    @Headers() headers,
    @Ip() ip: string,
  ) {
    this.logger.log(`Usuario ${req.user.id} eliminando comentario ${id}`);
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.commentsService.remove(id, req.user.id, ip, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('replies/:commentId')
  getCommentReplies(@Param('commentId') commentId: string, @Request() req) {
    this.logger.log(
      `Usuario ${req.user.id} solicitando respuestas al comentario ${commentId}`,
    );
    return this.commentsService.getCommentReplies(commentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/:documentId/mark-read')
  markDocumentCommentsAsRead(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    this.logger.log(
      `Usuario ${req.user.id} marcando como leídos los comentarios del documento ${documentId}`,
    );
    return this.commentsService.markDocumentCommentsAsRead(
      documentId,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId/unread-count')
  countUnreadDocumentComments(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
    return this.commentsService.countUnreadDocumentComments(
      documentId,
      req.user.id,
    );
  }
}
