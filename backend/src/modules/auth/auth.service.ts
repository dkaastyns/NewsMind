import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterFirstUserDto } from './dto/register-first-user.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email atau password salah');
    }

    await this.usersService.updateLastLogin(user.id);

    return {
      access_token: await this.signAccessToken(user.id, user.email, user.role, user.full_name),
      token_type: 'Bearer',
      user: this.toPublicUser(user),
    };
  }

  async registerFirstUser(dto: RegisterFirstUserDto) {
    const existingCount = await this.usersService.countUsers();
    if (existingCount > 0) {
      throw new ConflictException('User pertama hanya bisa dibuat saat database masih kosong');
    }

    const roleCode = dto.role_code ?? 'superadmin';
    const departmentCode = dto.department_code ?? 'humas';

    await this.usersService.ensureRole(roleCode, roleCode.replace(/_/g, ' '));
    await this.usersService.ensureDepartment(departmentCode, departmentCode.replace(/_/g, ' '));

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      fullName: dto.full_name,
      email: dto.email,
      passwordHash,
      phoneNumber: dto.phone_number,
      role: roleCode, // using role field now
      departmentCode,
    });

    return {
      access_token: await this.signAccessToken(user.id, user.email, user.role, user.full_name),
      token_type: 'Bearer',
      user: this.toPublicUser(user),
    };
  }

  async registerUser(dto: RegisterFirstUserDto) {
    const roleCode = 'viewer';
    const departmentCode = dto.department_code ?? 'general';

    await this.usersService.ensureDepartment(departmentCode, departmentCode.replace(/_/g, ' '));

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      fullName: dto.full_name,
      email: dto.email,
      passwordHash,
      phoneNumber: dto.phone_number,
      role: roleCode,
      departmentCode,
    });

    return {
      access_token: await this.signAccessToken(user.id, user.email, user.role, user.full_name),
      token_type: 'Bearer',
      user: this.toPublicUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return this.toPublicUser(user);
  }

  private async signAccessToken(userId: string, email: string, role: string, fullName: string) {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role,
        full_name: fullName,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'newsmind-super-secret',
        expiresIn: Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 60 * 60 * 8),
      },
    );
  }

  private toPublicUser(user: Awaited<ReturnType<UsersService['findByEmail']>>) {
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department_code: user.department_code ?? null,
      department_name: user.department_name ?? null,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
