import { describe, expect, it } from 'vitest'
import {
  ASSIGNMENT_STATUS_LABELS,
  assignmentStatusFromLabel,
  computeAssignmentStatus,
  serializeAssignmentListFilters,
} from './assignmentTypes'

describe('assignment status labels', () => {
  it('centralizes Korean labels for every assignment status', () => {
    expect(ASSIGNMENT_STATUS_LABELS).toEqual({
      UPCOMING: '예정',
      IN_PROGRESS: '진행 중',
      CLOSED: '마감',
    })
  })

  it('parses a Korean label back into the canonical status', () => {
    expect(assignmentStatusFromLabel('예정')).toBe('UPCOMING')
    expect(assignmentStatusFromLabel('진행 중')).toBe('IN_PROGRESS')
    expect(assignmentStatusFromLabel('마감')).toBe('CLOSED')
  })

  it('throws on an unrecognized label', () => {
    expect(() => assignmentStatusFromLabel('알수없음')).toThrow()
  })
})

describe('serializeAssignmentListFilters', () => {
  it('omits fields that are empty, undefined, or unset', () => {
    expect(serializeAssignmentListFilters({})).toBe('')
    expect(serializeAssignmentListFilters({ keyword: undefined })).toBe('')
  })

  it('serializes status as its Korean label, not the enum key', () => {
    const query = serializeAssignmentListFilters({ status: 'IN_PROGRESS' })
    const params = new URLSearchParams(query)

    expect(params.get('status')).toBe('진행 중')
  })

  it('preserves zero-based page semantics (page 0 is not omitted as falsy)', () => {
    const query = serializeAssignmentListFilters({ page: 0, size: 20 })
    const params = new URLSearchParams(query)

    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializeAssignmentListFilters({ size: 10, keyword: '연습', page: 1, status: 'CLOSED' })
    const b = serializeAssignmentListFilters({ status: 'CLOSED', keyword: '연습', page: 1, size: 10 })

    expect(a).toBe(b)
    expect(a).toBe('status=%EB%A7%88%EA%B0%90&keyword=%EC%97%B0%EC%8A%B5&page=1&size=10')
  })
})

describe('computeAssignmentStatus', () => {
  it('returns UPCOMING when today is before startDate', () => {
    expect(computeAssignmentStatus('2026-08-10', '2026-08-20', new Date('2026-08-09T00:00:00Z'))).toBe('UPCOMING')
  })

  it('returns IN_PROGRESS on the startDate boundary', () => {
    expect(computeAssignmentStatus('2026-08-10', '2026-08-20', new Date('2026-08-10T00:00:00Z'))).toBe(
      'IN_PROGRESS',
    )
  })

  it('returns IN_PROGRESS on the dueDate boundary', () => {
    expect(computeAssignmentStatus('2026-08-10', '2026-08-20', new Date('2026-08-20T00:00:00Z'))).toBe(
      'IN_PROGRESS',
    )
  })

  it('returns CLOSED once today is after dueDate', () => {
    expect(computeAssignmentStatus('2026-08-10', '2026-08-20', new Date('2026-08-21T00:00:00Z'))).toBe('CLOSED')
  })

  it('returns IN_PROGRESS for a same-day start/due assignment on that day', () => {
    expect(computeAssignmentStatus('2026-08-10', '2026-08-10', new Date('2026-08-10T00:00:00Z'))).toBe(
      'IN_PROGRESS',
    )
  })
})
