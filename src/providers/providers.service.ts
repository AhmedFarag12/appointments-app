import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import {
  ACTIVE_STATUSES,
  Appointment,
} from '../appointments/schemas/appointment.schema';
import {
  dayOfWeek,
  isValidDate,
  toDateTime,
  toMinutes,
  toTime,
} from '../common/time.util';
import { CreateProviderDto, WorkingHoursDto } from './dto/create-provider.dto';
import { QueryProvidersDto } from './dto/query-providers.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { Provider, ProviderDocument } from './schemas/provider.schema';

export interface Slot {
  startTime: string;
  endTime: string;
}

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<Appointment>,
  ) {}

  async findAll({ search, specialty, page, limit }: QueryProvidersDto) {
    const filter: Record<string, unknown> = { isActive: true };
    if (specialty) {
      filter.specialty = new RegExp(`^${escapeRegex(specialty)}$`, 'i');
    }
    if (search) filter.$text = { $search: search };

    const [items, total] = await Promise.all([
      this.providerModel
        .find(filter)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.providerModel.countDocuments(filter),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<ProviderDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Provider not found');
    const provider = await this.providerModel
      .findById(id)
      .populate('user', 'name email phone');
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  findByUser(userId: string) {
    return this.providerModel.findOne({ user: userId });
  }

  async create(userId: string, dto: CreateProviderDto) {
    if (await this.findByUser(userId)) {
      throw new ConflictException('You already have a provider profile');
    }
    if (dto.workingHours) validateWorkingHours(dto.workingHours);
    return this.providerModel.create({ ...definedOnly(dto), user: userId });
  }

  async update(id: string, userId: string, dto: UpdateProviderDto) {
    const provider = await this.findOne(id);
    if (provider.user._id.toString() !== userId) {
      throw new ForbiddenException(
        'You can only edit your own provider profile',
      );
    }
    if (dto.workingHours) validateWorkingHours(dto.workingHours);
    provider.set(definedOnly(dto));
    return provider.save();
  }

  async getAvailableSlots(id: string, date: string): Promise<Slot[]> {
    if (!isValidDate(date)) throw new BadRequestException('Invalid date');
    const provider = await this.findOne(id);
    if (!provider.isActive) return [];

    const booked = await this.appointmentModel
      .find({
        provider: provider._id,
        date,
        status: { $in: ACTIVE_STATUSES },
      })
      .select('startTime endTime')
      .lean();

    const now = Date.now();
    const duration = provider.slotDuration;
    const slots: Slot[] = [];
    const dayHours = provider.workingHours.filter(
      (h) => h.day === dayOfWeek(date),
    );

    for (const hours of dayHours) {
      const end = toMinutes(hours.end);
      for (let t = toMinutes(hours.start); t + duration <= end; t += duration) {
        const overlaps = booked.some(
          (b) =>
            toMinutes(b.startTime) < t + duration && toMinutes(b.endTime) > t,
        );
        const startTime = toTime(t);
        if (!overlaps && toDateTime(date, startTime).getTime() > now) {
          slots.push({ startTime, endTime: toTime(t + duration) });
        }
      }
    }
    return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
}

function validateWorkingHours(hours: WorkingHoursDto[]) {
  for (const h of hours) {
    if (toMinutes(h.start) >= toMinutes(h.end)) {
      throw new BadRequestException(
        `workingHours: start must be before end (day ${h.day})`,
      );
    }
  }
}

/** DTO class fields are initialized to undefined; drop them so they don't unset stored values. */
function definedOnly<T extends object>(dto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(dto).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
