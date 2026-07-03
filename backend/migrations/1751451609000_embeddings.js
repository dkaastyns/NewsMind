exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('news_archives', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    clipping_id: {
      type: 'uuid',
      notNull: true,
      references: 'news_clippings',
      onDelete: 'cascade',
    },
    archive_code: { type: 'text', notNull: true, unique: true },
    physical_location: { type: 'text' },
    archived_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('embeddings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    clipping_id: { type: 'uuid', notNull: true, unique: true },
    chunk_text: { type: 'text', notNull: true },
    embedding: { type: 'vector(1536)', notNull: true },
    model: { type: 'text', notNull: true },
    provider: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('embeddings');
  pgm.dropTable('news_archives');
};
