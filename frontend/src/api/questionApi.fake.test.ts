import { describe, expect, it } from 'vitest'
import { QuestionApiError } from './questionApi'
import { QUESTION_FIXTURES, createFakeQuestionApi } from './questionApi.fake'

const TOKEN = 'any-token'

describe('createFakeQuestionApi', () => {
  it('lists fixtures using zero-based pagination', async () => {
    const api = createFakeQuestionApi()

    const firstPage = await api.listQuestions(TOKEN, { page: 0, size: 2 })
    expect(firstPage.content).toHaveLength(2)
    expect(firstPage.page).toBe(0)
    expect(firstPage.totalElements).toBe(QUESTION_FIXTURES.length)

    const secondPage = await api.listQuestions(TOKEN, { page: 1, size: 2 })
    expect(secondPage.content).toHaveLength(QUESTION_FIXTURES.length - 2)
  })

  it('list items omit detail-only fields (choices/answer/explanation), matching the real client', async () => {
    const api = createFakeQuestionApi()

    const { content } = await api.listQuestions(TOKEN)

    for (const item of content) {
      expect(item).not.toHaveProperty('choices')
      expect(item).not.toHaveProperty('answer')
      expect(item).not.toHaveProperty('explanation')
    }
  })

  it('filters by category, level, status, and keyword', async () => {
    const api = createFakeQuestionApi()

    const byCategory = await api.listQuestions(TOKEN, { category: '수동태' })
    expect(byCategory.content.map((q) => q.id)).toEqual([1025])

    const byLevel = await api.listQuestions(TOKEN, { level: 'ADVANCED' })
    expect(byLevel.content.map((q) => q.id)).toEqual([1030])

    const byStatus = await api.listQuestions(TOKEN, { status: 'DRAFT' })
    expect(byStatus.content.map((q) => q.id)).toEqual([1030])

    const byKeyword = await api.listQuestions(TOKEN, { keyword: 'window' })
    expect(byKeyword.content.map((q) => q.id)).toEqual([1025])
  })

  it('returns a fixture detail by id', async () => {
    const api = createFakeQuestionApi()

    const detail = await api.getQuestion(TOKEN, 1024)

    expect(detail.id).toBe(1024)
    expect(detail.choices).toEqual(['for', 'since', 'during', 'from'])
  })

  it('throws a QuestionApiError with the real 404 shape for an unknown id', async () => {
    const api = createFakeQuestionApi()

    await expect(api.getQuestion(TOKEN, 999999)).rejects.toBeInstanceOf(QuestionApiError)
    await expect(api.getQuestion(TOKEN, 999999)).rejects.toMatchObject({
      code: 'QUESTION_NOT_FOUND',
      status: 404,
    })
  })

  it('creates a question as DRAFT and makes it visible to later list/get calls', async () => {
    const api = createFakeQuestionApi()

    const created = await api.createQuestion(TOKEN, {
      category: '관계대명사',
      type: 'MULTIPLE_CHOICE',
      level: 'BASIC',
      text: 'This is the book _____ I borrowed.',
      choices: ['who', 'which', 'whom', 'whose'],
      answer: 'which',
      explanation: '사물을 선행사로 받는 목적격 관계대명사는 which를 사용합니다.',
    })

    expect(created.status).toBe('DRAFT')
    expect(created.id).toBeGreaterThan(0)

    const fetched = await api.getQuestion(TOKEN, created.id)
    expect(fetched).toEqual(created)
  })

  it('gives each instance isolated, independent state', async () => {
    const apiA = createFakeQuestionApi()
    const apiB = createFakeQuestionApi()

    await apiA.createQuestion(TOKEN, {
      category: '관계대명사',
      type: 'MULTIPLE_CHOICE',
      level: 'BASIC',
      text: 'Only in apiA',
      choices: ['a', 'b'],
      answer: 'a',
      explanation: 'n/a',
    })

    const { totalElements } = await apiB.listQuestions(TOKEN)
    expect(totalElements).toBe(QUESTION_FIXTURES.length)
  })
})
