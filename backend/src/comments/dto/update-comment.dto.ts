import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;
}
