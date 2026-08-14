// Backend timestamps arrive as naive local datetime strings (no timezone
// offset), e.g. "2026-08-13T10:15:00". We format from the string's own
// digits rather than through a Date object so the result never shifts with
// the rendering environment's timezone.
const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

export function formatKoreanDateTime(value: string): string {
  const match = ISO_DATETIME_PATTERN.exec(value)
  if (!match) {
    return value
  }

  const [, year, month, day, hour, minute] = match
  return `${year}년 ${Number(month)}월 ${Number(day)}일 ${hour}:${minute}`
}
