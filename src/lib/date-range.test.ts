import { describe, expect, it } from 'vitest'

import {
  DATE_RANGE_PRESETS,
  isDateOnly,
  isEmptyRange,
  matchPreset,
  parseDateRange,
} from './date-range'

const preset = (id: string) => DATE_RANGE_PRESETS.find((p) => p.id === id)!

describe('isDateOnly', () => {
  it('YYYY-MM-DD だけを受け付ける', () => {
    expect(isDateOnly('2026-08-27')).toBe(true)
    expect(isDateOnly('2026-8-27')).toBe(false)
    expect(isDateOnly('2026-08-27T00:00:00Z')).toBe(false)
    expect(isDateOnly('')).toBe(false)
    expect(isDateOnly(20260827)).toBe(false)
    expect(isDateOnly(undefined)).toBe(false)
  })
})

describe('parseDateRange', () => {
  it('不正な値を落とす', () => {
    expect(parseDateRange({ from: 'x', to: null })).toEqual({
      from: undefined,
      to: undefined,
    })
  })

  it('from > to なら入れ替える', () => {
    // 打ち間違いで空集合になるより、意図に寄せる
    expect(parseDateRange({ from: '2026-12-31', to: '2026-01-01' })).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  it('片方だけでも通す', () => {
    expect(parseDateRange({ from: '2026-01-01' })).toEqual({
      from: '2026-01-01',
      to: undefined,
    })
  })
})

describe('プリセット', () => {
  const today = new Date(2026, 7, 27) // 2026-08-27

  it('今年は1月1日から12月31日', () => {
    expect(preset('this-year').resolve(today)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  it('去年は前年の通年', () => {
    expect(preset('last-year').resolve(today)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })

  it('過去5年は4年前の1月1日から今日まで', () => {
    expect(preset('last-5-years').resolve(today)).toEqual({
      from: '2022-01-01',
      to: '2026-08-27',
    })
  })

  it('月日は0埋めする', () => {
    const early = new Date(2026, 0, 5) // 2026-01-05
    expect(preset('last-5-years').resolve(early).to).toBe('2026-01-05')
  })
})

describe('matchPreset', () => {
  const today = new Date(2026, 7, 27)

  it('一致するプリセットを返す', () => {
    expect(matchPreset({ from: '2026-01-01', to: '2026-12-31' }, today)).toBe(
      'this-year',
    )
  })

  it('自由入力の期間には一致しない', () => {
    expect(
      matchPreset({ from: '2026-03-01', to: '2026-04-01' }, today),
    ).toBeUndefined()
  })
})

describe('isEmptyRange', () => {
  it('両方未指定なら空', () => {
    expect(isEmptyRange({})).toBe(true)
    expect(isEmptyRange({ from: '2026-01-01' })).toBe(false)
  })
})
