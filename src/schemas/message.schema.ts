import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chat_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Identity', required: true })
  sender_identity_id: Types.ObjectId;

  @Prop({ required: true })
  encrypted_content: string;

  @Prop({ default: 'text' })
  type: 'text' | 'image' | 'voice';
}

export const MessageSchema = SchemaFactory.createForClass(Message);
