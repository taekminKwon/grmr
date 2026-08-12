import { describe, expect, it } from 'vitest'
import {
  PHASE_1_QUESTION_TYPES,
  QUESTION_LEVEL_LABELS,
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
  questionLevelFromLabel,
  questionStatusFromLabel,
  questionTypeFromLabel,
  serializeQuestionListFilters,
} from './questionTypes'

describe('question enum labels', () => {
  it('centralizes Korean labels for every question type', () => {
    expect(QUESTION_TYPE_LABELS).toEqual({
      MULTIPLE_CHOICE: '객관식',
      FILL_IN_BLANK: '빈칸',
      ERROR_FINDING: '오류 찾기',
    })
  })

  it('centralizes Korean labels for every question level', () => {
    expect(QUESTION_LEVEL_LABELS).toEqual({
      BASIC: '기초',
      INTERMEDIATE: '보통',
      ADVANCED: '심화',
    })
  })

  it('centralizes Korean labels for every question status', () => {
    expect(QUESTION_STATUS_LABELS).toEqual({
      DRAFT: '초안',
      ACTIVE: '사용 중',
      INACTIVE: '사용 중지',
    })
  })

  it('restricts Phase 1 exposed types to MULTIPLE_CHOICE only', () => {
    expect(PHASE_1_QUESTION_TYPES).toEqual(['MULTIPLE_CHOICE'])
  })

  it('parses a Korean label back into the canonical type', () => {
    expect(questionTypeFromLabel('객관식')).toBe('MULTIPLE_CHOICE')
    expect(questionTypeFromLabel('빈칸')).toBe('FILL_IN_BLANK')
    expect(questionTypeFromLabel('오류 찾기')).toBe('ERROR_FINDING')
  })

  it('parses a Korean label back into the canonical level', () => {
    expect(questionLevelFromLabel('기초')).toBe('BASIC')
    expect(questionLevelFromLabel('보통')).toBe('INTERMEDIATE')
    expect(questionLevelFromLabel('심화')).toBe('ADVANCED')
  })

  it('parses a Korean label back into the canonical status', () => {
    expect(questionStatusFromLabel('초안')).toBe('DRAFT')
    expect(questionStatusFromLabel('사용 중')).toBe('ACTIVE')
    expect(questionStatusFromLabel('사용 중지')).toBe('INACTIVE')
  })

  it('throws on an unrecognized label for each enum', () => {
    expect(() => questionTypeFromLabel('알수없음')).toThrow()
    expect(() => questionLevelFromLabel('알수없음')).toThrow()
    expect(() => questionStatusFromLabel('알수없음')).toThrow()
  })
})

describe('serializeQuestionListFilters', () => {
  it('omits fields that are empty, undefined, or unset', () => {
    expect(serializeQuestionListFilters({})).toBe('')
    expect(serializeQuestionListFilters({ category: '', keyword: undefined })).toBe('')
  })

  it('serializes enum filters as their Korean label, not the enum key', () => {
    const query = serializeQuestionListFilters({ type: 'MULTIPLE_CHOICE', level: 'BASIC', status: 'ACTIVE' })
    const params = new URLSearchParams(query)

    expect(params.get('type')).toBe('객관식')
    expect(params.get('level')).toBe('기초')
    expect(params.get('status')).toBe('사용 중')
  })

  it('preserves zero-based page semantics (page 0 is not omitted as falsy)', () => {
    const query = serializeQuestionListFilters({ page: 0, size: 20 })
    const params = new URLSearchParams(query)

    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('produces a deterministic field order regardless of input key order', () => {
    const a = serializeQuestionListFilters({
      keyword: 'since',
      category: '현재완료',
      page: 1,
      status: 'ACTIVE',
      size: 10,
      type: 'MULTIPLE_CHOICE',
      level: 'BASIC',
    })
    const b = serializeQuestionListFilters({
      category: '현재완료',
      type: 'MULTIPLE_CHOICE',
      level: 'BASIC',
      status: 'ACTIVE',
      keyword: 'since',
      page: 1,
      size: 10,
    })

    expect(a).toBe(b)
    expect(a).toBe('category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&type=%EA%B0%9D%EA%B4%80%EC%8B%9D&level=%EA%B8%B0%EC%B4%88&status=%EC%82%AC%EC%9A%A9+%EC%A4%91&keyword=since&page=1&size=10')
  })
})
