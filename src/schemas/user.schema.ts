import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  device_id: string;

  @Prop({ type: Types.ObjectId, ref: 'Identity' })
  current_identity_id: Types.ObjectId;

  @Prop({ default: false })
  ephemeral_identity_enabled: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
