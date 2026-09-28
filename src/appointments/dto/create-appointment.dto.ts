import {
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_REGEX, TIME_REGEX } from '../../common/time.util';

export class CreateAppointmentDto {
  @IsMongoId()
  providerId: string;

  @Matches(DATE_REGEX, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @Matches(TIME_REGEX, { message: 'startTime must be HH:mm' })
  startTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
