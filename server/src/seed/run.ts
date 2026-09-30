import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../db/connection.js';
import { seed } from './seed.js';

// server/src/seed → ../../.. = gốc repo
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dbFile = process.env['DB_FILE'] ?? path.join(repoRoot, 'data', 'grocery.db');

const db = createDb(dbFile);
const r = seed(db);
console.log(`Seed xong (${dbFile}):`);
console.log(`  Danh mục tạo mới : ${r.categoriesCreated}`);
console.log(`  Sản phẩm tạo mới : ${r.productsCreated} (bỏ qua ${r.productsSkipped} đã có)`);
console.log(`  Đơn vị quy đổi   : ${r.unitsCreated}`);
console.log(`  Nhà cung cấp mới : ${r.suppliersCreated}`);
console.log(`  Phiếu nhập mới   : ${r.importsCreated} (bỏ qua ${r.importsSkipped} đã có)`);
console.log(`  Lần trả nợ NCC   : ${r.paymentsCreated}`);
