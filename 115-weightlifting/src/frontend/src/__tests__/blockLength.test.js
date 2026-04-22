import { describe, expect, it } from 'vitest'
import { BLOCK_PRESETS, endDateForBlock, inferBlockKey } from '../utils/blockLength'

describe('blockLength', () => {
  it('exposes the canonical 2/4/8/12 block presets', () => {
    expect(BLOCK_PRESETS.map((p) => p.weeks)).toEqual([2, 4, 8, 12])
  })

  it('computes correct end date for a 4-week block starting on a Monday', () => {
    // 2026-04-20 is a Monday
    expect(endDateForBlock('2026-04-20', 4)).toBe('2026-05-17') // 4*7 - 1 = 27 days later
  })

  it('computes correct end date for an 8-week block', () => {
    expect(endDateForBlock('2026-01-05', 8)).toBe('2026-03-01') // 55 days later
  })

  it('returns empty string for invalid inputs', () => {
    expect(endDateForBlock('', 4)).toBe('')
    expect(endDateForBlock('2026-04-20', 0)).toBe('')
    expect(endDateForBlock('2026-04-20', -1)).toBe('')
    expect(endDateForBlock('not-a-date', 4)).toBe('')
  })

  it("infers block key from start/end date pair", () => {
    expect(inferBlockKey('2026-04-20', '2026-05-17')).toBe('4wk')
    expect(inferBlockKey('2026-04-20', '2026-05-03')).toBe('2wk')
    expect(inferBlockKey('2026-04-20', '2026-06-14')).toBe('8wk')
    expect(inferBlockKey('2026-04-20', '2026-07-12')).toBe('12wk')
  })

  it("falls back to 'custom' for non-matching lengths", () => {
    expect(inferBlockKey('2026-04-20', '2026-04-30')).toBe('custom') // 11 days
    expect(inferBlockKey('', '2026-04-30')).toBe('custom')
    expect(inferBlockKey('2026-04-20', '')).toBe('custom')
  })
})
