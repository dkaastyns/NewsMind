const { spawnSync } = require('node:child_process');

const direction = process.argv[2] || 'up';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/newsmind';

const args = [direction, '-m', 'migrations', '-d', databaseUrl];

const result = spawnSync('node-pg-migrate', args, {
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
