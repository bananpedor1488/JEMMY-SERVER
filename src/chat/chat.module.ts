import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSettingsService } from './chat-settings.service';
import { Chat, ChatSchema } from '../schemas/chat.schema';
import { ChatSettings, ChatSettingsSchema } from '../schemas/chat-settings.schema';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: ChatSettings.name, schema: ChatSettingsSchema },
    ]),
    MessageModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatSettingsService],
  exports: [ChatService, ChatSettingsService],
})
export class ChatModule {}
