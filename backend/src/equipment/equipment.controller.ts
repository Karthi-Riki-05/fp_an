import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant, TenantContext } from '../common/decorators/tenant.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
@UseInterceptors(TenantInterceptor)
@UseGuards(PermissionsGuard)
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  list(@Tenant() tenant: TenantContext) {
    return this.equipment.list(tenant);
  }

  @Get(':id')
  findOne(@Tenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.equipment.findOne(tenant, id);
  }

  @Post()
  @Permissions('manage-equipment')
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateEquipmentDto) {
    return this.equipment.create(tenant, dto);
  }

  @Patch(':id')
  @Permissions('manage-equipment')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipment.update(tenant, id, dto);
  }

  @Delete(':id')
  @Permissions('manage-equipment')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.equipment.softDelete(tenant, id);
  }
}
