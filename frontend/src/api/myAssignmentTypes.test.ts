import { describe, expect, it } from 'vitest'
import { SUBMISSION_STATUSES, serializeMyAssignmentListFilters } from './myAssignmentTypes'

describe('SUBMISSION_STATUSES', () => {
  it('lists exactly the three canonical submission states', () => {
    expect(SUBMISSION_STATUSES).toEqual(['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED'])
  })
})

describe('serializeMyAssignmentListFilters', () => {
  it('omits fields that are undefined or unset', () => {
    expect(serializeMyAssignmentListFilters({})).toBe('')
    expect(serializeMyAssignmentListFilters({ page: undefined, size: undefined })).toBe('')
  })

  it('preserves zero-based page semantics (page 0 is not omitted as falsy)', () => {
    const query = serializeMyAssignmentListFilters({ page: 0, size: 20 })
    const params = new URLSearchParams(query)

    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializeMyAssignmentListFilters({ size: 10, page: 1 })
    const b = serializeMyAssignmentListFilters({ page: 1, size: 10 })

    expect(a).toBe(b)
    expect(a).toBe('page=1&size=10')
  })
})
