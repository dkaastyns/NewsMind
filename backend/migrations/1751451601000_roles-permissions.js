exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('roles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('permissions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('role_permissions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    role_id: {
      type: 'uuid',
      notNull: true,
      references: 'roles',
      onDelete: 'cascade',
    },
    permission_id: {
      type: 'uuid',
      notNull: true,
      references: 'permissions',
      onDelete: 'cascade',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('role_permissions');
  pgm.dropTable('permissions');
  pgm.dropTable('roles');
};
