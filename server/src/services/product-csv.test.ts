import { beforeEach, describe, expect, it } from 'vitest';
import { productInputSchema, productViewQuerySchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { addSheet, newWorkbook, toBuffer } from '../xlsx/workbook.js';
import { listCategories } from './categories.js';
import { exportProductsXlsx } from './exports.js';
import { importProductsFile } from './product-csv.js';
import { createProduct, listProducts } from './products.js';
import { adjustStockTo } from './stock.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const H = 'Mã vạch,Tên,Đơn vị,Giá nhập,Giá bán,Tồn,Hàng cân,Danh mục,Tồn tối thiểu\n';
const importText = (text: string) => importProductsFile(db, Buffer.from(text, 'utf8'));

describe('importProductsFile – CSV', () => {
  it('tạo mới kèm tồn, tự tạo danh mục theo tên (không phân biệt hoa thường)', async () => {
    const r = await importText(H + '1,Sữa,hộp,10000,15000,20,0,Đồ Uống,5\n2,Thịt,kg,0,120000,0,1,đồ uống,0\n');
    expect(r).toEqual({ created: 2, updated: 0, errors: [] });
    expect(listCategories(db)).toMatchObject([{ name: 'Đồ Uống', productCount: 2 }]);
    expect(listProducts(db, { includeInactive: false })).toMatchObject([
      { name: 'Sữa', unit: 'hộp', stock: 20, categoryName: 'Đồ Uống', minStock: 5 },
      { name: 'Thịt', isWeighed: true, stock: 0 },
    ]);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ qty: 20, type: 'adjust', note: 'Nhập CSV' }]);
  });

  it('trùng barcode → cập nhật, bỏ qua cột Tồn', async () => {
    createProduct(db, productInputSchema.parse({ name: 'Cũ', barcode: '1', stock: 7 }));
    const r = await importText(H + '1,Mới,cái,1,2,99,0,,0\n');
    expect(r).toMatchObject({ created: 0, updated: 1 });
    expect(listProducts(db, { includeInactive: false })[0]).toMatchObject({ name: 'Mới', sellPrice: 2, stock: 7 });
    expect(db.select().from(stockMovements).all()).toHaveLength(1);
  });

  it('hai dòng cùng mã mới trong file: dòng sau cập nhật dòng trước', async () => {
    const r = await importText(H + '9,A,cái,0,1,5,0,,0\n9,B,cái,0,2,50,0,,0\n');
    expect(r).toMatchObject({ created: 1, updated: 1 });
    expect(listProducts(db, { includeInactive: false })).toMatchObject([{ name: 'B', sellPrice: 2, stock: 5 }]);
  });

  it('dòng lỗi được báo, dòng khác vẫn nhập', async () => {
    const r = await importText(H + '2,,cái,0,1,0,0,,0\n3,OK,cái,0,1,0,0,,0\n');
    expect(r.created).toBe(1);
    expect(r.errors).toEqual([{ line: 2, message: 'Tên không được trống' }]);
  });
});

describe('importProductsFile – mã vạch trùng đơn vị quy đổi', () => {
  it('dòng có mã trùng mã thùng của sản phẩm khác bị báo lỗi theo dòng, không tạo', async () => {
    const { createUnit } = await import('./product-units.js');
    const p = createProduct(db, productInputSchema.parse({ name: 'Coca', barcode: '100' }));
    createUnit(db, p.id, { name: 'Thùng', barcode: '100T', factor: 24, sellPrice: 1 });
    const r = await importText(H + '100T,Hàng lạ,cái,0,1,0,0,,0\n');
    expect(r).toEqual({ created: 0, updated: 0, errors: [{ line: 2, message: 'Mã vạch đã tồn tại' }] });
    expect(listProducts(db, { includeInactive: false })).toHaveLength(1);
  });
});

