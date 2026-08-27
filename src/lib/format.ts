import { isDateOnly, type DateOnly } from './date-range'

/** `2026-03-28` -> `2026年3月28日`。visitedDate は時刻を持たないので Date を経由しない。 */
export function formatDateOnly(value: DateOnly | null | undefined): string {
  if (!isDateOnly(value)) return ''
  const [year, month, day] = value.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}
