import { IsString, IsOptional, IsUrl, IsEnum, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsEnum(['url', 'pdf', 'text'])
  source_type: 'url' | 'pdf' | 'text';

  @IsOptional()
  @IsUrl()
  source_url?: string;

  @IsOptional()
  @IsString()
  extracted_text?: string;
}
