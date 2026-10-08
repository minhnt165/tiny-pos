import { describe, expect, it } from 'vitest';
import { allocateIn, allocateOut, daysLeft, lineCostPrice, lotState, sortFefo, type LotBalance } from './lot-math.js';

const lot = (id: number, remaining: number, expiresOn: string | null = null, costPrice = 1000): LotBalance => ({ id, remaining, costPrice, expiresOn });

describe('sortFefo', () => {
  it('hạn gần trước, không hạn cuối, cùng hạn theo id', () => {
    const lots = [lot(3, 1, null), lot(2, 1, '2026-12-01'), lot(5, 1, '2026-10-20'), lot(4, 1, '2026-10-20')];
    expect(sortFefo(lots).map((l) => l.id)).toEqual([4, 5, 2, 3]);
  });
});

describe('allocateOut', () => {
  it('đủ hàng: trừ lô hạn gần trước, gối sang lô sau; bỏ qua lô 0/âm khi còn lô dương', () => {
    const lots = [lot(1, 0, '2026-10-01'), lot(2, 3, '2026-10-20'), lot(3, 10, null), lot(4, -2, '2026-11-01')];
    expect(allocateOut(lots, 5)).toEqual([
      { lotId: 2, qty: -3 },
      { lotId: 3, qty: -2 },
    ]);
  });
  it('thiếu hàng: phần thiếu trừ âm vào lô cuối theo FEFO (lô không hạn)', () => {
    expect(allocateOut([lot(1, 2, '2026-10-20'), lot(2, 1, null)], 5)).toEqual([
      { lotId: 1, qty: -2 },
      { lotId: 2, qty: -3 },
    ]);
  });
  it('mọi lô đều hết: trừ hết vào lô cuối', () => {
    expect(allocateOut([lot(1, 0, '2026-10-20'), lot(2, -1, null)], 4)).toEqual([{ lotId: 2, qty: -4 }]);
  });
  it('danh sách rỗng → []', () => {
    expect(allocateOut([], 3)).toEqual([]);
  });
  it('hàng cân: 0,3 kg khi lô A còn 0,1 → 0,1 + 0,2, không rác nhị phân', () => {
    expect(allocateOut([lot(1, 0.1, '2026-10-20'), lot(2, 5, null)], 0.3)).toEqual([
      { lotId: 1, qty: -0.1 },
      { lotId: 2, qty: -0.2 },
    ]);
  });
});

describe('allocateIn', () => {
  it('không lô âm → toàn bộ vào đích', () => {
    expect(allocateIn([lot(1, 2), lot(2, 0)], 10, 2)).toEqual([{ lotId: 2, qty: 10 }]);
  });
  it('bù lô âm theo FEFO về 0 rồi dư vào đích', () => {
    const lots = [lot(1, -3, '2026-10-20'), lot(2, -1, null), lot(3, 0, '2026-12-01')];
    expect(allocateIn(lots, 10, 3)).toEqual([
      { lotId: 1, qty: 3 },
      { lotId: 2, qty: 1 },
      { lotId: 3, qty: 6 },
    ]);
  });
  it('cộng ít hơn tổng âm → đích nhận 0 (không có dòng cho đích)', () => {
    expect(allocateIn([lot(1, -5, '2026-10-20'), lot(2, 0, null)], 2, 2)).toEqual([{ lotId: 1, qty: 2 }]);
  });
  it('đích chính là lô âm → một dòng gộp', () => {
    expect(allocateIn([lot(1, -2, null)], 5, 1)).toEqual([{ lotId: 1, qty: 5 }]);
  });
});

describe('lineCostPrice', () => {
  it('một lô: giá vốn lô × factor', () => {
    expect(lineCostPrice([{ qty: -24, costPrice: 10000 }], 24, 24)).toBe(240000);
  });
  it('hai lô: bình quân theo số trừ, làm tròn theo đơn vị gốc trước rồi nhân factor', () => {
    expect(lineCostPrice([{ qty: -3, costPrice: 8000 }, { qty: -2, costPrice: 9000 }], 5, 1)).toBe(8400);
    expect(lineCostPrice([{ qty: -1, costPrice: 8000 }, { qty: -2, costPrice: 9000 }], 3, 1)).toBe(8667);
  });
  it('qty 0 → 0; không âm', () => {
    expect(lineCostPrice([], 0, 1)).toBe(0);
    expect(lineCostPrice([{ qty: -1, costPrice: 0 }], 1, 1)).toBe(0);
  });
});

describe('daysLeft / lotState', () => {
  const today = '2026-10-08';
  it('daysLeft: hôm nay 0, mai 1, hôm qua -1, không hạn null', () => {
    expect(daysLeft('2026-10-08', today)).toBe(0);
    expect(daysLeft('2026-10-09', today)).toBe(1);
    expect(daysLeft('2026-10-07', today)).toBe(-1);
    expect(daysLeft(null, today)).toBeNull();
  });
  it('lotState theo ngưỡng 30 ngày', () => {
    expect(lotState({ remaining: 0, expiresOn: '2026-10-01' }, today, 30)).toBe('empty');
    expect(lotState({ remaining: -1, expiresOn: null }, today, 30)).toBe('empty');
    expect(lotState({ remaining: 1, expiresOn: null }, today, 30)).toBe('ok');
    expect(lotState({ remaining: 1, expiresOn: '2026-10-07' }, today, 30)).toBe('expired');
    expect(lotState({ remaining: 1, expiresOn: '2026-10-08' }, today, 30)).toBe('expiring');
    expect(lotState({ remaining: 1, expiresOn: '2026-11-07' }, today, 30)).toBe('expiring');
    expect(lotState({ remaining: 1, expiresOn: '2026-11-08' }, today, 30)).toBe('ok');
  });
});
