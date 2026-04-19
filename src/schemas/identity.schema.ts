import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Identity extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  avatar_seed: string;

  @Prop({ required: true })
  public_key: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ type: Date, default: null })
  expires_at: Date | null;

  @Prop({ default: false })
  is_online: boolean;

  @Prop({ type: Date, default: null })
  last_seen: Date | null;

  @Prop({ default: '' })
  bio: string;

  @Prop({ type: Object, default: () => ({
    who_can_message: 'everyone',
    who_can_see_profile: 'everyone',
    who_can_see_online: 'everyone',
    who_can_see_last_seen: 'everyone',
    auto_delete_messages: 0,
  })})
  privacy_settings: {
    who_can_message: 'everyone' | 'contacts' | 'nobody';
    who_can_see_profile: 'everyone' | 'contacts' | 'nobody';
    who_can_see_online: 'everyone' | 'contacts' | 'nobody';
    who_can_see_last_seen: 'everyone' | 'contacts' | 'nobody';
    auto_delete_messages: number; // hours: 0, 24, 168, 720
  };
}

export const IdentitySchema = SchemaFactory.createForClass(Identity);
