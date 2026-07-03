exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('departments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    department_id: {
      type: 'uuid',
      references: 'departments',
      onDelete: 'set null',
    },
    role_id: {
      type: 'uuid',
      references: 'roles',
      onDelete: 'set null',
    },
    full_name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    phone_number: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    last_login_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
  pgm.dropTable('departments');
};
