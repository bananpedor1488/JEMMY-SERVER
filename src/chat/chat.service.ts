import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat } from '../schemas/chat.schema';
import { ChatSettingsService } from './chat-settings.service';
import { MessageService } from '../message/message.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    private chatSettingsService: ChatSettingsService,
    private messageService: MessageService,
  ) {}

  async createChat(identity_ids: string[], is_group = false) {
    const chat = new this.chatModel({
      participants: identity_ids.map(id => new Types.ObjectId(id)),
      is_group,
    });
    return chat.save();
  }

  async getUserChats(identity_id: string) {
    const chats = await this.chatModel.find({
      participants: new Types.ObjectId(identity_id),
    }).populate('participants');

    // Получаем настройки для всех чатов
    const settings = await this.chatSettingsService.getAllUserSettings(identity_id);
    const settingsMap = new Map(settings.map(s => [s.chat_id.toString(), s]));

    // Добавляем настройки к каждому чату
    return chats.map(chat => {
      const chatSettings = settingsMap.get(chat._id.toString());
      return {
        ...chat.toObject(),
        is_pinned: chatSettings?.is_pinned || false,
        is_muted: chatSettings?.is_muted || false,
        unread_count: chatSettings?.unread_count || 0,
      };
    });
  }

  async deleteChat(chat_id: string) {
    // Удаляем все сообщения чата
    await this.messageService.deleteMessagesByChat(chat_id);
    
    // Удаляем все настройки чата
    await this.chatSettingsService.deleteSettingsByChat(chat_id);
    
    // Удаляем сам чат
    return this.chatModel.findByIdAndDelete(chat_id);
  }
}
