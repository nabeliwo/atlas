import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'

import { searchExternalPlaces } from '@/server/visits'
import type { PlaceCandidate } from '@/server/place-search'

type SearchBoxProps = {
  /** 外部施設を選んだとき。Visit 追加フォームへ進む。 */
  onSelectCandidate: (candidate: PlaceCandidate) => void
}

/**
 * 検索欄。
 *
 * docs/04-ui-spec.md では「自分の Places」と「外部施設検索」の
 * 2セクションを1つのUIで扱う。ここではまず外部施設検索だけを実装し、
 * 自分の Place 検索は Phase 4 で同じ器に足す。
 *
 * 外部検索は管理者だけが使うため、このコンポーネント自体を
 * 管理者以外にはレンダリングしない。
 */
export function SearchBox({ onSelectCandidate }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<PlaceCandidate>>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // 打鍵ごとに外部APIを叩かない（無料枠の消費を抑える）
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setFailed(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      void searchExternalPlaces({ data: { query: trimmed } })
        .then((found) => {
          if (cancelled) return
          setResults(found)
          setFailed(false)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const showResults = open && query.trim().length >= 2

  return (
    <div className="relative w-[min(320px,calc(100vw-2rem))]" ref={rootRef}>
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 shadow-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="場所を検索"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="検索をクリア"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {showResults ? (
        <div className="absolute top-full left-0 z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            施設を検索
          </p>

          {failed ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              検索に失敗しました。時間をおいて試してください。
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {loading ? '検索中…' : '見つかりませんでした。'}
            </p>
          ) : (
            <ul className="max-h-[50dvh] overflow-y-auto">
              {results.map((candidate) => (
                <li key={candidate.providerPlaceId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCandidate(candidate)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {candidate.name}
                      </span>
                      {/*
                        同じ施設が複数返ることがあるため、住所とカテゴリを
                        併記して人間が見分けられるようにする。
                      */}
                      {candidate.address ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {candidate.address}
                        </span>
                      ) : null}
                      {candidate.category ? (
                        <span className="mt-0.5 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {candidate.category}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
