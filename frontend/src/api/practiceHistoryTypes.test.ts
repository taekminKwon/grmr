import { describe, expect, it } from 'vitest'
import { serializeStudyRecordListFilters } from './practiceHistoryTypes'

describe('serializeStudyRecordListFilters', () => {
  it('omits fields that are empty, undefined, or unset', () => {
    expect(serializeStudyRecordListFilters({})).toBe('')
    expect(serializeStudyRecordListFilters({ category: '' })).toBe('')
  })

  it('passes category through as-is (not translated to a label)', () => {
    const query = serializeStudyRecordListFilters({ category: '가정법' })
    const params = new URLSearchParams(query)

    expect(params.get('category')).toBe('가정법')
  })

  it('preserves page 0 instead of treating it as empty', () => {
    const query = serializeStudyRecordListFilters({ page: 0 })
    const params = new URLSearchParams(query)

    expect(params.get('page')).toBe('0')
  })

  it('serializes size as-is', () => {
    const query = serializeStudyRecordListFilters({ size: 10 })
    const params = new URLSearchParams(query)

    expect(params.get('size')).toBe('10')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializeStudyRecordListFilters({ size: 10, page: 2, category: '가정법' })
    const b = serializeStudyRecordListFilters({ category: '가정법', page: 2, size: 10 })

    expect(a).toBe(b)
    expect(a).toBe(`category=${encodeURIComponent('가정법')}&page=2&size=10`)
  })
})
