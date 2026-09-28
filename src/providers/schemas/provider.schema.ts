import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

@Schema({ _id: false })
export class WorkingHours {
  /** 0 = Sunday ... 6 = Saturday */
  @Prop({ required: true, min: 0, max: 6 })
  day: number;

  /** HH:mm */
  @Prop({ required: true })
  start: string;

  /** HH:mm */
  @Prop({ required: true })
  end: string;
}
const WorkingHoursSchema = SchemaFactory.createForClass(WorkingHours);

@Schema({ timestamps: true, toJSON: { versionKey: false } })
export class Provider {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    unique: true,
  })
  user: Types.ObjectId;

  @Prop({ required: true, trim: true })
  businessName: string;

  @Prop({ required: true, trim: true, index: true })
  specialty: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  /** Length of each bookable slot, in minutes */
  @Prop({ default: 30, min: 5, max: 480 })
  slotDuration: number;

  @Prop({ type: [WorkingHoursSchema], default: [] })
  workingHours: WorkingHours[];

  @Prop({ default: true })
  isActive: boolean;
}

export type ProviderDocument = HydratedDocument<Provider>;
export const ProviderSchema = SchemaFactory.createForClass(Provider);
ProviderSchema.index({
  businessName: 'text',
  specialty: 'text',
  description: 'text',
});