describe('importProductsFile – khớp hàng không mã vạch theo tên', () => {
  it('không phân biệt hoa thường (kể cả chữ có dấu), không tạo trùng, không đổi tồn', async () => {
    createProduct(db, productInputSchema.parse({ name: 'Rau Muống', sellPrice: 5000, stock: 4 }));
    const r = await importText('Tên,Giá bán,Tồn\nrau muống,6000,99\nĐƯỜNG,20000,1\nđường,21000,0\n');
    expect(r).toEqual({ created: 1, updated: 2, errors: [] });
    const byName = Object.fromEntries(listProducts(db, { includeInactive: false }).map((p) => [p.name, [p.sellPrice, p.stock]]));
    expect(byName).toEqual({ 'rau muống': [6000, 4], 'đường': [21000, 1] });
  });

  it('hai sản phẩm không mã vạch trùng tên → lỗi dòng, không đoán', async () => {
    createProduct(db, productInputSchema.parse({ name: 'Kẹo' }));
    createProduct(db, productInputSchema.parse({ name: 'kẹo' }));
    const message = 'Có nhiều sản phẩm tên "Kẹo" không có mã vạch, hãy thêm mã vạch cho từng sản phẩm ở trang Sản phẩm';
    // Cả khi dòng có mã vạch mới: không đoán gán cho sản phẩm nào
    expect(await importText('Mã vạch,Tên,Giá bán\n,Kẹo,1000\n77,Kẹo,1000\n')).toEqual({
      created: 0,
      updated: 0,
      errors: [
        { line: 2, message },
        { line: 3, message },
      ],
    });
  });

  it('điền mã vạch mới cho hàng đang không có mã: gán mã cho đúng hàng đó, không tạo trùng, không cộng tồn', async () => {
    createProduct(db, productInputSchema.parse({ name: 'Rau muống', sellPrice: 5000, stock: 12 }));
    expect(await importText('Mã vạch,Tên,Giá bán,Tồn\n2000001,Rau muống,6000,12\n')).toEqual({ created: 0, updated: 1, errors: [] });
    expect(listProducts(db, { includeInactive: false }).map((p) => [p.name, p.barcode, p.sellPrice, p.stock])).toEqual([
      ['Rau muống', '2000001', 6000, 12],
    ]);
    expect(db.select().from(stockMovements).all()).toHaveLength(1);
    // Lần nhập sau khớp theo mã vạch vừa gán
    expect(await importText('Mã vạch,Tên,Giá bán\n2000001,Rau muống,7000\n')).toMatchObject({ created: 0, updated: 1 });
  });

  it('mã vạch mới chỉ khớp tên trong số hàng không mã vạch; hàng đã có mã khác thì tạo mới', async () => {
    createProduct(db, productInputSchema.parse({ name: 'Sữa', barcode: '1' }));
    expect(await importText('Mã vạch,Tên\n5,Sữa\n')).toMatchObject({ created: 1, updated: 0 });
    expect(listProducts(db, { includeInactive: false })).toHaveLength(2);
  });
});

describe('importProductsFile – Excel', () => {
  it('đi vòng xuất/nhập: cập nhật hết, không tạo trùng, không đổi tồn (cả hàng không mã vạch và hàng âm kho)', async () => {
    createProduct(db, productInputSchema.parse({ name: 'Sữa', barcode: '0123', sellPrice: 15000, stock: 5 }));
    const cake = createProduct(db, productInputSchema.parse({ name: 'Bánh', sellPrice: 5000 }));
    adjustStockTo(db, cake.id, -3, 'Bán âm');
    const file = await exportProductsXlsx(db, productViewQuerySchema.parse({}));
    expect(await importProductsFile(db, file.buffer)).toEqual({ created: 0, updated: 2, errors: [] });
    const stock = Object.fromEntries(listProducts(db, { includeInactive: false }).map((p) => [p.name, [p.barcode, p.stock]]));
    expect(stock).toEqual({ 'Sữa': ['0123', 5], 'Bánh': [null, -3] });
  });

  it('dòng mới: tạo kèm movement "Nhập Excel"; tồn đầu âm báo lỗi dòng', async () => {
    const wb = newWorkbook();
    const cols = [
      { header: 'Tên', width: 10, kind: 'text' as const },
      { header: 'Giá bán', width: 10, kind: 'money' as const },
      { header: 'Tồn', width: 10, kind: 'qty' as const },
    ];
    addSheet(wb, 'S', cols, [['Kẹo', 5000, 2.5], ['Âm', 1000, -1]], 420);
    const r = await importProductsFile(db, await toBuffer(wb));
    expect(r).toEqual({ created: 1, updated: 0, errors: [{ line: 3, message: 'Tồn đầu không được âm' }] });
    expect(db.select().from(stockMovements).all()).toMatchObject([{ qty: 2.5, type: 'adjust', note: 'Nhập Excel' }]);
  });

  it('CSV có BOM vẫn đọc được', async () => {
    expect(await importText('﻿Tên,Giá bán\nKẹo,5000\n')).toEqual({ created: 1, updated: 0, errors: [] });
  });

  it('file .xls cũ và file .xlsx hỏng bị từ chối, không ghi gì', async () => {
    await expect(importProductsFile(db, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))).rejects.toMatchObject({
      status: 400,
      message: 'File .xls cũ chưa hỗ trợ. Mở bằng Excel rồi lưu lại dạng .xlsx',
    });
    await expect(importProductsFile(db, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).rejects.toMatchObject({
      status: 400,
      message: 'File Excel bị hỏng hoặc không đọc được',
    });
    expect(listProducts(db, { includeInactive: true })).toHaveLength(0);
  });
});
