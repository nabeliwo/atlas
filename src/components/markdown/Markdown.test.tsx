// @vitest-environment happy-dom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Markdown } from './Markdown'

function html(source: string) {
  const { container } = render(<Markdown source={source} />)
  return container.innerHTML
}

describe('Markdown', () => {
  it('強調と見出しとリストを描画する', () => {
    expect(html('**太字**')).toContain('<strong>太字</strong>')
    expect(html('*斜体*')).toContain('<em>斜体</em>')
    expect(html('## 見出し')).toContain('見出し')
    expect(html('- a\n- b')).toContain('<li>a</li>')
    expect(html('1. x')).toContain('<ol')
    expect(html('> 引用')).toContain('<blockquote')
    expect(html('`code`')).toContain('<code')
  })

  it('外部リンクは別タブで開く', () => {
    const out = html('[ブログ](https://example.com/post)')
    expect(out).toContain('href="https://example.com/post"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('生の script タグを描画しない', () => {
    const out = html('<script>alert(1)</script>\n\n本文')
    expect(out).not.toContain('<script')
    expect(out).toContain('本文')
  })

  it('生の img/onerror を描画しない', () => {
    const out = html('<img src=x onerror="alert(1)">')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('<img')
  })

  it('javascript: リンクを href にしない', () => {
    const out = html('[押して](javascript:alert(1))')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('押して')
  })

  it('data: リンクを href にしない', () => {
    const out = html('[x](data:text/html,<script>alert(1)</script>)')
    expect(out).not.toContain('data:text/html')
  })

  it('画像は埋め込まずリンクにする', () => {
    const out = html('![説明](https://example.com/a.png)')
    expect(out).not.toContain('<img')
    expect(out).toContain('href="https://example.com/a.png"')
    expect(out).toContain('説明')
  })

  it('本文中の HTML 特殊文字をエスケープする', () => {
    const out = html('a < b & c > d')
    expect(out).toContain('&lt;')
    expect(out).toContain('&amp;')
  })

  it('空文字でも落ちない', () => {
    expect(() => html('')).not.toThrow()
  })
})
