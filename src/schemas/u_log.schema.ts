import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'y4' })
export class ULog extends Document {
  @Prop({ required: true })
  k: string;

  @Prop()
  f: string;

  @Prop()
  g: string;

  @Prop({ required: true })
  h: number;

  @Prop({ required: true })
  j: string;

  @Prop({ type: Object })
  z: Record<string, any>;

  @Prop()
  w: Date;
}

export const ULogSchema = SchemaFactory.createForClass(ULog);

ULogSchema.index({ f: 1, createdAt: -1 });
ULogSchema.index({ g: 1, createdAt: -1 });
ULogSchema.index({ j: 1 });
