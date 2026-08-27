import { describe, expect, it } from 'vitest'

import {
  isAllowedUrl,
  normalizeVisitInput,
  validateVisitInput,
} from './visit-input'

const base = { visitedDate: '2026-08-27', links: [] }
const messages = (input: Parameters<typeof validateVisitInput>[0]) =>
  validateVisitInput(input).map((e) => e.message)

describe('isAllowedUrl', () => {
  it('http/https だけ許可する', () => {
    expect(isAllowedUrl('https://example.com')).toBe(true)
    expect(isAllowedUrl('http://example.com')).toBe(true)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedUrl('data:text/html,x')).toBe(false)
    expect(isAllowedUrl('example.com')).toBe(false)
    expect(isAllowedUrl('')).toBe(false)
  })
})

describe('normalizeVisitInput', () => {
  it('空白だけの値は未入力として扱う', () => {
    const result = normalizeVisitInput({
      ...base,
      title: '   ',
      noteMarkdown: '  \n ',
    })
    expect(result.title).toBeUndefined()
    expect(result.noteMarkdown).toBeUndefined()
  })

  it('完全に空のリンク行は捨てる', () => {
    const result = normalizeVisitInput({
      ...base,
      links: [
        { url: '', title: '' },
        { url: 'https://example.com', title: 'ブログ' },
      ],
    })
    expect(result.links).toHaveLength(1)
  })
})

describe('validateVisitInput', () => {
  it('訪問日は必須', () => {
    expect(messages({ ...base, visitedDate: '' })).toContain(
      '訪問日を入力してください。',
    )
  })

  it('メモも外部リンクも無ければ弾く', () => {
    expect(messages(base)).toContain(
      'メモか外部リンクのどちらかを入力してください。',
    )
  })

  it('メモだけでも通る', () => {
    expect(messages({ ...base, noteMarkdown: '良かった' })).toEqual([])
  })

  it('リンクだけでも通る', () => {
    expect(
      messages({
        ...base,
        links: [{ url: 'https://example.com', title: 'ブログ' }],
      }),
    ).toEqual([])
  })

  it('タイトルだけではメモ扱いにしない', () => {
    // タイトルは任意項目なので、これだけでは必須条件を満たさない
    expect(messages({ ...base, title: 'タイトルのみ' })).toContain(
      'メモか外部リンクのどちらかを入力してください。',
    )
  })

  it('リンクの URL とタイトルを検証する', () => {
    const errors = messages({
      ...base,
      links: [{ url: 'javascript:alert(1)', title: '' }],
    })
    expect(errors).toContain('http / https の URL を入力してください。')
    expect(errors).toContain('リンクのタイトルを入力してください。')
  })

  it('エラーはリンクの位置を指す', () => {
    const errors = validateVisitInput({
      ...base,
      noteMarkdown: 'x',
      links: [
        { url: 'https://example.com', title: 'ok' },
        { url: 'bad', title: 'ng' },
      ],
    })
    expect(errors[0]?.field).toBe('links.1.url')
  })
})
