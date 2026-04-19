import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatSettings extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chat_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Identity', required: true })
  identity_id: Types.ObjectId;

  @Prop({ default: false })
  is_pinned: boolean;

  @Prop({ default: false })
  is_muted: boolean;

  @Prop({ default: 0 })
  unread_count: number;

  @Prop({ type: Date })
  last_read_at?: Date;
}

export const ChatSettingsSchema = SchemaFactory.createForClass(ChatSettings);

// Индекс для быстрого поиска настроек по чату и пользователю
ChatSettingsSchema.index({ chat_id: 1, identity_id: 1 }, { unique: true });
