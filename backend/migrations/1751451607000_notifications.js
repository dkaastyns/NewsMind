exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('notifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'cascade',
    },
    channel: { type: 'text', notNull: true, default: 'in_app' },
    title: { type: 'text', notNull: true },
    message: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'unread' },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('notifications');
};
