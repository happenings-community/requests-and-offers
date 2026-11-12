import { describe, it, expect } from 'vitest';
import {
  addDecimal,
  compareDecimal,
  decimalProblem,
  decimalsEqual,
  isOne,
  isZeroDecimal,
  parseTypedDecimal
} from '$lib/utils/decimal';

describe('decimalProblem', () => {
  it.each(['0', '1', '12', '0.5', '0.05', '1.5', '12.50', '10.0', '999999999', '999999999.999999'])(
    'accepts %s',
    (ok) => expect(decimalProblem(ok)).toBeNull()
  );

  it.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '-1',
    '-0',
    '+1',
    '1e3',
    '1E3',
    'NaN',
    'Infinity',
    '.5',
    '5.',
    '.',
    '1.2.3',
    '1,5',
    '01',
    '00',
    '00.5',
    '0x10',
    '1_000',
    '9999999999',
    '1.1234567'
  ])('refuses %j', (bad) => expect(decimalProblem(bad)).not.toBeNull());
});

describe('compareDecimal and decimalsEqual', () => {
  it('reads trailing zeros as the same amount', () => {
    expect(decimalsEqual('1.50', '1.5')).toBe(true);
    expect(decimalsEqual('10', '10.000')).toBe(true);
    expect(decimalsEqual('0', '0.00')).toBe(true);
  });

  it('orders amounts by value, not by spelling or length', () => {
    expect(compareDecimal('1.5', '1.51')).toBe(-1);
    expect(compareDecimal('10', '9.999999')).toBe(1);
    expect(compareDecimal('2', '10')).toBe(-1);
    expect(compareDecimal('0.000001', '0')).toBe(1);
  });

  it('is exact where binary floats are not', () => {
    // 0.1 + 0.2 !== 0.3 as floats; here the sum is the amount it looks like.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(addDecimal('0.1', '0.2')).toBe('0.3');
    expect(decimalsEqual(addDecimal('0.1', '0.2'), '0.30')).toBe(true);
    expect(addDecimal('0.000001', '0.000002')).toBe('0.000003');
    expect(addDecimal('999999999.999999', '0.000001')).toBe('1000000000');
    expect(addDecimal('1.10', '2.20')).toBe('3.3');
    expect(compareDecimal(addDecimal('4.35', '0.1'), '4.45')).toBe(0);
    expect(compareDecimal('1.005', '1.004999')).toBe(1);
  });
});

describe('isZeroDecimal', () => {
  it('is true for any spelling of zero only', () => {
    expect(isZeroDecimal('0')).toBe(true);
    expect(isZeroDecimal('0.000')).toBe(true);
    expect(isZeroDecimal('0.001')).toBe(false);
    expect(isZeroDecimal('10')).toBe(false);
  });
});

describe('isOne', () => {
  it('is true for any spelling of one, and false for malformed input', () => {
    for (const one of ['1', '1.0', '1.000000']) expect(isOne(one)).toBe(true);
    for (const other of ['0.999999', '1.000001', '10', '', 'one', '01']) {
      expect(isOne(other)).toBe(false);
    }
  });
});

describe('parseTypedDecimal', () => {
  it('reads blank as nothing and trims what was typed', () => {
    expect(parseTypedDecimal(null)).toBeNull();
    expect(parseTypedDecimal(undefined)).toBeNull();
    expect(parseTypedDecimal('')).toBeNull();
    expect(parseTypedDecimal('   ')).toBeNull();
    expect(parseTypedDecimal(' 2.5 ')).toBe('2.5');
  });

  it('accepts a decimal comma, as a French keyboard types it', () => {
    expect(parseTypedDecimal('2,5')).toBe('2.5');
    expect(parseTypedDecimal('1,2,3')).toBe('1,2,3');
  });

  it('hands back anything else untouched, for decimalProblem to name', () => {
    expect(parseTypedDecimal('abc')).toBe('abc');
    expect(parseTypedDecimal('-3')).toBe('-3');
  });
});
