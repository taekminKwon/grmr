import { describe, expect, it } from 'vitest'
import { AssignmentApiError } from './assignmentApi'
import { ASSIGNMENT_FIXTURES, createFakeAssignmentApi } from './assignmentApi.fake'

const TOKEN = 'any-token'

describe('createFakeAssignmentApi', () => {
  it('lists fixtures using zero-based pagination', async () => {
    const api = createFakeAssignmentApi()

    const firstPage = await api.listAssignments(TOKEN, { page: 0, size: 2 })
    expect(firstPage.content).toHaveLength(2)
    expect(firstPage.page).toBe(0)
    expect(firstPage.totalElements).toBe(ASSIGNMENT_FIXTURES.length)

    const secondPage = await api.listAssignments(TOKEN, { page: 1, size: 2 })
    expect(secondPage.content).toHaveLength(ASSIGNMENT_FIXTURES.length - 2)
  })

  it('list items omit the detail-only questions field, matching the real client', async () => {
    const api = createFakeAssignmentApi()

    const { content } = await api.listAssignments(TOKEN)

    for (const item of content) {
      expect(item).not.toHaveProperty('questions')
    }
  })

  it('filters by status and keyword', async () => {
    const api = createFakeAssignmentApi()

    const byStatus = await api.listAssignments(TOKEN, { status: 'UPCOMING' })
    expect(byStatus.content.map((a) => a.id)).toEqual([3])

    const byKeyword = await api.listAssignments(TOKEN, { keyword: '가정법' })
    expect(byKeyword.content.map((a) => a.id)).toEqual([2])
  })

  it('returns both CLASS and STUDENT target variants without a stray opposite field', async () => {
    const api = createFakeAssignmentApi()

    // Fixture #1 is CLASS-targeted, #2 is STUDENT-targeted (see ASSIGNMENT_FIXTURES).
    const { content } = await api.listAssignments(TOKEN)
    const classItem = content.find((a) => a.id === 1)!
    const studentItem = content.find((a) => a.id === 2)!

    expect(classItem.targetType).toBe('CLASS')
    expect(classItem).toHaveProperty('targetGroup')
    expect(classItem).not.toHaveProperty('targetStudentId')
    expect(studentItem.targetType).toBe('STUDENT')
    expect(studentItem).toHaveProperty('targetStudentId')
    expect(studentItem).not.toHaveProperty('targetGroup')
  })

  it('returns a fixture detail with ordered question summaries', async () => {
    const api = createFakeAssignmentApi()

    const detail = await api.getAssignment(TOKEN, 3)

    expect(detail.questions.map((q) => q.id)).toEqual([1025, 1024, 1021])
    expect(detail.questions.map((q) => q.order)).toEqual([1, 2, 3])
  })

  it('throws an AssignmentApiError with the real 404 shape for an unknown id', async () => {
    const api = createFakeAssignmentApi()

    await expect(api.getAssignment(TOKEN, 999999)).rejects.toBeInstanceOf(AssignmentApiError)
    await expect(api.getAssignment(TOKEN, 999999)).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      status: 404,
    })
  })

  describe('createAssignment', () => {
    it('creates a CLASS-targeted assignment and preserves questionIds order in the resulting detail', async () => {
      const api = createFakeAssignmentApi()

      const created = await api.createAssignment(TOKEN, {
        title: '수동태 연습',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        startDate: '2026-08-08',
        dueDate: '2026-08-10',
        questionIds: [1023, 1024, 1021],
      })

      expect(created).not.toHaveProperty('questions')
      if (created.targetType !== 'CLASS') {
        throw new Error('expected a CLASS-targeted assignment')
      }
      expect(created.targetGroup).toBe('중1 A반')
      expect(created.progress).toBe(0)

      const fetched = await api.getAssignment(TOKEN, created.id)
      expect(fetched.questions.map((q) => q.id)).toEqual([1023, 1024, 1021])
      expect(fetched.questions.map((q) => q.order)).toEqual([1, 2, 3])
    })

    it('creates a STUDENT-targeted assignment with targetStudentId and no targetGroup', async () => {
      const api = createFakeAssignmentApi()

      const created = await api.createAssignment(TOKEN, {
        title: '가정법 개인 과제',
        targetType: 'STUDENT',
        targetStudentId: 42,
        startDate: '2026-08-08',
        dueDate: '2026-08-10',
        questionIds: [1021],
      })

      expect(created.targetType).toBe('STUDENT')
      expect(created).toMatchObject({ targetStudentId: 42 })
      expect(created).not.toHaveProperty('targetGroup')
    })

    it('derives status from startDate/dueDate against the current date', async () => {
      const api = createFakeAssignmentApi()
      const farFuture = new Date()
      farFuture.setFullYear(farFuture.getFullYear() + 5)
      const futureDateKey = farFuture.toISOString().slice(0, 10)

      const created = await api.createAssignment(TOKEN, {
        title: '먼 미래 과제',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        startDate: futureDateKey,
        dueDate: futureDateKey,
        questionIds: [1021],
      })

      expect(created.status).toBe('UPCOMING')
    })

    it('rejects an empty questionIds list with INVALID_ASSIGNMENT', async () => {
      const api = createFakeAssignmentApi()

      await expect(
        api.createAssignment(TOKEN, {
          title: '빈 과제',
          targetType: 'CLASS',
          targetGroup: '중1 A반',
          startDate: '2026-08-08',
          dueDate: '2026-08-10',
          questionIds: [],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_ASSIGNMENT', status: 400 })
    })

    it('rejects startDate after dueDate with INVALID_ASSIGNMENT', async () => {
      const api = createFakeAssignmentApi()

      await expect(
        api.createAssignment(TOKEN, {
          title: '잘못된 날짜',
          targetType: 'CLASS',
          targetGroup: '중1 A반',
          startDate: '2026-08-10',
          dueDate: '2026-08-08',
          questionIds: [1021],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_ASSIGNMENT', status: 400 })
    })
  })

  describe('updateAssignment', () => {
    it('applies a partial update (dueDate only) and leaves other fields untouched', async () => {
      const api = createFakeAssignmentApi()

      const updated = await api.updateAssignment(TOKEN, 2, { dueDate: '2026-08-25' })

      expect(updated.dueDate).toBe('2026-08-25')
      expect(updated.startDate).toBe('2026-08-14')
      expect(updated.title).toBe('가정법 복습')
      expect(updated.targetType).toBe('STUDENT')
    })

    it('switches target from CLASS to STUDENT, dropping targetGroup entirely', async () => {
      const api = createFakeAssignmentApi()

      const updated = await api.updateAssignment(TOKEN, 3, { targetType: 'STUDENT', targetStudentId: 11 })

      expect(updated.targetType).toBe('STUDENT')
      expect(updated).toMatchObject({ targetStudentId: 11 })
      expect(updated).not.toHaveProperty('targetGroup')
    })

    it('replaces questionIds and recomputes order for the new list', async () => {
      const api = createFakeAssignmentApi()

      const updated = await api.updateAssignment(TOKEN, 3, { questionIds: [1021, 1023] })

      expect(updated.questions.map((q) => q.id)).toEqual([1021, 1023])
      expect(updated.questions.map((q) => q.order)).toEqual([1, 2])
    })

    it('rejects updates to a CLOSED assignment with ASSIGNMENT_ALREADY_CLOSED', async () => {
      const api = createFakeAssignmentApi()

      await expect(api.updateAssignment(TOKEN, 1, { dueDate: '2026-09-01' })).rejects.toMatchObject({
        code: 'ASSIGNMENT_ALREADY_CLOSED',
        status: 409,
      })
    })

    it('rejects an unknown id with ASSIGNMENT_NOT_FOUND', async () => {
      const api = createFakeAssignmentApi()

      await expect(api.updateAssignment(TOKEN, 999999, { dueDate: '2026-09-01' })).rejects.toMatchObject({
        code: 'ASSIGNMENT_NOT_FOUND',
        status: 404,
      })
    })
  })

  describe('deleteAssignment', () => {
    it('removes the assignment so it no longer appears in list/get', async () => {
      const api = createFakeAssignmentApi()

      await api.deleteAssignment(TOKEN, 2)

      const { content } = await api.listAssignments(TOKEN)
      expect(content.map((a) => a.id)).not.toContain(2)
      await expect(api.getAssignment(TOKEN, 2)).rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_FOUND' })
    })

    it('rejects an unknown id with ASSIGNMENT_NOT_FOUND', async () => {
      const api = createFakeAssignmentApi()

      await expect(api.deleteAssignment(TOKEN, 999999)).rejects.toMatchObject({
        code: 'ASSIGNMENT_NOT_FOUND',
        status: 404,
      })
    })
  })

  it('gives each instance isolated, independent state', async () => {
    const apiA = createFakeAssignmentApi()
    const apiB = createFakeAssignmentApi()

    await apiA.createAssignment(TOKEN, {
      title: 'Only in apiA',
      targetType: 'CLASS',
      targetGroup: '중1 A반',
      startDate: '2026-08-08',
      dueDate: '2026-08-10',
      questionIds: [1021],
    })

    const { totalElements } = await apiB.listAssignments(TOKEN)
    expect(totalElements).toBe(ASSIGNMENT_FIXTURES.length)
  })
})
