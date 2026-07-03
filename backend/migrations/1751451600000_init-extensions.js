exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createExtension('vector', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropExtension('vector', { ifExists: true });
  pgm.dropExtension('pgcrypto', { ifExists: true });
};
