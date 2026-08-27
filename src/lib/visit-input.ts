import { isDateOnly } from './date-range'

/**
 * Visit の入力とバリデーション。
 * クライアントとサーバーの両方から使う。表示のためにクライアントでも走らせるが、
 * 保証するのはサーバー側。
 */

export type VisitLinkInput = {
  url: string
  title: string
}

export type VisitInput = {
  visitedDate: string
  title?: string
  noteMarkdown?: string
  links: Array<VisitLinkInput>
}

export type VisitValidationError = {
  field: 'visitedDate' | 'content' | `links.${number}.url` | `links.${number}.title`
  message: string
}

/** http/https だけを許可する。ここを緩めると Phase 4 の OGP 取得が危険になる。 */
export function isAllowedUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

export function normalizeVisitInput(input: VisitInput): VisitInput {
  const note = input.noteMarkdown?.trim()
  const title = input.title?.trim()

  return {
    visitedDate: input.visitedDate.trim(),
    title: title ? title : undefined,
    noteMarkdown: note ? note : undefined,
    links: input.links
      .map((link) => ({ url: link.url.trim(), title: link.title.trim() }))
      // 完全に空の行はユーザーの消し忘れとみなして捨てる
      .filter((link) => link.url !== '' || link.title !== ''),
  }
}

export function validateVisitInput(
  input: VisitInput,
): Array<VisitValidationError> {
  const errors: Array<VisitValidationError> = []
  const normalized = normalizeVisitInput(input)

  if (!isDateOnly(normalized.visitedDate)) {
    errors.push({ field: 'visitedDate', message: '訪問日を入力してください。' })
  }

  /**
   * docs/01-product-spec.md の必須条件。
   * ブログを書いたならリンクだけでよく、書いていないなら軽いメモを残す、
   * という運用を成り立たせるための最低ラインなので、片方あれば通す。
   */
  if (!normalized.noteMarkdown && normalized.links.length === 0) {
    errors.push({
      field: 'content',
      message: 'メモか外部リンクのどちらかを入力してください。',
    })
  }

  normalized.links.forEach((link, index) => {
    if (!link.url) {
      errors.push({
        field: `links.${index}.url`,
        message: 'URL を入力してください。',
      })
    } else if (!isAllowedUrl(link.url)) {
      errors.push({
        field: `links.${index}.url`,
        message: 'http / https の URL を入力してください。',
      })
    }

    if (!link.title) {
      errors.push({
        field: `links.${index}.title`,
        message: 'リンクのタイトルを入力してください。',
      })
    }
  })

  return errors
}
