import { describe, expect, it } from 'vitest'
import { PracticeApiError } from './practiceApi'
import { PRACTICE_QUESTION_FIXTURES, createFakePracticeApi } from './practiceApi.fake'

const TOKEN = 'any-token'

describe('createFakePracticeApi.getNextQuestion', () => {
  it('delivers a matching active, Phase-1-supported question without answer/explanation', async () => {
    const api = createFakePracticeApi()

    const question = await api.getNextQuestion(TOKEN, { category: '현재완료' })

    expect(question).toEqual({
      id: 2001,
      category: '현재완료',
      type: 'MULTIPLE_CHOICE',
      level: 'INTERMEDIATE',
      text: 'He has lived here _____ 2010.',
      choices: ['for', 'since', 'during', 'from'],
    })
    expect(question).not.toHaveProperty('answer')
    expect(question).not.toHaveProperty('explanation')
  })

  it('filters by category and level', async () => {
    const api = createFakePracticeApi()

    const byCategory = await api.getNextQuestion(TOKEN, { category: '수동태' })
    expect(byCategory.id).toBe(2002)

    const byLevel = await api.getNextQuestion(TOKEN, { level: 'BASIC' })
    expect(byLevel.id).toBe(2002)
  })

  it('throws a PracticeApiError with a 404 when no active question matches the filters (empty pool)', async () => {
    const api = createFakePracticeApi()

    await expect(api.getNextQuestion(TOKEN, { category: '존재하지-않는-카테고리' })).rejects.toMatchObject({
      code: 'NO_QUESTION_AVAILABLE',
      status: 404,
    })
  })

  it('never delivers an inactive question even if its category/level match', async () => {
    const api = createFakePracticeApi()

    await expect(api.getNextQuestion(TOKEN, { category: '가정법' })).rejects.toMatchObject({
      code: 'NO_QUESTION_AVAILABLE',
      status: 404,
    })
  })

  it('never delivers a draft question even if its category/level match', async () => {
    const api = createFakePracticeApi()

    await expect(api.getNextQuestion(TOKEN, { category: '비교급' })).rejects.toMatchObject({
      code: 'NO_QUESTION_AVAILABLE',
      status: 404,
    })
  })

  it('never delivers a question outside Phase 1 scope (e.g. FILL_IN_BLANK) even if active', async () => {
    const api = createFakePracticeApi()

    await expect(api.getNextQuestion(TOKEN, { category: '관계대명사' })).rejects.toMatchObject({
      code: 'NO_QUESTION_AVAILABLE',
      status: 404,
    })
  })
})

describe('createFakePracticeApi.submitAnswer', () => {
  it('grades a correct submission', async () => {
    const api = createFakePracticeApi()

    const result = await api.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })

    expect(result.correct).toBe(true)
    expect(result.correctAnswer).toBe('since')
    expect(result.submittedAnswer).toBe('since')
    expect(result.questionId).toBe(2001)
  })

  it('grades an incorrect submission, still returning the correct answer and explanation', async () => {
    const api = createFakePracticeApi()

    const result = await api.submitAnswer(TOKEN, { questionId: 2001, answer: 'for' })

    expect(result.correct).toBe(false)
    expect(result.correctAnswer).toBe('since')
    expect(result.explanation).toContain('since')
  })

  it('assigns a distinct record id to each repeated attempt on the same question', async () => {
    const api = createFakePracticeApi()

    const first = await api.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })
    const second = await api.submitAnswer(TOKEN, { questionId: 2001, answer: 'for' })
    const third = await api.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })

    const ids = [first.id, second.id, third.id]
    expect(new Set(ids).size).toBe(3)
  })

  it('throws a PracticeApiError with a 404 for an unknown question id', async () => {
    const api = createFakePracticeApi()

    await expect(api.submitAnswer(TOKEN, { questionId: 999999, answer: 'since' })).rejects.toBeInstanceOf(
      PracticeApiError,
    )
    await expect(api.submitAnswer(TOKEN, { questionId: 999999, answer: 'since' })).rejects.toMatchObject({
      code: 'QUESTION_NOT_FOUND',
      status: 404,
    })
  })

  it('throws a PracticeApiError with a 409 QUESTION_NOT_IN_USE when submitting to an inactive question', async () => {
    const api = createFakePracticeApi()

    await expect(api.submitAnswer(TOKEN, { questionId: 2003, answer: 'had' })).rejects.toMatchObject({
      code: 'QUESTION_NOT_IN_USE',
      status: 409,
    })
  })

  it('throws a PracticeApiError with a 409 QUESTION_NOT_IN_USE when submitting to a draft question', async () => {
    const api = createFakePracticeApi()

    await expect(
      api.submitAnswer(TOKEN, { questionId: 2005, answer: 'more interesting' }),
    ).rejects.toMatchObject({
      code: 'QUESTION_NOT_IN_USE',
      status: 409,
    })
  })

  it('throws a PracticeApiError with a 409 QUESTION_TYPE_NOT_SUPPORTED when submitting to a question outside Phase 1 scope', async () => {
    const api = createFakePracticeApi()

    await expect(api.submitAnswer(TOKEN, { questionId: 2004, answer: 'which' })).rejects.toMatchObject({
      code: 'QUESTION_TYPE_NOT_SUPPORTED',
      status: 409,
    })
  })
})

describe('createFakePracticeApi isolation', () => {
  it('gives each instance independent record-id sequences', async () => {
    const apiA = createFakePracticeApi()
    const apiB = createFakePracticeApi()

    await apiA.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })
    await apiA.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })
    const bResult = await apiB.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })

    expect(bResult.id).toBe(1)
  })

  it('does not mutate the shared fixture list across instances', async () => {
    const api = createFakePracticeApi()
    await api.submitAnswer(TOKEN, { questionId: 2001, answer: 'since' })

    expect(PRACTICE_QUESTION_FIXTURES.find((question) => question.id === 2001)).toMatchObject({ answer: 'since' })
  })
})
