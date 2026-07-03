exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('workflow_steps', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    workflow_type: { type: 'text', notNull: true, default: 'news_clipping' },
    step_order: { type: 'integer', notNull: true },
    step_name: { type: 'text', notNull: true },
    assigned_role_id: {
      type: 'uuid',
      references: 'roles',
      onDelete: 'set null',
    },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('workflow_approvals', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    workflow_type: { type: 'text', notNull: true, default: 'news_clipping' },
    clipping_id: {
      type: 'uuid',
      notNull: true,
      references: 'news_clippings',
      onDelete: 'cascade',
    },
    step_id: {
      type: 'uuid',
      notNull: true,
      references: 'workflow_steps',
      onDelete: 'cascade',
    },
    approver_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'set null',
    },
    status: { type: 'text', notNull: true, default: 'pending' },
    notes: { type: 'text' },
    approved_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('workflow_approvals');
  pgm.dropTable('workflow_steps');
};
