import { Controller, Post, Get, Delete, Body, Param, Patch } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatSettingsService } from './chat-settings.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatSettingsService: ChatSettingsService,
  ) {}

  @Post('create')
  async createChat(@Body() body: { identity_ids: string[]; is_group?: boolean }) {
    return this.chatService.createChat(body.identity_ids, body.is_group);
  }

  @Get('user/:identity_id')
  async getUserChats(@Param('identity_id') identity_id: string) {
    return this.chatService.getUserChats(identity_id);
  }

  @Delete(':chat_id')
  async deleteChat(@Param('chat_id') chat_id: string) {
    await this.chatService.deleteChat(chat_id);
    return { success: true };
  }

  @Patch(':chat_id/pin')
  async togglePin(
    @Param('chat_id') chat_id: string,
    @Body() body: { identity_id: string },
  ) {
    const settings = await this.chatSettingsService.togglePin(chat_id, body.identity_id);
    return { is_pinned: settings.is_pinned };
  }

  @Patch(':chat_id/mute')
  async toggleMute(
    @Param('chat_id') chat_id: string,
    @Body() body: { identity_id: string },
  ) {
    const settings = await this.chatSettingsService.toggleMute(chat_id, body.identity_id);
    return { is_muted: settings.is_muted };
  }

  @Patch(':chat_id/read')
  async markAsRead(
    @Param('chat_id') chat_id: string,
    @Body() body: { identity_id: string },
  ) {
    await this.chatSettingsService.markAsRead(chat_id, body.identity_id);
    return { success: true };
  }
}
