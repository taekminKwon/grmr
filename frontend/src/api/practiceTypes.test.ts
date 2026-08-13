import { describe, expect, it } from 'vitest'
import { serializePracticeQuestionFilters } from './practiceTypes'

describe('serializePracticeQuestionFilters', () => {
  it('omits fields that are empty, undefined, or unset', () => {
    expect(serializePracticeQuestionFilters({})).toBe('')
    expect(serializePracticeQuestionFilters({ category: '' })).toBe('')
  })

  it('serializes level as its Korean label, not the enum key', () => {
    const query = serializePracticeQuestionFilters({ level: 'BASIC' })
    const params = new URLSearchParams(query)

    expect(params.get('level')).toBe('기초')
  })

  it('passes category through as-is', () => {
    const query = serializePracticeQuestionFilters({ category: '현재완료' })
    const params = new URLSearchParams(query)

    expect(params.get('category')).toBe('현재완료')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializePracticeQuestionFilters({ level: 'BASIC', category: '현재완료' })
    const b = serializePracticeQuestionFilters({ category: '현재완료', level: 'BASIC' })

    expect(a).toBe(b)
    expect(a).toBe('category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&level=%EA%B8%B0%EC%B4%88')
  })
})
