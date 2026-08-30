import {
  serializeStudentListFilters,
  serializeStudyRecordListFilters,
  type StudentApiErrorBody,
  type StudentDetail,
  type StudentListFilters,
  type StudentListItem,
  type StudentPageResponse,
  type StudyRecordListFilters,
  type StudyRecordRollup,
} from './studentTypes'

export class StudentApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'StudentApiError'
    this.status = status
    this.code = code
  }
}

const STUDENTS_PATH = '/api/students'
const STUDY_RECORDS_PATH = '/api/study-records'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new StudentApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<StudentApiErrorBody> | null = await response.json().catch(() => null)
    throw new StudentApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }

  return (await response.json()) as T
}

export interface StudentApi {
  listStudents(accessToken: string, filters?: StudentListFilters): Promise<StudentPageResponse<StudentListItem>>
  getStudent(accessToken: string, id: number): Promise<StudentDetail>
  listStudyRecords(
    accessToken: string,
    filters?: StudyRecordListFilters,
  ): Promise<StudentPageResponse<StudyRecordRollup>>
}

async function listStudents(
  accessToken: string,
  filters: StudentListFilters = {},
): Promise<StudentPageResponse<StudentListItem>> {
  const query = serializeStudentListFilters(filters)
  const path = query ? `${STUDENTS_PATH}?${query}` : STUDENTS_PATH

  return request<StudentPageResponse<StudentListItem>>(path, accessToken)
}

async function getStudent(accessToken: string, id: number): Promise<StudentDetail> {
  return request<StudentDetail>(`${STUDENTS_PATH}/${id}`, accessToken)
}

async function listStudyRecords(
  accessToken: string,
  filters: StudyRecordListFilters = {},
): Promise<StudentPageResponse<StudyRecordRollup>> {
  const query = serializeStudyRecordListFilters(filters)
  const path = query ? `${STUDY_RECORDS_PATH}?${query}` : STUDY_RECORDS_PATH

  return request<StudentPageResponse<StudyRecordRollup>>(path, accessToken)
}

export const studentApi: StudentApi = { listStudents, getStudent, listStudyRecords }

// Re-exported so callers only need to import from './studentApi'.
export type {
  StudentApiErrorBody,
  StudentDetail,
  StudentListFilters,
  StudentListItem,
  StudyRecordListFilters,
  StudyRecordRollup,
} from './studentTypes'
