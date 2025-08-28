import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
// import { ConversationsController } from './conversations.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from 'src/db/entities/conversations.entity';
import { Message } from 'src/db/entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  providers: [ConversationsService],
  exports: [ConversationsService], // Make sure to export the service
})
export class ConversationsModule {}
