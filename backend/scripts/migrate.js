const { spawnSync } = require('node:child_process');

const direction = process.argv[2] || 'up';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/newsmind';

process.env.DATABASE_URL = databaseUrl;

const args = [direction, '-m', 'migrations'];

const result = spawnSync('node-pg-migrate', args, {
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
