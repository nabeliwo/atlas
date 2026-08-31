import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchOgp } from './fetch-ogp'

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchOgp', () => {
  it('og: の値を取り出す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        htmlResponse(`
          <html><head>
            <meta property="og:title" content="記事タイトル">
            <meta property="og:description" content="説明文">
            <meta property="og:image" content="/images/cover.png">
            <meta property="og:site_name" content="ブログ">
          </head><body>...</body></html>
        `),
      ),
    )

    const result = await fetchOgp('https://example.com/post/1')
    expect(result).toEqual({
      title: '記事タイトル',
      description: '説明文',
      imageUrl: 'https://example.com/images/cover.png',
      siteName: 'ブログ',
    })
  })

  it('og: が無ければ twitter: と <title> にフォールバックする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        htmlResponse(`
          <html><head>
            <title>ページの題名</title>
            <meta name="twitter:description" content="ツイッター用の説明">
          </head></html>
        `),
      ),
    )

    const result = await fetchOgp('https://example.com/')
    expect(result?.title).toBe('ページの題名')
    expect(result?.description).toBe('ツイッター用の説明')
  })

  it('HTML エンティティを戻す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        htmlResponse(
          `<head><meta property="og:title" content="A &amp; B &quot;C&quot;"></head>`,
        ),
      ),
    )
    expect((await fetchOgp('https://example.com/'))?.title).toBe('A & B "C"')
  })

  it('内部アドレスは fetch せずに null を返す', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)

    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:8787/',
      'file:///etc/passwd',
    ]) {
      expect(await fetchOgp(url)).toBeNull()
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('リダイレクト先が内部アドレスなら追わない', async () => {
    const spy = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1:8787/secret' },
      }),
    )
    vi.stubGlobal('fetch', spy)

    expect(await fetchOgp('https://example.com/redirect')).toBeNull()
    // 最初の1回だけ。リダイレクト先は叩かない
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('外部への通常のリダイレクトは追う', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: 'https://example.org/final' },
        }),
      )
      .mockResolvedValueOnce(
        htmlResponse('<head><meta property="og:title" content="最終ページ"></head>'),
      )
    vi.stubGlobal('fetch', spy)

    expect((await fetchOgp('https://example.com/start'))?.title).toBe('最終ページ')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('HTML 以外は読まない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('binary', { headers: { 'content-type': 'image/png' } }),
      ),
    )
    expect(await fetchOgp('https://example.com/a.png')).toBeNull()
  })

  it('head が巨大で og タグが後ろにあっても拾える', async () => {
    /*
     * Google フォトの共有ページは <head> に 1MB 超のインラインデータを持ち、
     * og タグはその後ろにある。読み込み上限が足りないと取りこぼす。
     */
    const filler = `<script>${'x'.repeat(900_000)}</script>`
    const body = `<html><head>${filler}<meta property="og:title" content="奥にある題名"><meta property="og:image" content="https://example.com/p.jpg"></head><body>y</body></html>`

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(body, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    )

    const result = await fetchOgp('https://example.com/big')
    expect(result?.title).toBe('奥にある題名')
    expect(result?.imageUrl).toBe('https://example.com/p.jpg')
  })

  it('上限を超えた先にある og タグは諦める', async () => {
    // 際限なく読まないことの確認。2MB を超える位置には届かない。
    const filler = `<script>${'x'.repeat(2_200_000)}</script>`
    const body = `<html><head>${filler}<meta property="og:title" content="遠すぎる"></head></html>`

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(body, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    )

    expect(await fetchOgp('https://example.com/huge')).toBeNull()
  })

  it('meta が何も無ければ null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse('<head></head><body>x</body>')))
    expect(await fetchOgp('https://example.com/')).toBeNull()
  })

  it('fetch が失敗しても例外を投げない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    expect(await fetchOgp('https://example.com/')).toBeNull()
  })

  it('og:image が内部アドレスなら採用しない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        htmlResponse(`
          <head>
            <meta property="og:title" content="題名">
            <meta property="og:image" content="http://192.168.0.5/x.png">
          </head>`),
      ),
    )
    const result = await fetchOgp('https://example.com/')
    expect(result?.title).toBe('題名')
    expect(result?.imageUrl).toBeUndefined()
  })
})
