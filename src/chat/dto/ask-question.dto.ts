import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskQuestionDto {
  @ApiProperty({ 
    description: 'Question to ask the RAG system', 
    example: 'What is Subgoal and decomposition?' 
  })
  @IsString()
  @IsNotEmpty()
  question: string;
}