import { describe, expect, it } from 'vitest'
import { StudyRecordApiError } from './practiceHistoryApi'
import { STUDY_RECORD_FIXTURES, createFakeHistoryApi } from './practiceHistoryApi.fake'

const TOKEN = 'any-token'

describe('createFakeHistoryApi.listRecords', () => {
  it('returns summary fields only, sorted by submittedAt descending (newest first)', async () => {
    const api = createFakeHistoryApi()

    const result = await api.listRecords(TOKEN)

    expect(result.content.map((record) => record.id)).toEqual([502, 501, 503, 504, 505])
    expect(result.content[0]).toEqual({
      id: 502,
      questionId: 1021,
      type: 'PRACTICE',
      category: '가정법',
      level: 'ADVANCED',
      correct: false,
      submittedAt: '2026-08-13T10:16:00',
      text: 'If I _____ you, I would study harder.',
    })
    expect(result.content[0]).not.toHaveProperty('question')
  })

  it('reports default paging metadata when page/size are omitted', async () => {
    const api = createFakeHistoryApi()

    const result = await api.listRecords(TOKEN)

    expect(result.page).toBe(0)
    expect(result.size).toBe(20)
    expect(result.totalElements).toBe(5)
    expect(result.totalPages).toBe(1)
  })

  it('filters by category', async () => {
    const api = createFakeHistoryApi()

    const result = await api.listRecords(TOKEN, { category: '현재완료' })

    expect(result.content.map((record) => record.id)).toEqual([503, 504])
    expect(result.totalElements).toBe(2)
  })

  it('returns an empty page for a category with no records', async () => {
    const api = createFakeHistoryApi()

    const result = await api.listRecords(TOKEN, { category: '존재하지-않는-카테고리' })

    expect(result.content).toEqual([])
    expect(result.totalElements).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it('paginates results using page/size, preserving page 0', async () => {
    const api = createFakeHistoryApi()

    const firstPage = await api.listRecords(TOKEN, { page: 0, size: 2 })
    const secondPage = await api.listRecords(TOKEN, { page: 1, size: 2 })
    const thirdPage = await api.listRecords(TOKEN, { page: 2, size: 2 })

    expect(firstPage.content.map((record) => record.id)).toEqual([502, 501])
    expect(secondPage.content.map((record) => record.id)).toEqual([503, 504])
    expect(thirdPage.content.map((record) => record.id)).toEqual([505])
    expect(firstPage.totalElements).toBe(5)
    expect(firstPage.totalPages).toBe(3)
  })

  it('combines category filtering with pagination', async () => {
    const api = createFakeHistoryApi()

    const result = await api.listRecords(TOKEN, { category: '가정법', page: 0, size: 1 })

    expect(result.content.map((record) => record.id)).toEqual([502])
    expect(result.totalElements).toBe(2)
    expect(result.totalPages).toBe(2)
  })
})

describe('createFakeHistoryApi.getRecord', () => {
  it('returns the full snapshot for an existing record', async () => {
    const api = createFakeHistoryApi()

    const result = await api.getRecord(TOKEN, 501)

    expect(result).toEqual({
      id: 501,
      questionId: 1021,
      type: 'PRACTICE',
      question: {
        category: '가정법',
        level: 'ADVANCED',
        text: 'If I _____ you, I would study harder.',
        choices: ['am', 'was', 'were', 'be'],
        correctAnswer: 'were',
        explanation: '가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.',
      },
      submittedAnswer: 'were',
      correct: true,
      submittedAt: '2026-08-13T10:15:00',
    })
  })

  it('throws a StudyRecordApiError with STUDY_RECORD_NOT_FOUND for an unknown id', async () => {
    const api = createFakeHistoryApi()

    await expect(api.getRecord(TOKEN, 999999)).rejects.toBeInstanceOf(StudyRecordApiError)
    await expect(api.getRecord(TOKEN, 999999)).rejects.toMatchObject({
      code: 'STUDY_RECORD_NOT_FOUND',
      status: 404,
    })
  })
})

describe('createFakeHistoryApi isolation', () => {
  it('does not mutate the shared fixture list across instances', async () => {
    const api = createFakeHistoryApi()
    const record = await api.getRecord(TOKEN, 501)
    record.question.text = 'mutated'

    expect(STUDY_RECORD_FIXTURES.find((fixture) => fixture.id === 501)?.question.text).toBe(
      'If I _____ you, I would study harder.',
    )
  })

  it('gives each instance independently isolated fixture state', async () => {
    const apiA = createFakeHistoryApi()
    const apiB = createFakeHistoryApi()

    const recordFromA = await apiA.getRecord(TOKEN, 501)
    recordFromA.submittedAnswer = 'mutated'

    const recordFromB = await apiB.getRecord(TOKEN, 501)
    expect(recordFromB.submittedAnswer).toBe('were')
  })
})
