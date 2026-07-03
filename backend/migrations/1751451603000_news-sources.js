exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('news_sources', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    source_name: { type: 'text', notNull: true },
    source_type: { type: 'text', notNull: true, default: 'media' },
    source_url: { type: 'text' },
    contact_person: { type: 'text' },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('news_sources');
};
