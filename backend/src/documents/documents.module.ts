import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Document } from './entities/document.entity';
import { DocumentProcessorService } from './processors/document-processor.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), ScheduleModule.forRoot()],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessorService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
