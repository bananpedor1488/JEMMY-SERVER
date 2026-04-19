import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'z7' })
export class UItem extends Document {
  @Prop({ required: true })
  uid: string;

  @Prop({ required: true })
  b: string;

  @Prop({ required: true })
  c: string;

  @Prop({ required: true })
  e: number;

  @Prop({ required: true })
  n: string;

  @Prop({ required: true })
  o: string;
}

export const UItemSchema = SchemaFactory.createForClass(UItem);

UItemSchema.index({ uid: 1, createdAt: -1 });
UItemSchema.index({ n: 1 });
