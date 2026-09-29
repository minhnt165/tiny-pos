import { createDb, type Db } from './connection.js';

/** DB trong bộ nhớ đã chạy migration thật, dùng cho vitest. */
export function createTestDb(): Db {
  return createDb(':memory:');
}
