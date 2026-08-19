import { describe, expect, it } from 'vitest'
import { serializeStudentListFilters } from './studentTypes'

describe('serializeStudentListFilters', () => {
  it('omits fields that are empty, undefined, or unset', () => {
    expect(serializeStudentListFilters({})).toBe('')
    expect(serializeStudentListFilters({ keyword: '', group: undefined })).toBe('')
  })

  it('serializes keyword and group as plain strings (no label translation)', () => {
    const query = serializeStudentListFilters({ keyword: '민수', group: '중1 A반' })
    const params = new URLSearchParams(query)

    expect(params.get('keyword')).toBe('민수')
    expect(params.get('group')).toBe('중1 A반')
  })

  it('preserves zero-based page semantics (page 0 is not omitted as falsy)', () => {
    const query = serializeStudentListFilters({ page: 0, size: 20 })
    const params = new URLSearchParams(query)

    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializeStudentListFilters({ size: 10, group: '중1 A반', page: 1, keyword: '민수' })
    const b = serializeStudentListFilters({ keyword: '민수', group: '중1 A반', page: 1, size: 10 })

    expect(a).toBe(b)
    expect(Array.from(new URLSearchParams(a).keys())).toEqual(['keyword', 'group', 'page', 'size'])
  })
})
