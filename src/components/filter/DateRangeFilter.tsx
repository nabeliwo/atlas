import { useState } from 'react'
import { Calendar, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DATE_RANGE_PRESETS,
  isEmptyRange,
  matchPreset,
  type DateRange,
} from '@/lib/date-range'

type DateRangeFilterProps = {
  value: DateRange
  onChange: (range: DateRange) => void
}

/**
 * 期間フィルター。
 * ここで決めた集合が、表示 Place・Visit 回数・クラスタの Place 数すべての
 * 元になる（docs/01-product-spec.md）。
 */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const activePreset = matchPreset(value, today)
  const active = !isEmptyRange(value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 text-sm shadow-sm transition-colors hover:bg-secondary',
          active && 'border-foreground/25 font-medium',
        )}
      >
        <Calendar className="size-4 text-muted-foreground" />
        {active ? label(value, activePreset) : '期間'}
      </button>

      {active ? (
        <button
          type="button"
          onClick={() => onChange({})}
          aria-label="期間フィルターを解除"
          className="absolute -top-1.5 -right-1.5 rounded-full border border-border bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      ) : null}

      {open ? (
        <div className="absolute top-full left-0 z-20 mt-2 w-[280px] rounded-xl border border-border bg-background p-3 shadow-lg">
          <div className="flex flex-wrap gap-1.5">
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChange(preset.resolve(today))
                  setOpen(false)
                }}
                className={cn(
                  'rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary',
                  activePreset === preset.id &&
                    'border-foreground bg-foreground text-background hover:bg-foreground',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <Field
              label="開始"
              value={value.from ?? ''}
              onChange={(from) => onChange({ ...value, from: from || undefined })}
            />
            <Field
              label="終了"
              value={value.to ?? ''}
              onChange={(to) => onChange({ ...value, to: to || undefined })}
            />
          </div>

          {active ? (
            <button
              type="button"
              onClick={() => {
                onChange({})
                setOpen(false)
              }}
              className="mt-3 w-full rounded-md border border-border py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              全期間に戻す
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border px-2 py-1 text-sm"
      />
    </label>
  )
}

function label(range: DateRange, preset: string | undefined): string {
  if (preset) {
    return DATE_RANGE_PRESETS.find((p) => p.id === preset)?.label ?? '期間'
  }
  if (range.from && range.to) return `${range.from} 〜 ${range.to}`
  if (range.from) return `${range.from} 〜`
  if (range.to) return `〜 ${range.to}`
  return '期間'
}
