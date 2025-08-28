import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AskQuestionDto {
  @ApiProperty({
    description: 'Question to ask the RAG system',
    example: 'What is Subgoal and decomposition?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    description: 'Optional user ID for tracking',
    example: 'user-123',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
