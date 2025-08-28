import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RagModule } from './rag/rag.module';
import { DocumentsModule } from './documents/documents.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './resources/conversations/conversations.module';
import { TypeOrmModule } from '@nestjs/typeorm';

const ormsettings = require('../ormconfig');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(ormsettings),
    RagModule,
    DocumentsModule,
    ChatModule,
    ConversationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
