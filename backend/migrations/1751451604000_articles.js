exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('news_clippings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    source_id: {
      type: 'uuid',
      references: 'news_sources',
      onDelete: 'set null',
    },
    title: { type: 'text', notNull: true },
    slug: { type: 'text', notNull: true, unique: true },
    source_url: { type: 'text' },
    published_at: { type: 'timestamptz' },
    clipped_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    file_url: { type: 'text' },
    file_key: { type: 'text' },
    storage_provider: { type: 'text', notNull: true, default: 'local' },
    raw_text: { type: 'text' },
    ai_summary: { type: 'text' },
    ai_review: { type: 'text' },
    ai_sentiment: { type: 'text' },
    ai_topic: { type: 'text' },
    ai_caption_social: { type: 'text' },
    ai_caption_web: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'processing' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func(`'{}'::jsonb`) },
    created_by: {
      type: 'uuid',
      references: 'users',
      onDelete: 'set null',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('news_topics', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('news_clipping_topics', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    clipping_id: {
      type: 'uuid',
      notNull: true,
      references: 'news_clippings',
      onDelete: 'cascade',
    },
    topic_id: {
      type: 'uuid',
      notNull: true,
      references: 'news_topics',
      onDelete: 'cascade',
    },
    score: { type: 'numeric(5, 4)', notNull: true, default: 1.0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('news_clipping_topics');
  pgm.dropTable('news_topics');
  pgm.dropTable('news_clippings');
};
