import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatDateOnly } from '@/lib/format'
import type { PlaceDetail } from '@/server/places'

type PlacePanelProps = {
  detail: PlaceDetail | null
  loading: boolean
  /** 期間フィルターが効いているか。統計が全期間でないことを伝えるために使う。 */
  filtered: boolean
  /** `?visit=` で指定された Visit。見える位置までスクロールし、一時的に強調する。 */
  highlightVisitId?: string
  onClose: () => void
}

/**
 * Place 詳細。
 * PC はサイドパネル、スマホはボトムシート。
 * どちらも地図を残したまま表示し、別ページへ遷移しない（docs/04-ui-spec.md）。
 */
export function PlacePanel({
  detail,
  loading,
  filtered,
  highlightVisitId,
  onClose,
}: PlacePanelProps) {
  // スマホでは本文を読むために十分広げられるようにする
  const [expanded, setExpanded] = useState(false)
  const visitRefs = useRef(new Map<string, HTMLLIElement>())

  // `?place=&visit=` で開かれたとき、対象の Visit が分かる状態にする
  useEffect(() => {
    if (!highlightVisitId || !detail) return

    const target = visitRefs.current.get(highlightVisitId)
    if (!target) return

    // スマホでは畳んだ高さだと隠れることがあるので広げてから寄せる
    setExpanded(true)
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightVisitId, detail])

  return (
    <aside
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden bg-background shadow-lg',
        // mobile: bottom sheet
        'inset-x-0 bottom-0 rounded-t-2xl border-t border-border',
        expanded ? 'h-[85dvh]' : 'h-[55dvh]',
        // desktop: side panel（左は操作系、右は詳細、という住み分け）
        'md:inset-y-4 md:left-auto md:bottom-auto md:right-4 md:h-auto md:max-h-[calc(100dvh-2rem)]',
        'md:w-[380px] md:rounded-xl md:border',
      )}
      aria-label="Place の詳細"
    >
      <button
        type="button"
        className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'シートを縮める' : 'シートを広げる'}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
        {loading && !detail ? (
          <PanelSkeleton />
        ) : !detail ? (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            この場所は見つかりませんでした。
          </p>
        ) : (
          <>
            <header className="pr-8">
              <h2 className="text-lg leading-snug font-semibold">
                {detail.name}
              </h2>
              {detail.address ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.address}
                </p>
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
                  <p className="text-sm font-medium">
                    {formatDateOnly(visit.visitedDate)}
                  </p>
                  {visit.title ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {visit.title}
                    </p>
                  ) : null}
                  {/* Markdown としての描画と外部リンクの OGP カードは Phase 4 */}
                  {visit.noteMarkdown ? (
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                      {visit.noteMarkdown}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </aside>
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
