import { Fragment, type ReactNode } from 'react'
import { marked, type Token, type Tokens } from 'marked'

import { isAllowedUrl } from '@/lib/visit-input'

/**
 * Visit メモの Markdown 描画。
 *
 * HTML 文字列を作らず、marked のトークンから React 要素を組み立てる。
 * dangerouslySetInnerHTML を使わないので、React が本文を自動でエスケープし、
 * sanitize の漏れによる XSS が構造的に起こらない
 * （docs/06-technical-design.md の「arbitrary HTML は無効化」を満たす）。
 *
 * 対応するのは記憶のメモに要る範囲だけ。凝った記法は意図的に落としている。
 */
export function Markdown({ source }: { source: string }) {
  const tokens = marked.lexer(source)

  return (
    <div className="text-sm leading-relaxed [&>*+*]:mt-3">
      {renderBlocks(tokens)}
    </div>
  )
}

function renderBlocks(tokens: Array<Token>): ReactNode {
  return tokens.map((token, index) => (
    <Fragment key={index}>{renderBlock(token)}</Fragment>
  ))
}

function renderBlock(token: Token): ReactNode {
  switch (token.type) {
    case 'paragraph':
      return <p>{renderInline(token.tokens ?? [])}</p>

    case 'heading': {
      // メモの中で h1 は強すぎるので、1段下げて出す
      const level = Math.min(token.depth + 1, 6)
      const Tag = `h${level}` as 'h2'
      return (
        <Tag className="text-sm font-semibold">
          {renderInline(token.tokens ?? [])}
        </Tag>
      )
    }

    case 'list': {
      const list = token as Tokens.List
      const items = list.items.map((item, index) => (
        <li key={index}>{renderInline(item.tokens ?? [])}</li>
      ))
      return list.ordered ? (
        <ol className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5">{items}</ul>
      )
    }

    case 'blockquote':
      return (
        <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
          {renderBlocks((token as Tokens.Blockquote).tokens ?? [])}
        </blockquote>
      )

    case 'code':
      return (
        <pre className="overflow-x-auto rounded-md bg-secondary p-3 text-xs">
          <code>{(token as Tokens.Code).text}</code>
        </pre>
      )

    case 'hr':
      return <hr className="border-border" />

    case 'space':
      return null

    // 生 HTML は描画しない。素通しすると XSS になる。
    case 'html':
      return null

    default:
      return 'text' in token && token.text ? <p>{token.text}</p> : null
  }
}

function renderInline(tokens: Array<Token>): ReactNode {
  return tokens.map((token, index) => (
    <Fragment key={index}>{renderInlineToken(token)}</Fragment>
  ))
}

function renderInlineToken(token: Token): ReactNode {
  switch (token.type) {
    case 'text':
      return 'tokens' in token && token.tokens
        ? renderInline(token.tokens)
        : token.raw

    case 'strong':
      return <strong>{renderInline(token.tokens ?? [])}</strong>

    case 'em':
      return <em>{renderInline(token.tokens ?? [])}</em>

    case 'del':
      return <del>{renderInline(token.tokens ?? [])}</del>

    case 'codespan':
      return (
        <code className="rounded bg-secondary px-1 py-0.5 text-xs">
          {(token as Tokens.Codespan).text}
        </code>
      )

    case 'br':
      return <br />

    case 'link': {
      const link = token as Tokens.Link
      // javascript: などを弾く。ここを緩めると XSS になる。
      if (!isAllowedUrl(link.href)) return renderInline(link.tokens ?? [])
      return (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {renderInline(link.tokens ?? [])}
        </a>
      )
    }

    /*
     * 画像はアプリ内に持たない方針なので、埋め込まずリンクとして出す
     * （docs/00-philosophy.md「アプリ内写真ストレージを作らない」）。
     */
    case 'image': {
      const image = token as Tokens.Image
      if (!isAllowedUrl(image.href)) return image.text
      return (
        <a
          href={image.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {image.text || image.href}
        </a>
      )
    }

    case 'html':
      return null

    default:
      return 'raw' in token ? token.raw : null
  }
}
