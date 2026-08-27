import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  validateVisitInput,
  type VisitInput,
  type VisitLinkInput,
} from '@/lib/visit-input'

type VisitFormProps = {
  /** 場所の表示名。どこに対する訪問なのかを常に見せる。 */
  placeName: string
  placeAddress?: string | null
  initialValue?: Partial<VisitInput>
  submitLabel: string
  submitting: boolean
  /** サーバーから返ったエラー */
  serverError?: string | null
  /** エラーではない案内。既存 Visit の編集へ誘導したときの説明など。 */
  notice?: string | null
  onSubmit: (input: VisitInput) => void
  onCancel: () => void
}

const emptyLink: VisitLinkInput = { url: '', title: '' }

/**
 * Visit の追加・編集フォーム。
 *
 * 必須は訪問日のみ。タイトルとメモは任意だが、
 * 「メモ または 外部リンク の最低どちらか1つ」は必須
 * （docs/01-product-spec.md）。ブログを書いたならリンクだけでよく、
 * 書いていないなら軽いメモを残す、という運用のための最低ライン。
 */
export function VisitForm({
  placeName,
  placeAddress,
  initialValue,
  submitLabel,
  submitting,
  serverError,
  notice,
  onSubmit,
  onCancel,
}: VisitFormProps) {
  const [visitedDate, setVisitedDate] = useState(initialValue?.visitedDate ?? '')
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [noteMarkdown, setNote] = useState(initialValue?.noteMarkdown ?? '')
  const [links, setLinks] = useState<Array<VisitLinkInput>>(
    initialValue?.links?.length ? initialValue.links : [],
  )
  const [touched, setTouched] = useState(false)

  const value: VisitInput = { visitedDate, title, noteMarkdown, links }
  const errors = validateVisitInput(value)
  const errorFor = (field: string) =>
    touched ? errors.find((e) => e.field === field)?.message : undefined

  const updateLink = (index: number, patch: Partial<VisitLinkInput>) => {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    )
  }

  return (
    <form
      className="pr-8"
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (errors.length > 0) return
        onSubmit(value)
      }}
    >
      <header>
        <p className="text-xs text-muted-foreground">訪問を記録</p>
        <h2 className="mt-0.5 text-lg leading-snug font-semibold">{placeName}</h2>
        {placeAddress ? (
          <p className="mt-1 text-sm text-muted-foreground">{placeAddress}</p>
        ) : null}
      </header>

      {notice ? (
        <p className="mt-4 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <Field label="訪問日" required error={errorFor('visitedDate')}>
          <input
            type="date"
            value={visitedDate}
            onChange={(e) => setVisitedDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="タイトル">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="任意"
            className={inputClass}
          />
        </Field>

        <Field label="メモ">
          <textarea
            value={noteMarkdown}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Markdown で書けます"
            className={cn(inputClass, 'min-h-28 resize-y')}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">外部リンク</span>
            <button
              type="button"
              onClick={() => setLinks((prev) => [...prev, { ...emptyLink }])}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus className="size-3.5" />
              追加
            </button>
          </div>

          {links.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              ブログや写真のURL。記事があればメモは書かなくても構いません。
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {links.map((link, index) => (
                <li key={index} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLink(index, { url: e.target.value })}
                        placeholder="https://..."
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={link.title}
                        onChange={(e) =>
                          updateLink(index, { title: e.target.value })
                        }
                        placeholder="リンクのタイトル"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLinks((prev) => prev.filter((_, i) => i !== index))
                      }
                      aria-label="このリンクを削除"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <FieldError message={errorFor(`links.${index}.url`)} />
                  <FieldError message={errorFor(`links.${index}.title`)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <FieldError message={errorFor('content')} />
        {serverError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? '保存中…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-foreground/40'

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      <FieldError message={error} />
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-sm text-destructive">{message}</p>
}
