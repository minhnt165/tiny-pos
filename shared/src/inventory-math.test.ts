import { describe, expect, it } from 'vitest';
import { baseCost, importLineAmount, marginPercent } from './inventory-math.js';

describe('baseCost', () => {
  it('giá nhập 1 thùng quy về 1 đơn vị gốc, làm tròn đồng', () => {
    expect(baseCost(240000, 24)).toBe(10000);
    expect(baseCost(100000, 3)).toBe(33333);
    expect(baseCost(5000, 1)).toBe(5000);
  });
});

describe('marginPercent', () => {
  it('% lãi trên giá nhập, 1 số lẻ; giá nhập 0 → null', () => {
    expect(marginPercent(12000, 10000)).toBe(20);
    expect(marginPercent(9000, 10000)).toBe(-10);
    expect(marginPercent(11800, 10000)).toBe(18);
    expect(marginPercent(10333, 10000)).toBe(3.3);
    expect(marginPercent(1000, 0)).toBeNull();
  });
});

describe('importLineAmount', () => {
  it('qty × giá nhập, làm tròn đồng', () => {
    expect(importLineAmount(2, 240000)).toBe(480000);
    expect(importLineAmount(0.5, 33333)).toBe(16667);
  });
});
