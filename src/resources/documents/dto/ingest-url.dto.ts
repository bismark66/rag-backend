import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IngestUrlDto {
  @ApiProperty({ 
    description: 'URL to scrape and ingest', 
    example: 'https://lilianweng.github.io/posts/2023-06-23-agent/' 
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ 
    description: 'CSS selector for content extraction', 
    example: 'p',
    required: false 
  })
  @IsString()
  @IsOptional()
  selector?: string = 'p';
}