/**
 * 期間フィルター。
 * docs/01-product-spec.md より、期間は「地図上の集計全体」に適用される。
 * 表示Place・Visit回数・クラスタのPlace数がすべて同じ集合から再計算される。
 */

/** YYYY-MM-DD。visitedDate と同じく時刻を持たない。 */
export type DateOnly = string

export type DateRange = {
  from?: DateOnly
  to?: DateOnly
}

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnly(value: unknown): value is DateOnly {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value)
}

/** URL クエリなど信頼できない入力から DateRange を作る。不正な値は無視する。 */
export function parseDateRange(input: {
  from?: unknown
  to?: unknown
}): DateRange {
  const from = isDateOnly(input.from) ? input.from : undefined
  const to = isDateOnly(input.to) ? input.to : undefined

  // from > to は空集合になるだけで害はないが、ユーザーの打ち間違いとして入れ替える
  if (from && to && from > to) return { from: to, to: from }

  return { from, to }
}

export type DateRangePresetId = 'this-year' | 'last-year' | 'last-5-years'

export type DateRangePreset = {
  id: DateRangePresetId
  label: string
  resolve: (today: Date) => DateRange
}

function toDateOnly(date: Date): DateOnly {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** docs/01-product-spec.md が挙げるプリセット。 */
export const DATE_RANGE_PRESETS: Array<DateRangePreset> = [
  {
    id: 'this-year',
    label: '今年',
    resolve: (today) => {
      const y = today.getFullYear()
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    },
  },
  {
    id: 'last-year',
    label: '去年',
    resolve: (today) => {
      const y = today.getFullYear() - 1
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    },
  },
  {
    id: 'last-5-years',
    label: '過去5年',
    resolve: (today) => ({
      from: `${today.getFullYear() - 4}-01-01`,
      to: toDateOnly(today),
    }),
  },
]

export function isEmptyRange(range: DateRange): boolean {
  return !range.from && !range.to
}

/** 現在の range がどのプリセットと一致するか。一致しなければ undefined。 */
export function matchPreset(
  range: DateRange,
  today: Date,
): DateRangePresetId | undefined {
  for (const preset of DATE_RANGE_PRESETS) {
    const resolved = preset.resolve(today)
    if (resolved.from === range.from && resolved.to === range.to) {
      return preset.id
    }
  }
  return undefined
}
