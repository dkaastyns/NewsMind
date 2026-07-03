import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterFirstUserDto } from './dto/register-first-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register-first')
  registerFirst(@Body() dto: RegisterFirstUserDto) {
    return this.authService.registerFirstUser(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterFirstUserDto) {
    return this.authService.registerUser(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user: { user_id: string } }) {
    return this.authService.me(request.user.user_id);
  }
}
