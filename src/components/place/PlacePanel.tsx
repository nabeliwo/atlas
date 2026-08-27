import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatDateOnly } from '@/lib/format'
import { Panel } from '@/components/panel/Panel'
import type { PlaceDetail, PlaceDetailVisit } from '@/server/places'

type PlacePanelProps = {
  detail: PlaceDetail | null
  loading: boolean
  /** 期間フィルターが効いているか。統計が全期間でないことを伝えるために使う。 */
  filtered: boolean
  /** `?visit=` で指定された Visit。見える位置までスクロールし、一時的に強調する。 */
  highlightVisitId?: string
  /** 管理UIは管理者にだけ見せる（docs/04-ui-spec.md）。 */
  isAdmin: boolean
  onClose: () => void
  onAddVisit: () => void
  onEditVisit: (visit: PlaceDetailVisit) => void
  onDeleteVisit: (visit: PlaceDetailVisit) => Promise<void>
}

/**
 * Place 詳細。
 * 地図を残したまま表示し、別ページへ遷移しない（docs/04-ui-spec.md）。
 */
export function PlacePanel({
  detail,
  loading,
  filtered,
  highlightVisitId,
  isAdmin,
  onClose,
  onAddVisit,
  onEditVisit,
  onDeleteVisit,
}: PlacePanelProps) {
  const visitRefs = useRef(new Map<string, HTMLLIElement>())
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // `?place=&visit=` で開かれたとき、対象の Visit が分かる状態にする
  useEffect(() => {
    if (!highlightVisitId || !detail) return
    const target = visitRefs.current.get(highlightVisitId)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightVisitId, detail])

  return (
    <Panel onClose={onClose}>
      {loading && !detail ? (
        <PanelSkeleton />
      ) : !detail ? (
        <p className="pt-8 text-center text-sm text-muted-foreground">
          この場所は見つかりませんでした。
        </p>
      ) : (
        <>
          <header className="pr-8">
            <h2 className="text-lg leading-snug font-semibold">{detail.name}</h2>
            {detail.address ? (
              <p className="mt-1 text-sm text-muted-foreground">{detail.address}</p>
            ) : null}
          </header>

          <dl className="mt-4 flex gap-5 border-y border-border py-3 text-sm">
            <Stat label="訪問" value={`${detail.visitCount}回`} />
            <Stat label="初回" value={formatDateOnly(detail.firstVisitedDate)} />
            <Stat label="最終" value={formatDateOnly(detail.lastVisitedDate)} />
          </dl>

          {filtered && detail.totalVisitCount > detail.visitCount ? (
            <p className="mt-3 text-xs text-muted-foreground">
              期間フィルター適用中。全期間では {detail.totalVisitCount} 回。
            </p>
          ) : null}

          {isAdmin ? (
            <button
              type="button"
              onClick={onAddVisit}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Plus className="size-4" />
              訪問を追加
            </button>
          ) : null}

          <ol className="mt-5 space-y-5">
            {detail.visits.map((visit) => (
              <li
                key={visit.id}
                ref={(node) => {
                  if (node) visitRefs.current.set(visit.id, node)
                  else visitRefs.current.delete(visit.id)
                }}
                className={cn(
                  'border-b border-border pb-5 last:border-0',
                  visit.id === highlightVisitId &&
                    '-mx-2 rounded-lg bg-secondary px-2 pt-2',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {formatDateOnly(visit.visitedDate)}
                  </p>
                  {isAdmin ? (
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton
                        label="この訪問を編集"
                        onClick={() => onEditVisit(visit)}
                      >
                        <Pencil className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label="この訪問を削除"
                        onClick={() => setConfirmingId(visit.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>
                  ) : null}
                </div>

                {visit.title ? (
                  <p className="mt-1 text-sm text-muted-foreground">{visit.title}</p>
                ) : null}
                {/* Markdown としての描画と外部リンクの OGP カードは Phase 4 */}
                {visit.noteMarkdown ? (
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {visit.noteMarkdown}
                  </p>
                ) : null}

                {confirmingId === visit.id ? (
                  <DeleteConfirm
                    isLastVisit={detail.totalVisitCount === 1}
                    deleting={deleting}
                    onCancel={() => setConfirmingId(null)}
                    onConfirm={async () => {
                      setDeleting(true)
                      try {
                        await onDeleteVisit(visit)
                      } finally {
                        setDeleting(false)
                        setConfirmingId(null)
                      }
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  )
}

/**
 * 削除確認。
 * 最後の1件を消すと Place ごと地図から消えるため、その旨を明示する
 * （docs/01-product-spec.md）。
 */
function DeleteConfirm({
  isLastVisit,
  deleting,
  onCancel,
  onConfirm,
}: {
  isLastVisit: boolean
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm">
        {isLastVisit
          ? 'この訪問を削除すると、この場所の訪問記録がなくなるため地図からも消えます。'
          : 'この訪問を削除しますか？'}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {deleting ? '削除中…' : '削除する'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || '—'}</dd>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-2">
      <div className="h-5 w-2/3 rounded bg-secondary" />
      <div className="h-4 w-1/2 rounded bg-secondary" />
      <div className="h-12 rounded bg-secondary" />
      <div className="h-24 rounded bg-secondary" />
    </div>
  )
}
