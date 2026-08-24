import { describe, expect, it } from 'vitest'
import { serializeStudentListFilters, serializeStudyRecordListFilters } from './studentTypes'

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

describe('serializeStudyRecordListFilters', () => {
  it('omits fields that are empty, undefined, or unset', () => {
    expect(serializeStudyRecordListFilters({})).toBe('')
    expect(serializeStudyRecordListFilters({ type: undefined })).toBe('')
  })

  it('serializes type as the literal enum value, not a translated label', () => {
    const query = serializeStudyRecordListFilters({ type: 'ASSIGNMENT' })
    const params = new URLSearchParams(query)

    expect(params.get('type')).toBe('ASSIGNMENT')
  })

  it('serializes studentId and period', () => {
    const query = serializeStudyRecordListFilters({ studentId: 501, period: '7d' })
    const params = new URLSearchParams(query)

    expect(params.get('studentId')).toBe('501')
    expect(params.get('period')).toBe('7d')
  })

  it('preserves zero-based page semantics (page 0 is not omitted as falsy)', () => {
    const query = serializeStudyRecordListFilters({ page: 0, size: 20 })
    const params = new URLSearchParams(query)

    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializeStudyRecordListFilters({ size: 10, type: 'PRACTICE', page: 1, period: '30d', studentId: 501 })
    const b = serializeStudyRecordListFilters({ studentId: 501, period: '30d', type: 'PRACTICE', page: 1, size: 10 })

    expect(a).toBe(b)
    expect(Array.from(new URLSearchParams(a).keys())).toEqual(['studentId', 'period', 'type', 'page', 'size'])
  })
})
