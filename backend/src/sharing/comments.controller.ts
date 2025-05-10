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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentFilterDto,
} from './dto/comment.dto';

@Controller('api/comments-sharing')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createCommentDto: CreateCommentDto, @Request() req) {
    // Crear el comentario
    return this.commentsService.create(createCommentDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() filters: CommentFilterDto, @Request() req) {
    return this.commentsService.findAll(filters, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
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
    const userAgent = headers['user-agent'] || 'Unknown';
    return this.commentsService.remove(id, req.user.id, ip, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/:documentId')
  getDocumentComments(
    @Param('documentId') documentId: string,
    @Query('includeReplies') includeReplies: boolean,
    @Request() req,
  ) {
    return this.commentsService.getDocumentComments(
      documentId,
      req.user.id,
      includeReplies,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('replies/:commentId')
  getCommentReplies(@Param('commentId') commentId: string, @Request() req) {
    return this.commentsService.getCommentReplies(commentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/:documentId/mark-read')
  markDocumentCommentsAsRead(
    @Param('documentId') documentId: string,
    @Request() req,
  ) {
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
