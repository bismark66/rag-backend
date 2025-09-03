import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { ConversationsModule } from 'src/resources/conversations/conversations.module';
import { ConversationsService } from 'src/resources/conversations/conversations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from 'src/db/entities/conversations.entity';
import { Message } from 'src/db/entities/message.entity';
import { ApiService } from 'src/common/utils/api.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConversationsModule,
    TypeOrmModule.forFeature([Conversation, Message]),
    HttpModule,
  ],
  providers: [RagService, ConversationsService, ApiService],
  exports: [RagService],
})
export class RagModule {}
