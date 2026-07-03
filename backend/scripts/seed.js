const { spawnSync } = require('node:child_process');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/newsmind';
const adminEmail = process.env.NEWSMIND_ADMIN_EMAIL || 'admin@newsmind.local';
const adminPassword = process.env.NEWSMIND_ADMIN_PASSWORD || 'Newsmind@12345';
const humasEmail = process.env.NEWSMIND_HUMAS_EMAIL || 'humas@newsmind.local';
const humasPassword = process.env.NEWSMIND_HUMAS_PASSWORD || 'Newsmind@12345';

async function upsertRole(client, code, name) {
  const existing = await client.query('SELECT id FROM roles WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await client.query(
    'INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING id',
    [code, name],
  );
  return result.rows[0].id;
}

async function upsertDepartment(client, code, name) {
  const existing = await client.query('SELECT id FROM departments WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await client.query(
    'INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING id',
    [code, name],
  );
  return result.rows[0].id;
}

async function upsertUser(client, user) {
  const existing = await client.query('SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1', [
    user.email,
  ]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await client.query(
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
      RETURNING id
    `,
    [user.departmentId, user.role, user.fullName, user.email, user.passwordHash, user.phoneNumber ?? null],
  );
  return result.rows[0].id;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    const humasPasswordHash = await bcrypt.hash(humasPassword, 10);

    const generalDeptId = await upsertDepartment(client, 'general', 'General');
    const humasDeptId = await upsertDepartment(client, 'humas', 'Humas');

    await upsertUser(client, {
      fullName: 'NewsMind Admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'admin',
      departmentId: generalDeptId,
    });

    await upsertUser(client, {
      fullName: 'NewsMind Humas',
      email: humasEmail,
      passwordHash: humasPasswordHash,
      role: 'viewer',
      departmentId: humasDeptId,
    });

    await client.query('COMMIT');

    console.log('Seed complete');
    console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
    console.log(`Humas login: ${humasEmail} / ${humasPassword}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
