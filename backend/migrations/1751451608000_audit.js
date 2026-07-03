exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    actor_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'set null',
    },
    entity_type: { type: 'text', notNull: true },
    entity_id: { type: 'uuid' },
    action: { type: 'text', notNull: true },
    before_data: { type: 'jsonb' },
    after_data: { type: 'jsonb' },
    ip_address: { type: 'inet' },
    user_agent: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('ai_prompt_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    clipping_id: { type: 'uuid' },
    route: { type: 'text', notNull: true },
    provider: { type: 'text', notNull: true },
    model: { type: 'text', notNull: true },
    request_text: { type: 'text', notNull: true },
    response_text: { type: 'text' },
    latency_ms: { type: 'integer' },
    cost_usd: { type: 'numeric(10,4)' },
    needs_manual_review: { type: 'boolean', notNull: true, default: false },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func(`'{}'::jsonb`) },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ai_prompt_logs');
  pgm.dropTable('audit_logs');
};
