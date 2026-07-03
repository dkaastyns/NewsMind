// Jalankan: bun run migrate up
// CATATAN: Migration ini hanya bisa di-run di DB development yang fresh atau
// di mana tabel workflow/notifications/permissions belum terisi data penting.

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Drop tabel yang tidak dipakai untuk demo (cascade FK)
  pgm.dropTable('workflow_approvals', { ifExists: true, cascade: true });
  pgm.dropTable('workflow_steps',     { ifExists: true, cascade: true });
  pgm.dropTable('notifications',      { ifExists: true, cascade: true });
  pgm.dropTable('role_permissions',   { ifExists: true, cascade: true });
  pgm.dropTable('permissions',        { ifExists: true, cascade: true });

  // 2. Tambah kolom 'role' text langsung ke users (hardcode 'admin'|'viewer')
  pgm.addColumn('users', {
    role: {
      type: 'text',
      notNull: true,
      default: 'viewer',
      check: "role IN ('admin', 'viewer')",
    },
  });

  // 3. Migrate data: salin nama role dari tabel roles ke kolom baru
  //    (admin role_id → 'admin', lainnya → 'viewer')
  pgm.sql(`
    UPDATE users u
    SET role = CASE
      WHEN r.code = 'admin' THEN 'admin'
      ELSE 'viewer'
    END
    FROM roles r
    WHERE u.role_id = r.id
  `);

  // 4. Drop FK constraint role_id dari users, lalu hapus tabel roles
  pgm.alterColumn('users', 'role_id', { notNull: false });
  pgm.dropConstraint('users', 'users_role_id_fkey', { ifExists: true });
  pgm.dropTable('roles', { ifExists: true, cascade: true });
};

exports.down = (pgm) => {
  // Re-create tables (minimal, tanpa data)
  pgm.createTable('roles', {
    id:   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('permissions', {
    id:   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('role_permissions', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    role_id:       { type: 'uuid', notNull: true, references: 'roles', onDelete: 'cascade' },
    permission_id: { type: 'uuid', notNull: true, references: 'permissions', onDelete: 'cascade' },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('workflow_steps', {
    id:               { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    workflow_type:    { type: 'text', notNull: true, default: 'news_clipping' },
    step_order:       { type: 'integer', notNull: true },
    step_name:        { type: 'text', notNull: true },
    assigned_role_id: { type: 'uuid' },
    is_active:        { type: 'boolean', notNull: true, default: true },
    created_at:       { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:       { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('workflow_approvals', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    workflow_type: { type: 'text', notNull: true, default: 'news_clipping' },
    clipping_id:   { type: 'uuid', notNull: true },
    step_id:       { type: 'uuid', notNull: true },
    approver_id:   { type: 'uuid' },
    status:        { type: 'text', notNull: true, default: 'pending' },
    notes:         { type: 'text' },
    approved_at:   { type: 'timestamptz' },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('notifications', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id:    { type: 'uuid', references: 'users', onDelete: 'cascade' },
    channel:    { type: 'text', notNull: true, default: 'in_app' },
    title:      { type: 'text', notNull: true },
    message:    { type: 'text', notNull: true },
    status:     { type: 'text', notNull: true, default: 'unread' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.dropColumn('users', 'role');
};
