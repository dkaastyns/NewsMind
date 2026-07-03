import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterFirstUserDto {
  @IsString()
  full_name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  role_code?: string;

  @IsOptional()
  @IsString()
  department_code?: string;
}
