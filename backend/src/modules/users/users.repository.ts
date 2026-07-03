import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';

export type UserRecord = {
  id: string;
  department_id: string | null;
  full_name: string;
  email: string;
  password_hash: string;
  phone_number: string | null;
  role: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  department_code: string | null;
  department_name: string | null;
};

export type CreateUserInput = {
  fullName: string;
  email: string;
  passwordHash: string;
  phoneNumber?: string | null;
  role?: string;
  departmentCode?: string | null;
};

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async countUsers(): Promise<number> {
    const result = await this.pool.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM users');
    return Number(result.rows[0]?.count ?? 0);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      `
        SELECT
          u.*,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE lower(u.email) = lower($1)
        LIMIT 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      `
        SELECT
          u.*,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async findRoleIdByCode(code: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>('SELECT id FROM roles WHERE code = $1 LIMIT 1', [
      code,
    ]);
    return result.rows[0]?.id ?? null;
  }

  async findDepartmentIdByCode(code: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      'SELECT id FROM departments WHERE code = $1 LIMIT 1',
      [code],
    );
    return result.rows[0]?.id ?? null;
  }

  async ensureRole(code: string, name: string): Promise<string> {
    return code; // Dummy implementation since roles table is dropped
  }

  async ensureDepartment(code: string, name: string): Promise<string> {
    const existing = await this.findDepartmentIdByCode(code);
    if (existing) {
      return existing;
    }

    const result = await this.pool.query<{ id: string }>(
      `
        INSERT INTO departments (code, name)
        VALUES ($1, $2)
        RETURNING id
      `,
      [code, name],
    );
    return result.rows[0].id;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const departmentId = input.departmentCode ? await this.findDepartmentIdByCode(input.departmentCode) : null;
    const role = input.role || 'viewer';

    const result = await this.pool.query<UserRecord>(
      `
        INSERT INTO users (
          department_id,
          role,
          full_name,
          email,
          password_hash,
          phone_number
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [departmentId, role, input.fullName, input.email, input.passwordHash, input.phoneNumber ?? null],
    );

    const created = result.rows[0];
    if (!created) {
      throw new Error('Failed to create user');
    }

    return created;
  }

  async findAll(): Promise<UserRecord[]> {
    const result = await this.pool.query<UserRecord>(
      `
        SELECT
          u.*,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        ORDER BY u.created_at DESC
      `
    );
    return result.rows;
  }

  async updateRole(userId: string, role: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      `
        UPDATE users 
        SET role = $1, updated_at = now() 
        WHERE id = $2 
        RETURNING *
      `,
      [role, userId]
    );
    return result.rows[0] ?? null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.pool.query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1', [userId]);
  }
}
