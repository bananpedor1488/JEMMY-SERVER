import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatSettings } from '../schemas/chat-settings.schema';

@Injectable()
export class ChatSettingsService {
  constructor(
    @InjectModel(ChatSettings.name) private chatSettingsModel: Model<ChatSettings>,
  ) {}

  async getOrCreateSettings(chat_id: string, identity_id: string) {
    let settings = await this.chatSettingsModel.findOne({
      chat_id: new Types.ObjectId(chat_id),
      identity_id: new Types.ObjectId(identity_id),
    });

    if (!settings) {
      settings = new this.chatSettingsModel({
        chat_id: new Types.ObjectId(chat_id),
        identity_id: new Types.ObjectId(identity_id),
      });
      await settings.save();
    }

    return settings;
  }

  async togglePin(chat_id: string, identity_id: string) {
    const settings = await this.getOrCreateSettings(chat_id, identity_id);
    settings.is_pinned = !settings.is_pinned;
    return settings.save();
  }

  async toggleMute(chat_id: string, identity_id: string) {
    const settings = await this.getOrCreateSettings(chat_id, identity_id);
    settings.is_muted = !settings.is_muted;
    return settings.save();
  }

  async incrementUnread(chat_id: string, identity_id: string) {
    const settings = await this.getOrCreateSettings(chat_id, identity_id);
    settings.unread_count += 1;
    return settings.save();
  }

  async markAsRead(chat_id: string, identity_id: string) {
    const settings = await this.getOrCreateSettings(chat_id, identity_id);
    settings.unread_count = 0;
    settings.last_read_at = new Date();
    return settings.save();
  }

  async getSettings(chat_id: string, identity_id: string) {
    return this.getOrCreateSettings(chat_id, identity_id);
  }

  async getAllUserSettings(identity_id: string) {
    return this.chatSettingsModel.find({
      identity_id: new Types.ObjectId(identity_id),
    });
  }

  async deleteSettingsByChat(chat_id: string) {
    return this.chatSettingsModel.deleteMany({
      chat_id: new Types.ObjectId(chat_id),
    });
  }
}
