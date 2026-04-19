import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'x9' })
export class UData extends Document {
  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true, default: 0 })
  p: number;

  @Prop({ default: 0 })
  q: number;

  @Prop({ default: 'JEM' })
  r: string;
}

export const UDataSchema = SchemaFactory.createForClass(UData);

UDataSchema.index({ uid: 1 });
