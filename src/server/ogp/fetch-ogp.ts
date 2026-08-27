import { checkFetchableUrl } from './safe-url'

/**
 * OGP メタデータの取得。
 *
 * docs/06-technical-design.md の制約:
 *   - Workers Free は 1 invocation あたり 10ms CPU。重いHTMLパーサは載せない
 *   - HTML 全体を保存しない。meta だけ抽出する
 *   - response size limit / timeout
 *   - redirect 後も再検証する
 *
 * 取得の失敗は Visit の保存失敗にしない。呼び出し側は null を受け取り、
 * リンク自体は保存してカードだけ fallback 表示にする。
 */

export type OgpMetadata = {
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
}

/** head だけ読めれば十分なので、本文まで読み込まない。 */
const MAX_BYTES = 256 * 1024
const TIMEOUT_MS = 5000
const MAX_REDIRECTS = 3

export async function fetchOgp(rawUrl: string): Promise<OgpMetadata | null> {
  const initial = checkFetchableUrl(rawUrl)
  if (!initial.ok) return null

  try {
    const response = await fetchWithCheckedRedirects(initial.url)
    if (!response || !response.ok) return null

    // HTML 以外（画像やPDF）を読み込んでも意味がない
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }

    const html = await readCapped(response, MAX_BYTES)
    if (!html) return null

    return extractMetadata(html, response.url || initial.url.toString())
  } catch {
    return null
  }
}

/**
 * リダイレクトを自動で追わず、1ホップごとに行き先を検証する。
 * 外部URLから内部アドレスへ飛ばす経路を塞ぐため。
 */
async function fetchWithCheckedRedirects(url: URL): Promise<Response | null> {
  let current = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // OGP を返してもらうため、一般的なブラウザとして振る舞う
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'AtlasBot/1.0 (+https://github.com/nabeliwo/atlas)',
      },
    })

    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get('location')
    if (!location) return response

    const next = checkFetchableUrl(new URL(location, current).toString())
    if (!next.ok) return null

    current = next.url
  }

  return null
}

/** 上限までで打ち切って読む。Content-Length を信用しない。 */
async function readCapped(response: Response, limit: number): Promise<string | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  const decoder = new TextDecoder()
  let text = ''
  let size = 0

  while (size < limit) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    size += value.byteLength
    text += decoder.decode(value, { stream: true })

    // head を抜けたらそれ以上読む必要がない
    if (text.includes('</head>')) break
  }

  await reader.cancel().catch(() => {})
  return text
}

const META_TAG = /<meta\s+[^>]*>/gi

/**
 * 正規表現で meta タグだけを拾う。
 * HTML 全体を構文解析すると Free プランの CPU 制約に触れるため、
 * 意図的に軽い方法を選んでいる。
 */
function extractMetadata(html: string, baseUrl: string): OgpMetadata | null {
  const head = html.split(/<\/head>/i)[0] ?? html
  const values = new Map<string, string>()

  for (const tag of head.match(META_TAG) ?? []) {
    const key =
      attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop')
    const content = attr(tag, 'content')
    if (!key || !content) continue

    const normalized = key.toLowerCase()
    if (!values.has(normalized)) values.set(normalized, content)
  }

  const title =
    values.get('og:title') ??
    values.get('twitter:title') ??
    matchTitleTag(head)
  const description =
    values.get('og:description') ??
    values.get('twitter:description') ??
    values.get('description')
  const image = values.get('og:image') ?? values.get('twitter:image')
  const siteName = values.get('og:site_name')

  const metadata: OgpMetadata = {
    title: clean(title),
    description: clean(description),
    // og:image は相対パスのこともある
    imageUrl: image ? absolute(image, baseUrl) : undefined,
    siteName: clean(siteName),
  }

  // 何も取れなかったなら、カードにする価値がない
  const hasAny = Object.values(metadata).some((v) => v !== undefined)
  return hasAny ? metadata : null
}

function attr(tag: string, name: string): string | undefined {
  const match =
    tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) ??
    tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'))
  return match?.[1]
}

function matchTitleTag(head: string): string | undefined {
  return head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
}

/** 長すぎる値は DB に入れても表示に使わないので切る。 */
function clean(value: string | undefined): string | undefined {
  if (!value) return undefined
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function absolute(value: string, baseUrl: string): string | undefined {
  try {
    const resolved = new URL(value, baseUrl)
    // 画像も外部へ出ていくので同じ基準で検証する
    return checkFetchableUrl(resolved.toString()).ok
      ? resolved.toString()
      : undefined
  } catch {
    return undefined
  }
}
