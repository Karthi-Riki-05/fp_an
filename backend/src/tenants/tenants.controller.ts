import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('admin / tenants')
@ApiCookieAuth('access_token')
@ApiBearerAuth('bearer')
@Controller('admin/tenants')
@UseGuards(PermissionsGuard)
@Permissions('manage-tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenants.' })
  list() {
    return this.tenants.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Create a tenant + provision its tenant_<id> Postgres schema.',
    description:
      'Clones tenant_template into the new schema. Idempotent on the schema side.',
  })
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }
}
