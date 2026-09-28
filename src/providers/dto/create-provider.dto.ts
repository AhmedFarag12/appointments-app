import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TIME_REGEX } from '../../common/time.util';

export class WorkingHoursDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @Matches(TIME_REGEX, { message: 'start must be HH:mm' })
  start: string;

  @Matches(TIME_REGEX, { message: 'end must be HH:mm' })
  end: string;
}

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  businessName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialty: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  slotDuration?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDto)
  workingHours?: WorkingHoursDto[];
}
