import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../schemas/message.schema';
import { Chat } from '../schemas/chat.schema';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
  ) {}

  async createMessage(chat_id: string, sender_identity_id: string, encrypted_content: string, type = 'text') {
    const message = new this.messageModel({
      chat_id,
      sender_identity_id,
      encrypted_content,
      type,
    });
    return message.save();
  }

  async getMessages(chat_id: string, limit = 50) {
    return this.messageModel
      .find({ chat_id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender_identity_id');
  }

  async deleteMessagesByChat(chat_id: string) {
    return this.messageModel.deleteMany({ chat_id });
  }

  async getChat(chat_id: string) {
    return this.chatModel.findById(chat_id);
  }
}
