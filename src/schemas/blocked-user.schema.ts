import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class BlockedUser extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Identity', required: true })
  blocker_identity_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Identity', required: true })
  blocked_identity_id: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  blocked_at: Date;
}

export const BlockedUserSchema = SchemaFactory.createForClass(BlockedUser);

// Индексы для быстрого поиска
BlockedUserSchema.index({ blocker_identity_id: 1, blocked_identity_id: 1 }, { unique: true });
BlockedUserSchema.index({ blocker_identity_id: 1 });
BlockedUserSchema.index({ blocked_identity_id: 1 });
