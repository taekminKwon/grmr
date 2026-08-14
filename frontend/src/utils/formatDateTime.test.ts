import { describe, expect, it } from 'vitest'
import { formatKoreanDateTime } from './formatDateTime'

describe('formatKoreanDateTime', () => {
  it('formats a valid ISO datetime into readable Korean text', () => {
    expect(formatKoreanDateTime('2026-08-13T10:15:00')).toBe('2026년 8월 13일 10:15')
  })

  it('does not zero-pad month/day numerals, but keeps hour/minute zero-padded', () => {
    expect(formatKoreanDateTime('2026-01-05T09:05:00')).toBe('2026년 1월 5일 09:05')
  })

  it('ignores seconds/fractional/offset suffixes beyond the minute', () => {
    expect(formatKoreanDateTime('2026-08-13T10:15:30.123Z')).toBe('2026년 8월 13일 10:15')
  })

  it('falls back to the original value for a malformed timestamp', () => {
    expect(formatKoreanDateTime('not-a-date')).toBe('not-a-date')
    expect(formatKoreanDateTime('')).toBe('')
  })
})
