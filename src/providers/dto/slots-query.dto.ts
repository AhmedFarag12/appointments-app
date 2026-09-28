import { Matches } from 'class-validator';
import { DATE_REGEX } from '../../common/time.util';

export class SlotsQueryDto {
  @Matches(DATE_REGEX, { message: 'date must be YYYY-MM-DD' })
  date: string;
}
