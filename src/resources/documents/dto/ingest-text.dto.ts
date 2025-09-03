import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IngestTextDto {
  @ApiProperty({ 
    description: 'Array of text documents to ingest', 
    example: ['This is the first document.', 'This is the second document.'],
    type: [String]
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  texts: string[];
}