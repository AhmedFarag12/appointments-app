import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { CreateProviderDto } from './dto/create-provider.dto';
import { QueryProvidersDto } from './dto/query-providers.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ProvidersService } from './providers.service';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryProvidersDto) {
    return this.providersService.findAll(query);
  }

  @Roles(Role.Provider)
  @Get('me')
  async mine(@CurrentUser() user: AuthUser) {
    const provider = await this.providersService.findByUser(user.userId);
    if (!provider) throw new NotFoundException('No provider profile yet');
    return provider;
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.providersService.findOne(id);
  }

  @Public()
  @Get(':id/slots')
  async slots(@Param('id') id: string, @Query() { date }: SlotsQueryDto) {
    const slots = await this.providersService.getAvailableSlots(id, date);
    return { providerId: id, date, slots };
  }

  @Roles(Role.Provider)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderDto) {
    return this.providersService.create(user.userId, dto);
  }

  @Roles(Role.Provider)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.providersService.update(id, user.userId, dto);
  }
}
