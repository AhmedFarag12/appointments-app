import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ProvidersService } from '../providers/providers.service';
import { Role } from '../users/schemas/user.schema';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import {
  ACTIVE_STATUSES,
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from './schemas/appointment.schema';

const POPULATE = [
  { path: 'customer', select: 'name email phone' },
  { path: 'provider', select: 'businessName specialty phone address user' },
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<Appointment>,
    private readonly providers: ProvidersService,
  ) {}

  async create(user: AuthUser, dto: CreateAppointmentDto) {
    const provider = await this.providers.findOne(dto.providerId);
    if (!provider.isActive) {
      throw new BadRequestException('Provider is not accepting bookings');
    }

    const slots = await this.providers.getAvailableSlots(
      dto.providerId,
      dto.date,
    );
    const slot = slots.find((s) => s.startTime === dto.startTime);
    if (!slot) {
      throw new ConflictException('This slot is not available');
    }

    try {
      const appointment = await this.appointmentModel.create({
        customer: user.userId,
        provider: provider._id,
        date: dto.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        notes: dto.notes,
      });
      return appointment.populate(POPULATE);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException('This slot was just booked');
      }
      throw err;
    }
  }

  async findAll(user: AuthUser, query: QueryAppointmentsDto) {
    const filter: Record<string, unknown> = await this.ownershipFilter(user);
    if (query.status) filter.status = query.status;
    if (query.date) filter.date = query.date;

    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.appointmentModel
        .find(filter)
        .populate(POPULATE)
        .sort({ date: -1, startTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.appointmentModel.countDocuments(filter),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(user: AuthUser, id: string) {
    const appointment = await this.findOwned(user, id);
    return appointment.populate(POPULATE);
  }

  async confirm(user: AuthUser, id: string) {
    const appointment = await this.findOwned(user, id);
    this.assertStatus(appointment, [AppointmentStatus.Pending], 'confirm');
    appointment.status = AppointmentStatus.Confirmed;
    await appointment.save();
    return appointment.populate(POPULATE);
  }

  async cancel(user: AuthUser, id: string, dto: CancelAppointmentDto) {
    const appointment = await this.findOwned(user, id);
    this.assertStatus(appointment, ACTIVE_STATUSES, 'cancel');
    appointment.status = AppointmentStatus.Cancelled;
    appointment.cancelledBy = user.role;
    appointment.cancellationReason = dto.reason;
    await appointment.save();
    return appointment.populate(POPULATE);
  }

  async complete(user: AuthUser, id: string) {
    const appointment = await this.findOwned(user, id);
    this.assertStatus(appointment, [AppointmentStatus.Confirmed], 'complete');
    appointment.status = AppointmentStatus.Completed;
    await appointment.save();
    return appointment.populate(POPULATE);
  }

  /** Customers see their bookings; providers see bookings made with them. */
  private async ownershipFilter(user: AuthUser) {
    if (user.role === Role.Customer) {
      return { customer: new Types.ObjectId(user.userId) };
    }
    const provider = await this.providers.findByUser(user.userId);
    if (!provider) {
      throw new ForbiddenException('Create your provider profile first');
    }
    return { provider: provider._id };
  }

  private async findOwned(
    user: AuthUser,
    id: string,
  ): Promise<AppointmentDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Appointment not found');
    }
    const appointment = await this.appointmentModel.findOne({
      _id: id,
      ...(await this.ownershipFilter(user)),
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private assertStatus(
    appointment: AppointmentDocument,
    allowed: AppointmentStatus[],
    action: string,
  ) {
    if (!allowed.includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot ${action} an appointment that is ${appointment.status}`,
      );
    }
  }
}
