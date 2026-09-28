import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Role, User } from '../../users/schemas/user.schema';

export enum AppointmentStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Cancelled = 'cancelled',
  Completed = 'completed',
}

/** Statuses that occupy a slot */
export const ACTIVE_STATUSES = [
  AppointmentStatus.Pending,
  AppointmentStatus.Confirmed,
];

@Schema({ timestamps: true, toJSON: { versionKey: false } })
export class Appointment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  customer: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Provider',
    required: true,
    index: true,
  })
  provider: Types.ObjectId;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  date: string;

  /** HH:mm */
  @Prop({ required: true })
  startTime: string;

  /** HH:mm */
  @Prop({ required: true })
  endTime: string;

  @Prop({
    type: String,
    enum: AppointmentStatus,
    default: AppointmentStatus.Pending,
  })
  status: AppointmentStatus;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: Role })
  cancelledBy?: Role;

  @Prop({ trim: true })
  cancellationReason?: string;
}

export type AppointmentDocument = HydratedDocument<Appointment>;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

// Prevents double booking of the same slot at the database level
AppointmentSchema.index(
  { provider: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
  },
);
