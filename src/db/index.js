// Postgres adapter removed — project is MongoDB-only.
// This module remains as a compatibility shim for any remaining requires
// of `../db` while the codebase is migrated. Any usage of the exported
// `pool` will throw a clear error to help locate and update remaining
// Postgres-style codepaths.

const errMsg = 'Postgres DB adapter removed — use MongoDB collections via ../db/mongo';

const thrower = () => { throw new Error(errMsg); };

module.exports = {
  pool: {
    query: async () => { thrower(); },
    connect: async () => { thrower(); },
    on: () => { /* no-op */ },
  },
  testConnection: async () => false,
  query: async () => { thrower(); },
};
