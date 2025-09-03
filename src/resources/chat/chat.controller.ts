/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Fixed DTO with validation decorators
export class CreateConversationDto {
  @ApiProperty({
    description: 'Title of the conversation',
    required: false,
    example: 'About Esoko',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Title should not be empty if provided' })
  title?: string;

  @ApiProperty({
    description: 'ID of the user creating the conversation',
    required: false,
    example: '123',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'User ID should not be empty if provided' })
  userId?: string;
}

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Create a new conversation
  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  @ApiBody({ type: CreateConversationDto })
  async createConversation(@Body() dto: CreateConversationDto) {
    const conversationId = await this.chatService.createConversation(
      dto.userId,
      dto.title,
    );
    return {
      conversationId,
      message: 'Conversation created successfully',
    };
  }

  // ... rest of your controller methods remain the same
  // Get recent conversations
  @Get('conversations')
  @ApiOperation({ summary: 'Get recent conversations' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of results',
  })
  async getRecentConversations(
    @Query('userId') userId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getRecentConversations(userId, limit || 10);
  }

  // Get conversation stats
  @Get('conversations/:conversationId/stats')
  @ApiOperation({ summary: 'Get conversation statistics' })
  async getConversationStats(@Param('conversationId') conversationId: string) {
    return this.chatService.getConversationStats(conversationId);
  }

  // Delete a conversation
  @Delete('conversations/:conversationId')
  @ApiOperation({ summary: 'Delete a conversation' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Param('conversationId') conversationId: string) {
    await this.chatService.deleteConversation(conversationId);
  }

  // Clear conversation messages but keep the conversation
  @Delete('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Clear conversation messages' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearConversationHistory(
    @Param('conversationId') conversationId: string,
  ) {
    await this.chatService.clearConversationHistory(conversationId);
  }

  // Original ask question endpoint (now creates new conversation automatically)
  @Post('ask')
  @ApiOperation({ summary: 'Ask a question using RAG' })
  @ApiResponse({ status: 201, description: 'Question answered successfully' })
  @ApiBody({ type: AskQuestionDto })
  async askQuestion(@Body() askQuestionDto: AskQuestionDto) {
    console.log('---', askQuestionDto.question);
    return this.chatService.askQuestion(
      askQuestionDto.question,
      askQuestionDto.userId,
    );
  }

  // Original follow-up endpoint (unchanged)
  @Post('follow-up/:conversationId')
  @ApiOperation({
    summary: 'Ask a follow-up question in existing conversation',
  })
  @ApiBody({ type: AskQuestionDto })
  async askFollowUp(
    @Param('conversationId') conversationId: string,
    @Body() body: AskQuestionDto,
  ) {
    return this.chatService.askFollowUpQuestion(body.question, conversationId);
  }

  // Enhanced history endpoint with pagination
  @Get('history/:conversationId')
  @ApiOperation({ summary: 'Get conversation history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of messages',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Offset for pagination',
  })
  async getHistory(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.chatService.getConversationHistory(
      conversationId,
      limit,
      offset,
    );
  }
}
