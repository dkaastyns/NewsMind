import { Injectable } from '@nestjs/common';
import { CreateUserInput, UsersRepository, UserRecord } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  countUsers(): Promise<number> {
    return this.usersRepository.countUsers();
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.usersRepository.findById(id);
  }

  createUser(input: CreateUserInput): Promise<UserRecord> {
    return this.usersRepository.createUser(input);
  }

  updateLastLogin(userId: string): Promise<void> {
    return this.usersRepository.updateLastLogin(userId);
  }

  ensureRole(code: string, name: string): Promise<string> {
    return this.usersRepository.ensureRole(code, name);
  }

  ensureDepartment(code: string, name: string): Promise<string> {
    return this.usersRepository.ensureDepartment(code, name);
  }

  findAll(): Promise<UserRecord[]> {
    return this.usersRepository.findAll();
  }

  updateRole(userId: string, role: string): Promise<UserRecord | null> {
    return this.usersRepository.updateRole(userId, role);
  }
}
