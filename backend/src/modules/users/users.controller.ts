import { Controller, Get, Patch, Param, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(user => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department_code: user.department_code,
      department_name: user.department_name,
      is_active: user.is_active,
      created_at: user.created_at,
    }));
  }

  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: string) {
    if (!role) {
      throw new UnauthorizedException('Role must be provided');
    }
    const updated = await this.usersService.updateRole(id, role);
    return { success: true, user: updated };
  }
}
