import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Identity' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ default: false })
  is_group: boolean;

  @Prop()
  group_name?: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
