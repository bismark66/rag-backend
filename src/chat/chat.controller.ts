import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AskQuestionDto } from './dto/ask-question.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask a question using RAG' })
  @ApiResponse({ status: 201, description: 'Question answered successfully' })
  @ApiBody({ type: AskQuestionDto })
  async askQuestion(@Body() askQuestionDto: AskQuestionDto) {
    console.log('---', askQuestionDto.question);
    return this.chatService.askQuestion(askQuestionDto.question);
  }
}