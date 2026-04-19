import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessageModule } from '../message/message.module';
import { ChatModule } from '../chat/chat.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [MessageModule, ChatModule, IdentityModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class WebsocketModule {}
